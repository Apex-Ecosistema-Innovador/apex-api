import { buildCorsOrigin, isLocalNetworkOrigin } from '../lib/cors-origin';

const resolve = (check: ReturnType<typeof buildCorsOrigin>, origin?: string) => {
  let result: boolean | undefined;
  check(origin, (_error, allow) => {
    result = allow;
  });
  return result;
};

describe('cors origin policy', () => {
  it('recognizes local network origins', () => {
    for (const origin of [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.10.14:3000',
      'http://10.0.0.5:3000',
      'http://172.20.1.9:3000',
      'http://mac-de-mateo.local:3000',
    ]) {
      expect(isLocalNetworkOrigin(origin)).toBe(true);
    }
  });

  it('rejects public hosts and look-alikes', () => {
    for (const origin of [
      'https://polipuntos.example.com',
      'http://192.169.1.1:3000',
      'http://172.32.0.1:3000',
      'http://192.168.1.1.evil.com',
      'http://evil.com/192.168.1.1',
      'ftp://192.168.1.1',
      'not-a-url',
    ]) {
      expect(isLocalNetworkOrigin(origin)).toBe(false);
    }
  });

  it('only opens the local network outside production', () => {
    const local = buildCorsOrigin(['https://app.example.com'], true);
    const production = buildCorsOrigin(['https://app.example.com'], false);

    expect(resolve(local, 'http://192.168.10.14:3000')).toBe(true);
    expect(resolve(production, 'http://192.168.10.14:3000')).toBe(false);
    expect(resolve(production, 'https://app.example.com')).toBe(true);
    expect(resolve(production, undefined)).toBe(true);
    expect(resolve(local, 'https://other.example.com')).toBe(false);
  });
});

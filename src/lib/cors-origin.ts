const PRIVATE_IPV4 = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|127\.\d+\.\d+\.\d+)$/;

export function isLocalNetworkOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return hostname === 'localhost' || hostname.endsWith('.local') || PRIVATE_IPV4.test(hostname);
  } catch {
    return false;
  }
}

export function buildCorsOrigin(allowed: string[], allowLocalNetwork: boolean) {
  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    const permitted = !origin || allowed.includes(origin) || (allowLocalNetwork && isLocalNetworkOrigin(origin));
    callback(null, permitted);
  };
}

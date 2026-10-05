import { passwordChangedMessage, passwordResetMessage } from '../lib/mail-templates';

const link = 'https://polipuntos.example.com/restablecer-contrasena#token=abc123_-XYZ';

describe('email templates', () => {
  const reset = passwordResetMessage({
    to: 'ana@elpoli.edu.co',
    fullName: 'Ana María Gómez',
    link,
    ttlMinutes: 60,
  });

  it('renders branded html and a plain text alternative with the same link', () => {
    expect(reset.html).toContain('<!doctype html>');
    expect(reset.html).toContain('#08090a');
    expect(reset.html).toContain('#96ff27');
    expect(reset.html).toContain('APEX');
    expect(reset.html).toContain(`href="${link}"`);
    expect(reset.text).toContain(link);
    expect(reset.text).toContain('Hola Ana,');
    expect(reset.html).toContain('Hola Ana,');
  });

  it('embeds the logo as an inline attachment instead of a remote image', () => {
    expect(reset.html).toContain('src="cid:apex-symbol"');
    expect(reset.html).not.toMatch(/src="https?:/);
    expect(reset.attachments).toEqual([expect.objectContaining({ cid: 'apex-symbol', contentType: 'image/png' })]);
    expect(reset.attachments![0].content.length).toBeGreaterThan(100);
  });

  it('escapes user supplied content', () => {
    const hostile = passwordResetMessage({
      to: 'x@elpoli.edu.co',
      fullName: '<script>alert(1)</script> Eve',
      link: 'https://polipuntos.example.com/?a="><img src=x onerror=alert(1)>',
      ttlMinutes: 60,
    });

    expect(hostile.html).not.toContain('<script>');
    expect(hostile.html).not.toContain('<img src=x');
    expect(hostile.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('builds the password changed notice with a recovery action', () => {
    const changed = passwordChangedMessage({
      to: 'ana@elpoli.edu.co',
      fullName: 'Ana Gómez',
      recoveryUrl: 'https://polipuntos.example.com/recuperar-contrasena',
      changedAt: new Date('2026-10-05T19:30:00Z'),
    });

    expect(changed.subject).toContain('actualizada');
    expect(changed.text).toContain('2026');
    expect(changed.html).toContain('href="https://polipuntos.example.com/recuperar-contrasena"');
  });
});

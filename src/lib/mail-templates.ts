import { MailMessage } from './mailer';

interface PasswordResetTemplate {
  to: string;
  fullName: string;
  link: string;
  ttlMinutes: number;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function passwordResetMessage({ to, fullName, link, ttlMinutes }: PasswordResetTemplate): MailMessage {
  const firstName = fullName.split(/\s+/)[0] ?? '';
  const text = [
    `Hola ${firstName},`,
    '',
    'Recibimos una solicitud para restablecer tu contraseña de APEX Polipuntos.',
    `Usa este enlace en los próximos ${ttlMinutes} minutos:`,
    '',
    link,
    '',
    'Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.',
  ].join('\n');

  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
<h2 style="margin:0 0 16px">Restablece tu contraseña</h2>
<p>Hola ${escapeHtml(firstName)},</p>
<p>Recibimos una solicitud para restablecer tu contraseña de APEX Polipuntos. El enlace vence en ${ttlMinutes} minutos.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#00842d;color:#fff;text-decoration:none;border-radius:8px">Crear nueva contraseña</a></p>
<p style="font-size:13px;color:#555">Si el botón no funciona, copia este enlace en tu navegador:<br>${escapeHtml(link)}</p>
<p style="font-size:13px;color:#555">Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.</p>
</div>`;

  return { to, subject: 'Restablece tu contraseña de APEX Polipuntos', text, html };
}

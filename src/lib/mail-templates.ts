import { emailAttachments, renderEmail, renderPlainText } from './mail-layout';
import {
  EmailContent,
  EmailVerificationTemplate,
  MailMessage,
  PasswordChangedTemplate,
  PasswordResetTemplate,
} from '../types/mail';

const build = (to: string, subject: string, content: EmailContent): MailMessage => ({
  to,
  subject,
  text: renderPlainText(content),
  html: renderEmail(content),
  attachments: emailAttachments(),
});

const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? '';

export function passwordResetMessage({ to, fullName, link, ttlMinutes }: PasswordResetTemplate): MailMessage {
  return build(to, 'Restablece tu contraseña de APEX Polipuntos', {
    preheader: `Crea una nueva contraseña. El enlace vence en ${ttlMinutes} minutos.`,
    title: 'Restablece tu contraseña',
    paragraphs: [
      `Hola ${firstNameOf(fullName)},`,
      `Recibimos una solicitud para restablecer la contraseña de tu cuenta en APEX Polipuntos. El enlace vence en ${ttlMinutes} minutos y solo se puede usar una vez.`,
    ],
    action: { label: 'Crear nueva contraseña', url: link },
    notes: ['Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.'],
  });
}

const formatChangedAt = (date: Date) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }).format(date);

export function passwordChangedMessage({ to, fullName, recoveryUrl, changedAt }: PasswordChangedTemplate): MailMessage {
  return build(to, 'Tu contraseña de APEX Polipuntos fue actualizada', {
    preheader: 'Cambiaste la contraseña de tu cuenta.',
    title: 'Tu contraseña fue actualizada',
    paragraphs: [
      `Hola ${firstNameOf(fullName)},`,
      `La contraseña de tu cuenta en APEX Polipuntos se cambió el ${formatChangedAt(changedAt)} (hora de Colombia). Por seguridad cerramos tus otras sesiones.`,
      'Si fuiste tú, no tienes que hacer nada más.',
    ],
    action: { label: 'No fui yo, recuperar mi cuenta', url: recoveryUrl },
    notes: [
      'Si no reconoces este cambio, usa el botón para pedir un enlace de recuperación y crear una nueva contraseña. Al hacerlo se cerrarán todas las sesiones abiertas.',
    ],
  });
}

export function emailVerificationMessage({ to, nombre, link, ttlHours }: EmailVerificationTemplate): MailMessage {
  return build(to, 'Verifica tu correo para la Hackathon APEX', {
    product: 'Hackathon',
    preheader: `Confirma tu correo para completar tu inscripción. El enlace vence en ${ttlHours} horas.`,
    title: 'Verifica tu correo',
    paragraphs: [
      `Hola ${firstNameOf(nombre)},`,
      `Recibimos tu inscripción a la Hackathon APEX. Para completarla necesitamos confirmar que este correo es tuyo. El enlace vence en ${ttlHours} horas y solo se puede usar una vez.`,
      'Tu inscripción queda pendiente hasta que el comité organizador la revise. Te avisaremos cuando haya una decisión.',
    ],
    action: { label: 'Verificar mi correo', url: link },
    notes: ['Si no fuiste tú, ignora este mensaje: no se activará ninguna cuenta con este correo.'],
  });
}

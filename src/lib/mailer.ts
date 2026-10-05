import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

class SmtpTransport implements MailTransport {
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  public async send(message: MailMessage) {
    await this.transporter.sendMail({ from: env.MAIL_FROM, ...message });
  }
}

class ConsoleTransport implements MailTransport {
  public async send(message: MailMessage) {
    console.log(`\n[mail] to=${message.to} subject="${message.subject}"\n${message.text}\n`);
  }
}

export class MemoryTransport implements MailTransport {
  public readonly outbox: MailMessage[] = [];

  public async send(message: MailMessage) {
    this.outbox.push(message);
  }
}

const buildTransport = (): MailTransport => {
  if (env.isTest) return new MemoryTransport();
  return env.SMTP_HOST ? new SmtpTransport() : new ConsoleTransport();
};

export const mailer = buildTransport();

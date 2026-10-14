import nodemailer from 'nodemailer';
import { waitUntil } from '@vercel/functions';
import { env } from '../config/env';
import { MailMessage, MailTransport } from '../types/mail';

const SMTP_TIMEOUT_MS = 10_000;

class SmtpTransport implements MailTransport {
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
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

export const dispatchMail = (message: MailMessage): void => {
  const delivery = mailer.send(message).catch((error) => {
    if (!env.isTest) console.error('email delivery failed', error);
  });
  waitUntil(delivery);
};

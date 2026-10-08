export interface MailAttachment {
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export interface PasswordResetTemplate {
  to: string;
  fullName: string;
  link: string;
  ttlMinutes: number;
}

export interface PasswordChangedTemplate {
  to: string;
  fullName: string;
  recoveryUrl: string;
  changedAt: Date;
}

export interface EmailAction {
  label: string;
  url: string;
}

export interface EmailContent {
  preheader: string;
  title: string;
  paragraphs: string[];
  action?: EmailAction;
  notes?: string[];
}

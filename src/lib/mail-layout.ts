import { readFileSync } from 'fs';
import { join } from 'path';
import { MailAttachment } from './mailer';

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

const LOGO_CID = 'apex-symbol';

const palette = {
  page: '#08090a',
  card: '#101210',
  border: '#2b2d2b',
  text: '#f4f6f1',
  muted: '#a5a8a3',
  accent: '#96ff27',
  accentText: '#08090a',
};

const fonts = {
  body: "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  display: "'Chakra Petch', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Courier New', monospace",
};

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export const emailAttachments = (): MailAttachment[] => [
  {
    filename: 'apex.png',
    content: readFileSync(join(process.cwd(), 'assets', 'mail', 'apex-symbol.png')),
    cid: LOGO_CID,
    contentType: 'image/png',
  },
];

const paragraph = (text: string) =>
  `<p style="margin:0 0 16px;font-family:${fonts.body};font-size:16px;line-height:1.6;color:${palette.text};">${escapeHtml(text)}</p>`;

const note = (text: string) =>
  `<p style="margin:0 0 8px;font-family:${fonts.body};font-size:13px;line-height:1.6;color:${palette.muted};">${escapeHtml(text)}</p>`;

const button = ({
  label,
  url,
}: EmailAction) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
<tr><td align="center" bgcolor="${palette.accent}" style="border-radius:8px;">
<a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${fonts.body};font-size:16px;font-weight:700;color:${palette.accentText};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr></table>
<p style="margin:0 0 24px;font-family:${fonts.body};font-size:13px;line-height:1.6;color:${palette.muted};">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${escapeHtml(url)}" target="_blank" style="color:${palette.accent};word-break:break-all;">${escapeHtml(url)}</a></p>`;

export function renderEmail({ preheader, title, paragraphs, action, notes = [] }: EmailContent): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${palette.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${palette.page};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.page}" style="background:${palette.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 0 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:12px;"><img src="cid:${LOGO_CID}" width="40" height="40" alt="" style="display:block;border:0;"></td>
<td style="font-family:${fonts.display};font-size:26px;font-weight:700;letter-spacing:0.08em;color:${palette.text};">APEX</td>
<td style="padding-left:10px;font-family:${fonts.mono};font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${palette.accent};">polipuntos</td>
</tr></table>
</td></tr>
<tr><td bgcolor="${palette.card}" style="background:${palette.card};border:1px solid ${palette.border};border-radius:12px;padding:32px;">
<h1 style="margin:0 0 20px;font-family:${fonts.display};font-size:26px;line-height:1.2;font-weight:600;color:${palette.text};">${escapeHtml(title)}</h1>
${paragraphs.map(paragraph).join('\n')}
${action ? button(action) : ''}
${notes.map(note).join('\n')}
</td></tr>
<tr><td style="padding:24px 8px 0;font-family:${fonts.body};font-size:12px;line-height:1.6;color:${palette.muted};">
Mensaje automático de APEX Polipuntos. Semillero SIIC, Politécnico Colombiano Jaime Isaza Cadavid.<br>
No respondas a este correo.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderPlainText({ title, paragraphs, action, notes = [] }: EmailContent): string {
  return [
    title,
    '',
    ...paragraphs.flatMap((text) => [text, '']),
    ...(action ? [`${action.label}: ${action.url}`, ''] : []),
    ...notes,
    '',
    '—',
    'APEX Polipuntos · Semillero SIIC, Politécnico Colombiano Jaime Isaza Cadavid',
  ]
    .join('\n')
    .trim();
}

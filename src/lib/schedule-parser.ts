import { PDFParse } from 'pdf-parse';
import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import type { ParsedSchedule } from '../types/schedule';

const PDF_SIGNATURE = '%PDF-';
const TERM_PATTERN = /\b(20\d{2})-([12])S\b/;
const DOCUMENT_PATTERN = /Doc\.?\s*Ident\.?[^\n]*?(\d[\d.]{3,18}\d)\s*$/im;
const DOCUMENT_FALLBACK_PATTERN = /Doc\.?\s*Ident\.?[\s\S]{0,120}?(\d[\d.]{4,18}\d)/i;
const COURSE_PATTERN = /\[([A-Z]{2,5}\d{3,6})\][ \t]+([^\n[]+)/g;

export const parseScheduleText = (text: string): ParsedSchedule | null => {
  const term = TERM_PATTERN.exec(text);
  const document = DOCUMENT_PATTERN.exec(text) ?? DOCUMENT_FALLBACK_PATTERN.exec(text);
  if (!term || !document) return null;

  const courses = new Map<string, string>();
  for (const match of text.matchAll(COURSE_PATTERN)) {
    const code = match[1];
    if (!courses.has(code)) courses.set(code, match[2].trim().slice(0, 150));
  }
  if (courses.size === 0) return null;

  return {
    term: `${term[1]}-${term[2]}`,
    document: document[1].replace(/\D/g, ''),
    courses: [...courses].map(([courseCode, courseName]) => ({ courseCode, courseName })),
  };
};

export const parseSchedulePdf = async (buffer: Buffer): Promise<ParsedSchedule> => {
  const unreadable = new CustomError(Errors.ScheduleUnreadable.status, Errors.ScheduleUnreadable.message);
  if (buffer.subarray(0, PDF_SIGNATURE.length).toString('latin1') !== PDF_SIGNATURE) throw unreadable;

  const reader = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const { text } = await reader.getText();
    const parsed = parseScheduleText(text);
    if (!parsed) throw unreadable;
    return parsed;
  } catch (error) {
    if (error instanceof CustomError) throw error;
    throw unreadable;
  } finally {
    await reader.destroy().catch(() => undefined);
  }
};

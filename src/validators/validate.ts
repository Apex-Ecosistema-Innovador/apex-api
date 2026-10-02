import { z } from 'zod';
import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';

export function validate<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    throw new CustomError(Errors.ValidationFailed.status, Errors.ValidationFailed.message, details);
  }

  return result.data;
}

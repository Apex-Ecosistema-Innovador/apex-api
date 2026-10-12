import { z } from 'zod';
import { fullNameSchema, institutionalEmailSchema, passwordSchema, uuidSchema } from './common';

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const githubSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/, 'Ingresa solo tu usuario de GitHub, sin @ ni enlace')
    .optional(),
);

const httpsUrlSchema = z
  .string()
  .trim()
  .max(255)
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Ingresa un enlace que empiece por https://');

const linkedinSchema = z.preprocess(
  emptyToUndefined,
  httpsUrlSchema
    .refine((value) => {
      const host = new URL(value).hostname.toLowerCase();
      return host === 'linkedin.com' || host.endsWith('.linkedin.com');
    }, 'Ingresa el enlace de tu perfil de LinkedIn')
    .optional(),
);

const portafolioSchema = z.preprocess(emptyToUndefined, httpsUrlSchema.optional());

const textoContextoSchema = (etiqueta: string) =>
  z
    .string()
    .trim()
    .min(2, `Ingresa ${etiqueta}`)
    .max(150)
    .transform((value) => value.replace(/\s+/g, ' '));

export const eventoParamsSchema = z.object({ eventoId: uuidSchema });

export const registroInscripcionSchema = z.object({
  nombre: fullNameSchema,
  correo: institutionalEmailSchema,
  contrasena: passwordSchema,
  github: githubSchema,
  linkedin: linkedinSchema,
  portafolio: portafolioSchema,
  institucion: textoContextoSchema('tu institución'),
  programa: textoContextoSchema('tu programa académico'),
  semestre: z
    .number()
    .int()
    .min(1, 'El semestre debe estar entre 1 y 12')
    .max(12, 'El semestre debe estar entre 1 y 12'),
  versionReglamento: z.string().trim().min(1).max(20),
  aceptaReglamento: z.literal(true, { error: 'Debes aceptar el reglamento' }),
  versionDatos: z.string().trim().min(1).max(20),
  autorizaTratamientoDatos: z.literal(true, { error: 'Debes autorizar el tratamiento de tus datos' }),
  consientePublicacionImagen: z.boolean().default(false),
});

export const verificarCorreoSchema = z.object({
  token: z.string().min(20).max(200),
});

export const reenviarVerificacionSchema = z.object({
  correo: z.string().trim().toLowerCase().max(254).pipe(z.email()),
});

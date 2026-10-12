import 'dotenv/config';
import type { Knex } from 'knex';
import { uuidV7 } from '../src/lib/uuid-v7';

const intFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
};

export async function seed(knex: Knex): Promise<void> {
  const nombre = (process.env.HACKATHON_NOMBRE || 'Hackathon APEX').trim();
  const existing = await knex('hackathones').where({ nombre }).first();

  if (existing) {
    console.log(`Evento existente: ${existing.id} (${existing.fase_actual})`);
    return;
  }

  const id = uuidV7();
  await knex('hackathones').insert({
    id,
    nombre,
    descripcion: process.env.HACKATHON_DESCRIPCION || '',
    modalidad: process.env.HACKATHON_MODALIDAD || 'PRESENCIAL',
    lugar: process.env.HACKATHON_LUGAR || '',
    equipo_min: intFromEnv('HACKATHON_EQUIPO_MIN', 2),
    equipo_max: intFromEnv('HACKATHON_EQUIPO_MAX', 4),
    fase_actual: process.env.HACKATHON_FASE || 'INSCRIPCIONES',
    version_reglamento: process.env.HACKATHON_VERSION_REGLAMENTO || '1.0',
  });
  console.log(`Evento creado: ${id}`);
}

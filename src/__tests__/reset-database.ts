import Database from '../lib/database';
import { normalizeName } from '../lib/normalize';
import { hashPassword } from '../lib/hash';
import { uuidV7 } from '../lib/uuid-v7';

export async function resetDatabase() {
  await Database.execute(
    'TRUNCATE polipoint_awards, enrollments, offerings, teacher_invites, users, tokens_usuario, inscripciones, usuarios, hackathones RESTART IDENTITY CASCADE',
  );
}

export async function insertUser(cedula: string, fullName: string, role: string): Promise<string> {
  const rows = await Database.query<{ id: string }>(
    `
      INSERT INTO users (cedula, full_name, full_name_search, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING id
    `,
    [cedula, fullName, normalizeName(fullName), await hashPassword('password123'), role],
  );
  return rows[0].id;
}

export async function insertHackathon(
  overrides: { faseActual?: string; versionReglamento?: string } = {},
): Promise<string> {
  const rows = await Database.query<{ id: string }>(
    `
      INSERT INTO hackathones (id, nombre, modalidad, equipo_min, equipo_max, fase_actual, version_reglamento)
      VALUES ($1, 'Hackathon de prueba', 'PRESENCIAL', 2, 4, $2, $3)
      RETURNING id
    `,
    [uuidV7(), overrides.faseActual ?? 'INSCRIPCIONES', overrides.versionReglamento ?? '1.0'],
  );
  return rows[0].id;
}

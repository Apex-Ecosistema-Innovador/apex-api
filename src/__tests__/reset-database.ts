import Database from '../lib/database';
import { normalizeName } from '../lib/normalize';
import { hashPassword } from '../lib/hash';

export async function resetDatabase() {
  await Database.execute(
    'TRUNCATE polipoint_awards, enrollments, offerings, teacher_invites, users RESTART IDENTITY CASCADE',
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

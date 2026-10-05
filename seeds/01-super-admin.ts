import 'dotenv/config';
import argon2 from 'argon2';
import type { Knex } from 'knex';
import { normalizeCedula, normalizeName } from '../src/lib/normalize';

export async function seed(knex: Knex): Promise<void> {
  const { SUPER_ADMIN_CEDULA, SUPER_ADMIN_NAME, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_EMAIL } = process.env;

  if (!SUPER_ADMIN_CEDULA || !SUPER_ADMIN_NAME || !SUPER_ADMIN_PASSWORD) {
    throw new Error('SUPER_ADMIN_CEDULA, SUPER_ADMIN_NAME and SUPER_ADMIN_PASSWORD are required');
  }

  const cedula = normalizeCedula(SUPER_ADMIN_CEDULA);
  const existing = await knex('users').where({ cedula }).first();
  if (existing) return;

  await knex('users').insert({
    cedula,
    full_name: SUPER_ADMIN_NAME,
    full_name_search: normalizeName(SUPER_ADMIN_NAME),
    email: SUPER_ADMIN_EMAIL ? SUPER_ADMIN_EMAIL.trim().toLowerCase() : null,
    password_hash: await argon2.hash(SUPER_ADMIN_PASSWORD),
    role: 'super_admin',
    status: 'active',
  });
}

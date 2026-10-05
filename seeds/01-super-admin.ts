import 'dotenv/config';
import argon2 from 'argon2';
import type { Knex } from 'knex';
import { normalizeCedula, normalizeName } from '../src/lib/normalize';

export async function seed(knex: Knex): Promise<void> {
  const { SUPER_ADMIN_CEDULA, SUPER_ADMIN_NAME, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_EMAIL } = process.env;
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN || 'elpoli.edu.co').trim().toLowerCase();

  if (!SUPER_ADMIN_CEDULA || !SUPER_ADMIN_NAME || !SUPER_ADMIN_PASSWORD || !SUPER_ADMIN_EMAIL) {
    throw new Error('SUPER_ADMIN_CEDULA, SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required');
  }

  const email = SUPER_ADMIN_EMAIL.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || !email.endsWith(`@${domain}`)) {
    throw new Error(`SUPER_ADMIN_EMAIL must be an institutional address (@${domain})`);
  }

  const cedula = normalizeCedula(SUPER_ADMIN_CEDULA);
  const existing = await knex('users').where({ cedula }).first();

  if (existing) {
    if (existing.email !== email)
      await knex('users').where({ id: existing.id }).update({ email, updated_at: knex.fn.now() });
    return;
  }

  await knex('users').insert({
    cedula,
    full_name: SUPER_ADMIN_NAME,
    full_name_search: normalizeName(SUPER_ADMIN_NAME),
    email,
    password_hash: await argon2.hash(SUPER_ADMIN_PASSWORD),
    role: 'super_admin',
    status: 'active',
  });
}

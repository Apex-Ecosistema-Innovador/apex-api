import database from '../lib/database';

export async function resetDatabase() {
  await database.raw(
    'TRUNCATE polipoint_awards, enrollments, offerings, teacher_invites, users RESTART IDENTITY CASCADE',
  );
}

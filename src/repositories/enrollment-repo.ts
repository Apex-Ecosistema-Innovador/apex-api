import { Knex } from 'knex';
import database from '../lib/database';

class EnrollmentRepo {
  public static async exists(studentId: string, offeringId: string): Promise<boolean> {
    const row = await database('enrollments').where({ student_id: studentId, offering_id: offeringId }).first();
    return Boolean(row);
  }

  public static async addMany(studentId: string, offeringIds: string[], trx: Knex | Knex.Transaction = database) {
    if (offeringIds.length === 0) return;
    await trx('enrollments')
      .insert(offeringIds.map((offeringId) => ({ student_id: studentId, offering_id: offeringId })))
      .onConflict(['student_id', 'offering_id'])
      .ignore();
  }

  public static async remove(studentId: string, offeringId: string): Promise<number> {
    return database('enrollments').where({ student_id: studentId, offering_id: offeringId }).delete();
  }

  public static async sharedOfferingIds(studentId: string, teacherId: string): Promise<string[]> {
    const rows = await database('enrollments')
      .join('offerings', 'offerings.id', 'enrollments.offering_id')
      .where({ 'enrollments.student_id': studentId, 'offerings.teacher_id': teacherId, 'offerings.active': true })
      .select<{ id: string }[]>('offerings.id');
    return rows.map((row) => row.id);
  }

  public static async rosterForTeacher(teacherId: string) {
    return database('enrollments')
      .join('offerings', 'offerings.id', 'enrollments.offering_id')
      .join('users', 'users.id', 'enrollments.student_id')
      .where({ 'offerings.teacher_id': teacherId, 'offerings.active': true })
      .select<{ studentId: string; fullName: string; cedula: string; offeringId: string }[]>(
        'users.id as studentId',
        'users.full_name as fullName',
        'users.cedula as cedula',
        'offerings.id as offeringId',
      );
  }
}

export default EnrollmentRepo;

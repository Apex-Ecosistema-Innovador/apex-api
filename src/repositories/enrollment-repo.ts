import Database from '../lib/database';
import { Queryable } from '../types/database';
import { RosterRow } from '../types/repositories';

class EnrollmentRepo {
  public static async exists(studentId: string, offeringId: string): Promise<boolean> {
    const query = `SELECT 1 AS found FROM enrollments WHERE student_id = $1 AND offering_id = $2`;
    const rows = await Database.query<{ found: number }>(query, [studentId, offeringId], {
      queryId: 'EnrollmentRepo.exists',
    });
    return rows.length > 0;
  }

  public static async addMany(studentId: string, offeringIds: string[], executor: Queryable = Database) {
    if (offeringIds.length === 0) return;
    const query = `
      INSERT INTO enrollments (student_id, offering_id)
      SELECT $1, offering_id FROM unnest($2::uuid[]) AS offering_id
      ON CONFLICT (student_id, offering_id) DO NOTHING
    `;
    await executor.execute(query, [studentId, offeringIds], { queryId: 'EnrollmentRepo.addMany' });
  }

  public static async remove(studentId: string, offeringId: string): Promise<number> {
    const query = `DELETE FROM enrollments WHERE student_id = $1 AND offering_id = $2`;
    return Database.execute(query, [studentId, offeringId], { queryId: 'EnrollmentRepo.remove' });
  }

  public static async sharedOfferingIds(studentId: string, teacherId: string): Promise<string[]> {
    const query = `
      SELECT offerings.id
      FROM enrollments
      JOIN offerings ON offerings.id = enrollments.offering_id
      WHERE enrollments.student_id = $1 AND offerings.teacher_id = $2 AND offerings.active = true
    `;
    const rows = await Database.query<{ id: string }>(query, [studentId, teacherId], {
      queryId: 'EnrollmentRepo.sharedOfferingIds',
    });
    return rows.map((row) => row.id);
  }

  public static async rosterForTeacher(teacherId: string): Promise<RosterRow[]> {
    const query = `
      SELECT
        users.id AS "studentId",
        users.full_name AS "fullName",
        users.cedula AS cedula,
        offerings.id AS "offeringId"
      FROM enrollments
      JOIN offerings ON offerings.id = enrollments.offering_id
      JOIN users ON users.id = enrollments.student_id
      WHERE offerings.teacher_id = $1 AND offerings.active = true
    `;
    return Database.query<RosterRow>(query, [teacherId], { queryId: 'EnrollmentRepo.rosterForTeacher' });
  }
}

export default EnrollmentRepo;

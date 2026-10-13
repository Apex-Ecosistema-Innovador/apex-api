import Database from '../lib/database';
import { currentTerm } from '../lib/term';
import { Queryable } from '../types/database';
import { PageResult, RosterRow } from '../types/repositories';

const ROSTER_FILTERS = `
  FROM enrollments
  JOIN offerings ON offerings.id = enrollments.offering_id
  JOIN users ON users.id = enrollments.student_id
  WHERE offerings.teacher_id = $1 AND offerings.active = true AND offerings.term = $2
`;

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
        AND offerings.term = $3
    `;
    const rows = await Database.query<{ id: string }>(query, [studentId, teacherId, currentTerm()], {
      queryId: 'EnrollmentRepo.sharedOfferingIds',
    });
    return rows.map((row) => row.id);
  }

  public static async rosterForTeacher(teacherId: string, page: number, limit: number): Promise<PageResult<RosterRow>> {
    const rowsQuery = `
      SELECT
        users.id AS "studentId",
        users.full_name AS "fullName",
        users.cedula AS cedula,
        offerings.id AS "offeringId"
      ${ROSTER_FILTERS}
      ORDER BY users.cedula, offerings.id
      LIMIT $3 OFFSET $4
    `;
    const countQuery = `SELECT count(*)::int AS total ${ROSTER_FILTERS}`;
    const [rows, totals] = await Promise.all([
      Database.query<RosterRow>(rowsQuery, [teacherId, currentTerm(), limit, (page - 1) * limit], {
        queryId: 'EnrollmentRepo.rosterForTeacher',
      }),
      Database.query<{ total: number }>(countQuery, [teacherId, currentTerm()], {
        queryId: 'EnrollmentRepo.rosterForTeacher.count',
      }),
    ]);
    return { rows, total: totals[0].total };
  }
}

export default EnrollmentRepo;

import Database from '../lib/database';
import { StudentsQuery } from '../validators/dashboard-validator';
import { escapeLike, normalizeName } from '../lib/normalize';

export interface DashboardRow {
  studentId: string;
  fullName: string;
  cedula: string;
  offeringId: string;
  courseCode: string;
  courseName: string;
  term: string;
  points: number;
}

const SORT_EXPRESSIONS = {
  name: 'users.full_name_search',
  cedula: 'users.cedula',
  points: 'points',
} as const;

const SORT_DIRECTIONS = { asc: 'ASC', desc: 'DESC' } as const;

const FILTERED_ENROLLMENTS = `
  FROM enrollments
  JOIN offerings ON offerings.id = enrollments.offering_id
  JOIN users ON users.id = enrollments.student_id
  LEFT JOIN polipoint_awards
    ON polipoint_awards.offering_id = enrollments.offering_id
    AND polipoint_awards.student_id = enrollments.student_id
    AND polipoint_awards.revoked_at IS NULL
  WHERE offerings.teacher_id = $1
    AND ($2::uuid IS NULL OR offerings.id = $2)
    AND (
      $3::text IS NULL
      OR users.full_name_search LIKE $3
      OR ($4::text IS NOT NULL AND users.cedula LIKE $4)
    )
  GROUP BY users.id, offerings.id, enrollments.id
  HAVING ($5::int IS NULL OR COALESCE(sum(polipoint_awards.points), 0) >= $5)
    AND ($6::int IS NULL OR COALESCE(sum(polipoint_awards.points), 0) <= $6)
`;

class DashboardRepo {
  public static async students(teacherId: string, filters: StudentsQuery, paginate = true) {
    const digits = filters.q?.replace(/\D/g, '') ?? '';
    const parameters = [
      teacherId,
      filters.offeringId ?? null,
      filters.q ? `%${escapeLike(normalizeName(filters.q))}%` : null,
      digits ? `%${escapeLike(digits)}%` : null,
      filters.minPoints ?? null,
      filters.maxPoints ?? null,
    ];

    const sort = SORT_EXPRESSIONS[filters.sort];
    const direction = SORT_DIRECTIONS[filters.order];
    const rowsQuery = `
      SELECT
        users.id AS "studentId",
        users.full_name AS "fullName",
        users.cedula AS cedula,
        offerings.id AS "offeringId",
        offerings.course_code AS "courseCode",
        offerings.course_name AS "courseName",
        offerings.term AS term,
        COALESCE(sum(polipoint_awards.points), 0)::int AS points
      ${FILTERED_ENROLLMENTS}
      ORDER BY ${sort} ${direction}, users.cedula ASC
      ${paginate ? 'LIMIT $7 OFFSET $8' : ''}
    `;
    const countQuery = `SELECT count(*)::int AS total FROM (SELECT enrollments.id ${FILTERED_ENROLLMENTS}) AS filtered`;

    const rowParameters = paginate ? [...parameters, filters.limit, (filters.page - 1) * filters.limit] : parameters;

    const [rows, totals] = await Promise.all([
      Database.query<DashboardRow>(rowsQuery, rowParameters, { queryId: 'DashboardRepo.students' }),
      Database.query<{ total: number }>(countQuery, parameters, { queryId: 'DashboardRepo.students.count' }),
    ]);

    return { rows, total: totals[0].total };
  }
}

export default DashboardRepo;

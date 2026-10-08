import Database from '../lib/database';
import { escapeLike, normalizeName } from '../lib/normalize';
import type { StudentsQuery } from '../types/inputs';
import { DashboardRow } from '../types/repositories';

const ORDER_BY = {
  'name:asc': 'ORDER BY users.full_name_search ASC, users.cedula ASC',
  'name:desc': 'ORDER BY users.full_name_search DESC, users.cedula ASC',
  'cedula:asc': 'ORDER BY users.cedula ASC',
  'cedula:desc': 'ORDER BY users.cedula DESC',
  'points:asc': 'ORDER BY points ASC, users.cedula ASC',
  'points:desc': 'ORDER BY points DESC, users.cedula ASC',
} as const;

const ROWS_SELECT = `
  SELECT
    users.id AS "studentId",
    users.full_name AS "fullName",
    users.cedula AS cedula,
    offerings.id AS "offeringId",
    offerings.course_code AS "courseCode",
    offerings.course_name AS "courseName",
    offerings.term AS term,
    COALESCE(sum(polipoint_awards.points), 0)::int AS points
`;

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
  public static async students(teacherId: string, filters: StudentsQuery) {
    const digits = filters.q?.replace(/\D/g, '') ?? '';
    const parameters = [
      teacherId,
      filters.offeringId ?? null,
      filters.q ? `%${escapeLike(normalizeName(filters.q))}%` : null,
      digits ? `%${escapeLike(digits)}%` : null,
      filters.minPoints ?? null,
      filters.maxPoints ?? null,
    ];

    const rowsQuery = `
      ${ROWS_SELECT}
      ${FILTERED_ENROLLMENTS}
      ${ORDER_BY[`${filters.sort}:${filters.order}`]}
      LIMIT $7 OFFSET $8
    `;
    const countQuery = `SELECT count(*)::int AS total FROM (SELECT enrollments.id ${FILTERED_ENROLLMENTS}) AS filtered`;

    const rowParameters = [...parameters, filters.limit, (filters.page - 1) * filters.limit];

    const [rows, totals] = await Promise.all([
      Database.query<DashboardRow>(rowsQuery, rowParameters, { queryId: 'DashboardRepo.students' }),
      Database.query<{ total: number }>(countQuery, parameters, { queryId: 'DashboardRepo.students.count' }),
    ]);

    return { rows, total: totals[0].total };
  }
}

export default DashboardRepo;

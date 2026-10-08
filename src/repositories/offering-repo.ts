import Database from '../lib/database';
import { Offering, PublicOffering } from '../types/models';
import { PageResult } from '../types/repositories';
import UserStatus from '../types/enums/user-status';
import { escapeLike } from '../lib/normalize';

const OFFERING_COLUMNS = `
  offerings.id,
  offerings.teacher_id AS "teacherId",
  offerings.course_code AS "courseCode",
  offerings.course_name AS "courseName",
  offerings.term,
  offerings.active,
  offerings.created_at AS "createdAt"
`;

const PUBLIC_OFFERING_COLUMNS = `
  offerings.id,
  offerings.course_code AS "courseCode",
  offerings.course_name AS "courseName",
  offerings.term,
  offerings.active,
  json_build_object('id', users.id, 'fullName', users.full_name) AS teacher
`;

const PUBLIC_FILTERS = `
  FROM offerings
  JOIN users ON users.id = offerings.teacher_id
  WHERE offerings.active = true
    AND users.status = $1
    AND (
      $2::text IS NULL
      OR lower(offerings.course_code) LIKE $2
      OR lower(offerings.course_name) LIKE $2
      OR users.full_name_search LIKE $2
    )
`;

class OfferingRepo {
  public static async findById(id: string): Promise<Offering | undefined> {
    const query = `SELECT ${OFFERING_COLUMNS} FROM offerings WHERE offerings.id = $1`;
    const rows = await Database.query<Offering>(query, [id], { queryId: 'OfferingRepo.findById' });
    return rows[0];
  }

  public static async findPublicById(id: string): Promise<PublicOffering | undefined> {
    const query = `
      SELECT ${PUBLIC_OFFERING_COLUMNS}
      FROM offerings
      JOIN users ON users.id = offerings.teacher_id
      WHERE offerings.id = $1
    `;
    const rows = await Database.query<PublicOffering>(query, [id], { queryId: 'OfferingRepo.findPublicById' });
    return rows[0];
  }

  public static async findByIds(ids: string[]): Promise<Offering[]> {
    if (ids.length === 0) return [];
    const query = `SELECT ${OFFERING_COLUMNS} FROM offerings WHERE offerings.id = ANY($1::uuid[])`;
    return Database.query<Offering>(query, [ids], { queryId: 'OfferingRepo.findByIds' });
  }

  public static async create(
    teacherId: string,
    data: { courseCode: string; courseName: string; term: string },
  ): Promise<Offering> {
    const query = `
      INSERT INTO offerings (teacher_id, course_code, course_name, term)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        teacher_id AS "teacherId",
        course_code AS "courseCode",
        course_name AS "courseName",
        term,
        active,
        created_at AS "createdAt"
    `;
    const rows = await Database.query<Offering>(query, [teacherId, data.courseCode, data.courseName, data.term], {
      queryId: 'OfferingRepo.create',
    });
    return rows[0];
  }

  public static async update(id: string, data: { courseName?: string; active?: boolean }): Promise<Offering> {
    const query = `
      UPDATE offerings
      SET course_name = COALESCE($2, course_name),
          active = COALESCE($3, active)
      WHERE id = $1
      RETURNING
        id,
        teacher_id AS "teacherId",
        course_code AS "courseCode",
        course_name AS "courseName",
        term,
        active,
        created_at AS "createdAt"
    `;
    const rows = await Database.query<Offering>(query, [id, data.courseName ?? null, data.active ?? null], {
      queryId: 'OfferingRepo.update',
    });
    return rows[0];
  }

  public static async listByTeacher(teacherId: string): Promise<PublicOffering[]> {
    const query = `
      SELECT ${PUBLIC_OFFERING_COLUMNS}
      FROM offerings
      JOIN users ON users.id = offerings.teacher_id
      WHERE offerings.teacher_id = $1
      ORDER BY offerings.term DESC, offerings.course_code
    `;
    return Database.query<PublicOffering>(query, [teacherId], { queryId: 'OfferingRepo.listByTeacher' });
  }

  public static async pageByTeacher(
    teacherId: string,
    page: number,
    limit: number,
  ): Promise<PageResult<PublicOffering>> {
    const rowsQuery = `
      SELECT ${PUBLIC_OFFERING_COLUMNS}
      FROM offerings
      JOIN users ON users.id = offerings.teacher_id
      WHERE offerings.teacher_id = $1
      ORDER BY offerings.term DESC, offerings.course_code
      LIMIT $2 OFFSET $3
    `;
    const countQuery = `SELECT count(*)::int AS total FROM offerings WHERE teacher_id = $1`;
    const [rows, totals] = await Promise.all([
      Database.query<PublicOffering>(rowsQuery, [teacherId, limit, (page - 1) * limit], {
        queryId: 'OfferingRepo.pageByTeacher',
      }),
      Database.query<{ total: number }>(countQuery, [teacherId], { queryId: 'OfferingRepo.pageByTeacher.count' }),
    ]);
    return { rows, total: totals[0].total };
  }

  public static async listPublic(
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<PageResult<PublicOffering>> {
    const like = search ? `%${escapeLike(search.toLowerCase())}%` : null;
    const rowsQuery = `
      SELECT ${PUBLIC_OFFERING_COLUMNS}
      ${PUBLIC_FILTERS}
      ORDER BY offerings.course_code, users.full_name
      LIMIT $3 OFFSET $4
    `;
    const countQuery = `SELECT count(*)::int AS total ${PUBLIC_FILTERS}`;
    const filterParameters = [UserStatus.Active, like];
    const [rows, totals] = await Promise.all([
      Database.query<PublicOffering>(rowsQuery, [...filterParameters, limit, (page - 1) * limit], {
        queryId: 'OfferingRepo.listPublic',
      }),
      Database.query<{ total: number }>(countQuery, filterParameters, { queryId: 'OfferingRepo.listPublic.count' }),
    ]);
    return { rows, total: totals[0].total };
  }

  public static async listByStudent(
    studentId: string,
    page: number,
    limit: number,
  ): Promise<PageResult<PublicOffering>> {
    const rowsQuery = `
      SELECT ${PUBLIC_OFFERING_COLUMNS}
      FROM enrollments
      JOIN offerings ON offerings.id = enrollments.offering_id
      JOIN users ON users.id = offerings.teacher_id
      WHERE enrollments.student_id = $1
      ORDER BY offerings.course_code
      LIMIT $2 OFFSET $3
    `;
    const countQuery = `SELECT count(*)::int AS total FROM enrollments WHERE student_id = $1`;
    const [rows, totals] = await Promise.all([
      Database.query<PublicOffering>(rowsQuery, [studentId, limit, (page - 1) * limit], {
        queryId: 'OfferingRepo.listByStudent',
      }),
      Database.query<{ total: number }>(countQuery, [studentId], { queryId: 'OfferingRepo.listByStudent.count' }),
    ]);
    return { rows, total: totals[0].total };
  }
}

export default OfferingRepo;

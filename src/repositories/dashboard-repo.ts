import database from '../lib/database';
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

const sortColumns = {
  name: 'users.full_name_search',
  cedula: 'users.cedula',
  points: 'points',
} as const;

class DashboardRepo {
  public static async students(teacherId: string, filters: StudentsQuery, paginate = true) {
    const base = database('enrollments')
      .join('offerings', 'offerings.id', 'enrollments.offering_id')
      .join('users', 'users.id', 'enrollments.student_id')
      .leftJoin('polipoint_awards', function joinAwards() {
        this.on('polipoint_awards.offering_id', 'enrollments.offering_id')
          .andOn('polipoint_awards.student_id', 'enrollments.student_id')
          .andOnNull('polipoint_awards.revoked_at');
      })
      .where('offerings.teacher_id', teacherId)
      .groupBy('users.id', 'offerings.id', 'enrollments.id');

    if (filters.offeringId) base.where('offerings.id', filters.offeringId);

    if (filters.q) {
      const nameLike = `%${escapeLike(normalizeName(filters.q))}%`;
      const cedulaLike = `%${escapeLike(filters.q.replace(/\D/g, ''))}%`;
      base.where((builder) => {
        builder.where('users.full_name_search', 'like', nameLike);
        if (filters.q && /\d/.test(filters.q)) builder.orWhere('users.cedula', 'like', cedulaLike);
      });
    }

    if (filters.minPoints !== undefined)
      base.havingRaw('coalesce(sum(polipoint_awards.points), 0) >= ?', [filters.minPoints]);
    if (filters.maxPoints !== undefined)
      base.havingRaw('coalesce(sum(polipoint_awards.points), 0) <= ?', [filters.maxPoints]);

    const totalRow = await database
      .from(base.clone().select('enrollments.id').as('filtered'))
      .count<{ count: string }[]>('* as count');

    const rowsQuery = base
      .clone()
      .select(
        'users.id as studentId',
        'users.full_name as fullName',
        'users.cedula as cedula',
        'offerings.id as offeringId',
        'offerings.course_code as courseCode',
        'offerings.course_name as courseName',
        'offerings.term as term',
        database.raw('coalesce(sum(polipoint_awards.points), 0)::int as points'),
      )
      .orderBy(sortColumns[filters.sort], filters.order)
      .orderBy('users.cedula', 'asc');

    if (paginate) rowsQuery.limit(filters.limit).offset((filters.page - 1) * filters.limit);

    const rows = (await rowsQuery) as DashboardRow[];
    return { rows, total: Number(totalRow[0].count) };
  }
}

export default DashboardRepo;

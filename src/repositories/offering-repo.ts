import database from '../lib/database';
import { Offering, PublicOffering } from '../types/models';
import UserStatus from '../types/enums/user-status';
import { escapeLike } from '../lib/normalize';

interface OfferingRow extends Offering {
  teacher_name: string;
}

const toPublic = (row: OfferingRow): PublicOffering => ({
  id: row.id,
  courseCode: row.course_code,
  courseName: row.course_name,
  term: row.term,
  active: row.active,
  teacher: { id: row.teacher_id, fullName: row.teacher_name },
});

class OfferingRepo {
  public static toPublic = toPublic;

  public static async findById(id: string): Promise<Offering | undefined> {
    return database<Offering>('offerings').where({ id }).first();
  }

  public static async findByIds(ids: string[]): Promise<Offering[]> {
    if (ids.length === 0) return [];
    return database<Offering>('offerings').whereIn('id', ids);
  }

  public static async create(
    teacherId: string,
    data: { courseCode: string; courseName: string; term: string },
  ): Promise<Offering> {
    const [offering] = await database<Offering>('offerings')
      .insert({
        teacher_id: teacherId,
        course_code: data.courseCode,
        course_name: data.courseName,
        term: data.term,
      })
      .returning('*');
    return offering;
  }

  public static async update(id: string, data: { courseName?: string; active?: boolean }): Promise<Offering> {
    const patch: Partial<Offering> = {};
    if (data.courseName !== undefined) patch.course_name = data.courseName;
    if (data.active !== undefined) patch.active = data.active;
    const [offering] = await database<Offering>('offerings').where({ id }).update(patch).returning('*');
    return offering;
  }

  public static async listByTeacher(teacherId: string): Promise<PublicOffering[]> {
    const rows = await database('offerings')
      .join('users', 'users.id', 'offerings.teacher_id')
      .where('offerings.teacher_id', teacherId)
      .orderBy([{ column: 'offerings.term', order: 'desc' }, { column: 'offerings.course_code' }])
      .select<OfferingRow[]>('offerings.*', 'users.full_name as teacher_name');
    return rows.map(toPublic);
  }

  public static async listPublic(search?: string): Promise<PublicOffering[]> {
    const query = database('offerings')
      .join('users', 'users.id', 'offerings.teacher_id')
      .where('offerings.active', true)
      .where('users.status', UserStatus.Active)
      .orderBy([{ column: 'offerings.course_code' }, { column: 'users.full_name' }])
      .select<OfferingRow[]>('offerings.*', 'users.full_name as teacher_name');

    if (search) {
      const like = `%${escapeLike(search.toLowerCase())}%`;
      query.where((builder) =>
        builder
          .whereRaw('lower(offerings.course_code) like ?', [like])
          .orWhereRaw('lower(offerings.course_name) like ?', [like])
          .orWhere('users.full_name_search', 'like', like),
      );
    }

    const rows = await query;
    return rows.map(toPublic);
  }

  public static async listByStudent(studentId: string): Promise<PublicOffering[]> {
    const rows = await database('enrollments')
      .join('offerings', 'offerings.id', 'enrollments.offering_id')
      .join('users', 'users.id', 'offerings.teacher_id')
      .where('enrollments.student_id', studentId)
      .orderBy('offerings.course_code')
      .select<OfferingRow[]>('offerings.*', 'users.full_name as teacher_name');
    return rows.map(toPublic);
  }
}

export default OfferingRepo;

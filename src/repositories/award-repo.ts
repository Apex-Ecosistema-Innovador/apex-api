import database from '../lib/database';
import { PolipointAward } from '../types/models';
import AwardSource from '../types/enums/award-source';

interface CreateAwardData {
  studentId: string;
  offeringId: string;
  teacherId: string;
  points: number;
  reason?: string;
  idempotencyKey: string;
  occurredAt?: Date;
  source?: AwardSource;
}

export interface AwardHistoryRow {
  id: string;
  points: number;
  reason: string | null;
  createdAt: Date;
  revokedAt: Date | null;
  courseCode: string;
  courseName: string;
  term: string;
  teacherName: string;
}

export interface OfferingTotalRow {
  offeringId: string;
  courseCode: string;
  courseName: string;
  term: string;
  teacherName: string;
  points: number;
}

class AwardRepo {
  public static async findById(id: string): Promise<PolipointAward | undefined> {
    return database<PolipointAward>('polipoint_awards').where({ id }).first();
  }

  public static async findByKey(key: string): Promise<PolipointAward | undefined> {
    return database<PolipointAward>('polipoint_awards').where({ idempotency_key: key }).first();
  }

  public static async create(data: CreateAwardData): Promise<PolipointAward | undefined> {
    const [award] = await database<PolipointAward>('polipoint_awards')
      .insert({
        student_id: data.studentId,
        offering_id: data.offeringId,
        teacher_id: data.teacherId,
        points: data.points,
        reason: data.reason ?? null,
        idempotency_key: data.idempotencyKey,
        source: data.source ?? AwardSource.Qr,
        ...(data.occurredAt ? { occurred_at: data.occurredAt } : {}),
      })
      .onConflict('idempotency_key')
      .ignore()
      .returning('*');
    return award;
  }

  public static async revoke(id: string, revokedBy: string, reason?: string): Promise<PolipointAward | undefined> {
    const [award] = await database<PolipointAward>('polipoint_awards')
      .where({ id })
      .whereNull('revoked_at')
      .update({ revoked_at: database.fn.now(), revoked_by: revokedBy, revoke_reason: reason ?? null })
      .returning('*');
    return award;
  }

  public static async totalForStudent(studentId: string): Promise<number> {
    const row = await database('polipoint_awards')
      .where({ student_id: studentId })
      .whereNull('revoked_at')
      .sum<{ total: string | null }>('points as total')
      .first();
    return Number(row?.total ?? 0);
  }

  public static async totalsForStudents(studentIds: string[]): Promise<Map<string, number>> {
    if (studentIds.length === 0) return new Map();
    const rows = await database('polipoint_awards')
      .whereIn('student_id', studentIds)
      .whereNull('revoked_at')
      .groupBy('student_id')
      .select<{ studentId: string; total: string }[]>('student_id as studentId')
      .sum('points as total');
    return new Map(rows.map((row) => [row.studentId, Number(row.total)]));
  }

  public static async totalsByOffering(studentId: string): Promise<OfferingTotalRow[]> {
    const rows = await database('enrollments')
      .join('offerings', 'offerings.id', 'enrollments.offering_id')
      .join('users', 'users.id', 'offerings.teacher_id')
      .leftJoin('polipoint_awards', function joinAwards() {
        this.on('polipoint_awards.offering_id', 'enrollments.offering_id')
          .andOn('polipoint_awards.student_id', 'enrollments.student_id')
          .andOnNull('polipoint_awards.revoked_at');
      })
      .where('enrollments.student_id', studentId)
      .groupBy('offerings.id', 'users.full_name')
      .orderBy('offerings.course_code')
      .select(
        'offerings.id as offeringId',
        'offerings.course_code as courseCode',
        'offerings.course_name as courseName',
        'offerings.term as term',
        'users.full_name as teacherName',
        database.raw('coalesce(sum(polipoint_awards.points), 0)::int as points'),
      );
    return rows as OfferingTotalRow[];
  }

  public static async history(studentId: string, offeringId?: string, teacherId?: string): Promise<AwardHistoryRow[]> {
    const query = database('polipoint_awards')
      .join('offerings', 'offerings.id', 'polipoint_awards.offering_id')
      .join('users', 'users.id', 'polipoint_awards.teacher_id')
      .where('polipoint_awards.student_id', studentId)
      .orderBy('polipoint_awards.occurred_at', 'desc')
      .limit(200)
      .select(
        'polipoint_awards.id as id',
        'polipoint_awards.points as points',
        'polipoint_awards.reason as reason',
        'polipoint_awards.occurred_at as createdAt',
        'polipoint_awards.revoked_at as revokedAt',
        'offerings.course_code as courseCode',
        'offerings.course_name as courseName',
        'offerings.term as term',
        'users.full_name as teacherName',
      );
    if (offeringId) query.where('polipoint_awards.offering_id', offeringId);
    if (teacherId) query.where('polipoint_awards.teacher_id', teacherId);
    return (await query) as AwardHistoryRow[];
  }
}

export default AwardRepo;

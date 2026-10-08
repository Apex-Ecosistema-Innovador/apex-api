import Database from '../lib/database';
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

const AWARD_COLUMNS = `
  id,
  student_id AS "studentId",
  offering_id AS "offeringId",
  teacher_id AS "teacherId",
  points,
  reason,
  idempotency_key AS "idempotencyKey",
  created_at AS "createdAt",
  occurred_at AS "occurredAt",
  source,
  revoked_at AS "revokedAt",
  revoked_by AS "revokedBy",
  revoke_reason AS "revokeReason"
`;

class AwardRepo {
  public static async findById(id: string): Promise<PolipointAward | undefined> {
    const query = `SELECT ${AWARD_COLUMNS} FROM polipoint_awards WHERE id = $1`;
    const rows = await Database.query<PolipointAward>(query, [id], { queryId: 'AwardRepo.findById' });
    return rows[0];
  }

  public static async findByKey(key: string): Promise<PolipointAward | undefined> {
    const query = `SELECT ${AWARD_COLUMNS} FROM polipoint_awards WHERE idempotency_key = $1`;
    const rows = await Database.query<PolipointAward>(query, [key], { queryId: 'AwardRepo.findByKey' });
    return rows[0];
  }

  public static async create(data: CreateAwardData): Promise<PolipointAward | undefined> {
    const query = `
      INSERT INTO polipoint_awards
        (student_id, offering_id, teacher_id, points, reason, idempotency_key, source, occurred_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()))
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING ${AWARD_COLUMNS}
    `;
    const parameters = [
      data.studentId,
      data.offeringId,
      data.teacherId,
      data.points,
      data.reason ?? null,
      data.idempotencyKey,
      data.source ?? AwardSource.Qr,
      data.occurredAt ?? null,
    ];
    const rows = await Database.query<PolipointAward>(query, parameters, { queryId: 'AwardRepo.create' });
    return rows[0];
  }

  public static async revoke(id: string, revokedBy: string, reason?: string): Promise<PolipointAward | undefined> {
    const query = `
      UPDATE polipoint_awards
      SET revoked_at = now(), revoked_by = $2, revoke_reason = $3
      WHERE id = $1 AND revoked_at IS NULL
      RETURNING ${AWARD_COLUMNS}
    `;
    const rows = await Database.query<PolipointAward>(query, [id, revokedBy, reason ?? null], {
      queryId: 'AwardRepo.revoke',
    });
    return rows[0];
  }

  public static async totalForStudent(studentId: string): Promise<number> {
    const query = `
      SELECT COALESCE(sum(points), 0)::int AS total
      FROM polipoint_awards
      WHERE student_id = $1 AND revoked_at IS NULL
    `;
    const rows = await Database.query<{ total: number }>(query, [studentId], { queryId: 'AwardRepo.totalForStudent' });
    return rows[0].total;
  }

  public static async totalsForStudents(studentIds: string[]): Promise<Map<string, number>> {
    if (studentIds.length === 0) return new Map();
    const query = `
      SELECT student_id AS "studentId", sum(points)::int AS total
      FROM polipoint_awards
      WHERE student_id = ANY($1::uuid[]) AND revoked_at IS NULL
      GROUP BY student_id
    `;
    const rows = await Database.query<{ studentId: string; total: number }>(query, [studentIds], {
      queryId: 'AwardRepo.totalsForStudents',
    });
    return new Map(rows.map((row) => [row.studentId, row.total]));
  }

  public static async totalsByOffering(studentId: string): Promise<OfferingTotalRow[]> {
    const query = `
      SELECT
        offerings.id AS "offeringId",
        offerings.course_code AS "courseCode",
        offerings.course_name AS "courseName",
        offerings.term AS term,
        users.full_name AS "teacherName",
        COALESCE(sum(polipoint_awards.points), 0)::int AS points
      FROM enrollments
      JOIN offerings ON offerings.id = enrollments.offering_id
      JOIN users ON users.id = offerings.teacher_id
      LEFT JOIN polipoint_awards
        ON polipoint_awards.offering_id = enrollments.offering_id
        AND polipoint_awards.student_id = enrollments.student_id
        AND polipoint_awards.revoked_at IS NULL
      WHERE enrollments.student_id = $1
      GROUP BY offerings.id, users.full_name
      ORDER BY offerings.course_code
    `;
    return Database.query<OfferingTotalRow>(query, [studentId], { queryId: 'AwardRepo.totalsByOffering' });
  }

  public static async history(studentId: string, offeringId?: string, teacherId?: string): Promise<AwardHistoryRow[]> {
    const query = `
      SELECT
        polipoint_awards.id AS id,
        polipoint_awards.points AS points,
        polipoint_awards.reason AS reason,
        polipoint_awards.occurred_at AS "createdAt",
        polipoint_awards.revoked_at AS "revokedAt",
        offerings.course_code AS "courseCode",
        offerings.course_name AS "courseName",
        offerings.term AS term,
        users.full_name AS "teacherName"
      FROM polipoint_awards
      JOIN offerings ON offerings.id = polipoint_awards.offering_id
      JOIN users ON users.id = polipoint_awards.teacher_id
      WHERE polipoint_awards.student_id = $1
        AND ($2::uuid IS NULL OR polipoint_awards.offering_id = $2)
        AND ($3::uuid IS NULL OR polipoint_awards.teacher_id = $3)
      ORDER BY polipoint_awards.occurred_at DESC
      LIMIT 200
    `;
    return Database.query<AwardHistoryRow>(query, [studentId, offeringId ?? null, teacherId ?? null], {
      queryId: 'AwardRepo.history',
    });
  }
}

export default AwardRepo;

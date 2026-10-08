import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import UserRepo from '../repositories/user-repo';
import OfferingRepo from '../repositories/offering-repo';
import EnrollmentRepo from '../repositories/enrollment-repo';
import AwardRepo from '../repositories/award-repo';
import AuthService from './auth-service';
import { signQrToken, verifyQrToken } from '../lib/qr-token';
import Role from '../types/enums/roles';
import AwardSource from '../types/enums/award-source';
import { env } from '../config/env';
import { validate } from '../validators/validate';
import { CreateAwardInput, OfflineAwardInput, offlineAwardSchema } from '../validators/polipoint-validator';

type PolipointAwardRow = Awaited<ReturnType<typeof AwardRepo.findById>> & object;

type BatchStatus = 'created' | 'duplicate' | 'rejected';

interface BatchResult {
  idempotencyKey: string;
  status: BatchStatus;
  error?: string;
}

const CLOCK_SKEW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

class PolipointService {
  public static async getQr(userId: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new CustomError(Errors.UserNotFound.status, Errors.UserNotFound.message);
    return { token: signQrToken(user.id, user.qrTokenVersion) };
  }

  public static async rotateQr(userId: string) {
    const user = await UserRepo.incrementQrVersion(userId);
    return { token: signQrToken(user.id, user.qrTokenVersion) };
  }

  private static async resolveStudent(token: string) {
    const decoded = verifyQrToken(token);
    if (!decoded) throw new CustomError(Errors.InvalidQr.status, Errors.InvalidQr.message);

    const student = await UserRepo.findById(decoded.userId);
    if (!student || student.role !== Role.Student || student.qrTokenVersion !== decoded.version) {
      throw new CustomError(Errors.InvalidQr.status, Errors.InvalidQr.message);
    }
    return student;
  }

  private static async findStudent(studentId: string) {
    const student = await UserRepo.findById(studentId);
    if (!student || student.role !== Role.Student) {
      throw new CustomError(Errors.UserNotFound.status, Errors.UserNotFound.message);
    }
    return student;
  }

  public static async scan(teacherId: string, token: string) {
    const student = await PolipointService.resolveStudent(token);

    const offeringIds = await EnrollmentRepo.sharedOfferingIds(student.id, teacherId);
    const offerings = (await OfferingRepo.listByTeacher(teacherId)).filter((offering) =>
      offeringIds.includes(offering.id),
    );
    const total = await AwardRepo.totalForStudent(student.id);

    return { student: AuthService.toPublicUser(student), offerings, total };
  }

  public static async roster(teacherId: string) {
    const [offerings, rows] = await Promise.all([
      OfferingRepo.listByTeacher(teacherId),
      EnrollmentRepo.rosterForTeacher(teacherId),
    ]);
    const students = new Map<string, { id: string; fullName: string; cedula: string; offeringIds: string[] }>();
    rows.forEach((row) => {
      const entry = students.get(row.studentId) ?? {
        id: row.studentId,
        fullName: row.fullName,
        cedula: row.cedula,
        offeringIds: [],
      };
      entry.offeringIds.push(row.offeringId);
      students.set(row.studentId, entry);
    });
    const totals = await AwardRepo.totalsForStudents([...students.keys()]);

    return {
      offerings: offerings.filter((offering) => offering.active),
      students: [...students.values()].map((student) => ({ ...student, total: totals.get(student.id) ?? 0 })),
      generatedAt: new Date().toISOString(),
    };
  }

  private static async persistAward(
    teacherId: string,
    input: CreateAwardInput & { occurredAt?: Date },
  ): Promise<{ award: PolipointAwardRow; created: boolean }> {
    const existing = await AwardRepo.findByKey(input.idempotencyKey);
    if (existing) {
      if (existing.teacherId !== teacherId) {
        throw new CustomError(Errors.Forbidden.status, Errors.Forbidden.message);
      }
      return { award: existing, created: false };
    }

    const offering = await OfferingRepo.findById(input.offeringId);
    if (!offering || offering.teacherId !== teacherId) {
      throw new CustomError(Errors.OfferingNotFound.status, Errors.OfferingNotFound.message);
    }
    if (!offering.active) throw new CustomError(Errors.OfferingInactive.status, Errors.OfferingInactive.message);
    if (!(await EnrollmentRepo.exists(input.studentId, input.offeringId))) {
      throw new CustomError(Errors.NotEnrolled.status, Errors.NotEnrolled.message);
    }

    const created = await AwardRepo.create({ ...input, teacherId });
    if (created) return { award: created, created: true };
    return { award: (await AwardRepo.findByKey(input.idempotencyKey))!, created: false };
  }

  public static async award(teacherId: string, input: CreateAwardInput) {
    return (await PolipointService.persistAward(teacherId, input)).award;
  }

  private static assertOccurredAt(occurredAt: Date) {
    const now = Date.now();
    if (occurredAt.getTime() > now + CLOCK_SKEW_MS) {
      throw new CustomError(Errors.AwardInFuture.status, Errors.AwardInFuture.message);
    }
    if (occurredAt.getTime() < now - env.OFFLINE_AWARD_MAX_AGE_DAYS * DAY_MS) {
      throw new CustomError(Errors.AwardTooOld.status, Errors.AwardTooOld.message);
    }
  }

  private static async awardOffline(teacherId: string, item: OfflineAwardInput): Promise<BatchStatus> {
    const occurredAt = new Date(item.occurredAt);
    PolipointService.assertOccurredAt(occurredAt);
    const student = item.qrToken
      ? await PolipointService.resolveStudent(item.qrToken)
      : await PolipointService.findStudent(item.studentId!);
    const { created } = await PolipointService.persistAward(teacherId, {
      studentId: student.id,
      source: item.qrToken ? AwardSource.Qr : AwardSource.Manual,
      offeringId: item.offeringId,
      points: item.points,
      reason: item.reason,
      idempotencyKey: item.idempotencyKey,
      occurredAt,
    });
    return created ? 'created' : 'duplicate';
  }

  public static async awardBatch(teacherId: string, items: unknown[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    for (const raw of items) {
      const key = (raw as { idempotencyKey?: unknown })?.idempotencyKey;
      const idempotencyKey = typeof key === 'string' ? key : '';
      try {
        const item = validate(offlineAwardSchema, raw);
        results.push({ idempotencyKey, status: await PolipointService.awardOffline(teacherId, item) });
      } catch (error) {
        const message = error instanceof CustomError ? error.message : Errors.Internal.message;
        results.push({ idempotencyKey, status: 'rejected', error: message });
      }
    }
    return results;
  }

  public static async revoke(actorId: string, role: Role, awardId: string, reason?: string) {
    const award = await AwardRepo.findById(awardId);
    const isStaff = role === Role.Admin || role === Role.SuperAdmin;

    if (!award || (!isStaff && award.teacherId !== actorId)) {
      throw new CustomError(Errors.AwardNotFound.status, Errors.AwardNotFound.message);
    }
    if (award.revokedAt) throw new CustomError(Errors.AwardAlreadyRevoked.status, Errors.AwardAlreadyRevoked.message);

    return AwardRepo.revoke(awardId, actorId, reason);
  }

  public static async mySummary(studentId: string) {
    const [total, offerings, history] = await Promise.all([
      AwardRepo.totalForStudent(studentId),
      AwardRepo.totalsByOffering(studentId),
      AwardRepo.history(studentId),
    ]);
    return { total, offerings, history };
  }
}

export default PolipointService;

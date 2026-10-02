import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import UserRepo from '../repositories/user-repo';
import OfferingRepo from '../repositories/offering-repo';
import EnrollmentRepo from '../repositories/enrollment-repo';
import AwardRepo from '../repositories/award-repo';
import AuthService from './auth-service';
import { signQrToken, verifyQrToken } from '../lib/qr-token';
import Role from '../types/enums/roles';
import { CreateAwardInput } from '../validators/polipoint-validator';

class PolipointService {
  public static async getQr(userId: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new CustomError(Errors.UserNotFound.status, Errors.UserNotFound.message);
    return { token: signQrToken(user.id, user.qr_token_version) };
  }

  public static async rotateQr(userId: string) {
    const user = await UserRepo.incrementQrVersion(userId);
    return { token: signQrToken(user.id, user.qr_token_version) };
  }

  public static async scan(teacherId: string, token: string) {
    const decoded = verifyQrToken(token);
    if (!decoded) throw new CustomError(Errors.InvalidQr.status, Errors.InvalidQr.message);

    const student = await UserRepo.findById(decoded.userId);
    if (!student || student.role !== Role.Student || student.qr_token_version !== decoded.version) {
      throw new CustomError(Errors.InvalidQr.status, Errors.InvalidQr.message);
    }

    const offeringIds = await EnrollmentRepo.sharedOfferingIds(student.id, teacherId);
    const offerings = (await OfferingRepo.listByTeacher(teacherId)).filter((offering) =>
      offeringIds.includes(offering.id),
    );
    const total = await AwardRepo.totalForStudent(student.id);

    return { student: AuthService.toPublicUser(student), offerings, total };
  }

  public static async award(teacherId: string, input: CreateAwardInput) {
    const existing = await AwardRepo.findByKey(input.idempotencyKey);
    if (existing) {
      if (existing.teacher_id !== teacherId) {
        throw new CustomError(Errors.Forbidden.status, Errors.Forbidden.message);
      }
      return existing;
    }

    const offering = await OfferingRepo.findById(input.offeringId);
    if (!offering || offering.teacher_id !== teacherId) {
      throw new CustomError(Errors.OfferingNotFound.status, Errors.OfferingNotFound.message);
    }
    if (!offering.active) throw new CustomError(Errors.OfferingInactive.status, Errors.OfferingInactive.message);
    if (!(await EnrollmentRepo.exists(input.studentId, input.offeringId))) {
      throw new CustomError(Errors.NotEnrolled.status, Errors.NotEnrolled.message);
    }

    const created = await AwardRepo.create({ ...input, teacherId });
    return created ?? (await AwardRepo.findByKey(input.idempotencyKey));
  }

  public static async revoke(actorId: string, role: Role, awardId: string, reason?: string) {
    const award = await AwardRepo.findById(awardId);
    const isStaff = role === Role.Admin || role === Role.SuperAdmin;

    if (!award || (!isStaff && award.teacher_id !== actorId)) {
      throw new CustomError(Errors.AwardNotFound.status, Errors.AwardNotFound.message);
    }
    if (award.revoked_at) throw new CustomError(Errors.AwardAlreadyRevoked.status, Errors.AwardAlreadyRevoked.message);

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

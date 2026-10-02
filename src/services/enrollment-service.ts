import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import OfferingRepo from '../repositories/offering-repo';
import EnrollmentRepo from '../repositories/enrollment-repo';
import AwardRepo from '../repositories/award-repo';

class EnrollmentService {
  public static listMine(studentId: string) {
    return OfferingRepo.listByStudent(studentId);
  }

  public static async enroll(studentId: string, offeringId: string) {
    const offering = await OfferingRepo.findById(offeringId);
    if (!offering) throw new CustomError(Errors.OfferingNotFound.status, Errors.OfferingNotFound.message);
    if (!offering.active) throw new CustomError(Errors.OfferingInactive.status, Errors.OfferingInactive.message);
    if (await EnrollmentRepo.exists(studentId, offeringId)) {
      throw new CustomError(Errors.AlreadyEnrolled.status, Errors.AlreadyEnrolled.message);
    }
    await EnrollmentRepo.addMany(studentId, [offeringId]);
  }

  public static async unenroll(studentId: string, offeringId: string) {
    if (!(await EnrollmentRepo.exists(studentId, offeringId))) {
      throw new CustomError(Errors.NotEnrolled.status, Errors.NotEnrolled.message);
    }
    const history = await AwardRepo.history(studentId, offeringId);
    if (history.some((award) => !award.revokedAt)) {
      throw new CustomError(Errors.EnrollmentHasPoints.status, Errors.EnrollmentHasPoints.message);
    }
    await EnrollmentRepo.remove(studentId, offeringId);
  }
}

export default EnrollmentService;

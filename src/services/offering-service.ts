import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import OfferingRepo from '../repositories/offering-repo';
import type { CreateOfferingInput, PageQuery, PublicOfferingsQuery, UpdateOfferingInput } from '../types/inputs';

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === '23505';

class OfferingService {
  public static listPublic({ q, page, limit }: PublicOfferingsQuery) {
    return OfferingRepo.listPublic(q, page, limit);
  }

  public static listMine(teacherId: string, { page, limit }: PageQuery) {
    return OfferingRepo.pageByTeacher(teacherId, page, limit);
  }

  public static async create(teacherId: string, input: CreateOfferingInput) {
    try {
      const offering = await OfferingRepo.create(teacherId, input);
      return await OfferingRepo.findPublicById(offering.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new CustomError(Errors.OfferingTaken.status, Errors.OfferingTaken.message);
      throw error;
    }
  }

  public static async update(teacherId: string, id: string, input: UpdateOfferingInput) {
    const offering = await OfferingRepo.findById(id);
    if (!offering || offering.teacherId !== teacherId) {
      throw new CustomError(Errors.OfferingNotFound.status, Errors.OfferingNotFound.message);
    }
    await OfferingRepo.update(id, input);
    return OfferingRepo.findPublicById(id);
  }
}

export default OfferingService;

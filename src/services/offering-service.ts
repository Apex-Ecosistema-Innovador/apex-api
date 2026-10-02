import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import OfferingRepo from '../repositories/offering-repo';
import { CreateOfferingInput, UpdateOfferingInput } from '../validators/offering-validator';

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === '23505';

class OfferingService {
  public static listPublic(search?: string) {
    return OfferingRepo.listPublic(search);
  }

  public static listMine(teacherId: string) {
    return OfferingRepo.listByTeacher(teacherId);
  }

  public static async create(teacherId: string, input: CreateOfferingInput) {
    try {
      const offering = await OfferingRepo.create(teacherId, input);
      const [publicOffering] = (await OfferingRepo.listByTeacher(teacherId)).filter((item) => item.id === offering.id);
      return publicOffering;
    } catch (error) {
      if (isUniqueViolation(error)) throw new CustomError(Errors.OfferingTaken.status, Errors.OfferingTaken.message);
      throw error;
    }
  }

  public static async update(teacherId: string, id: string, input: UpdateOfferingInput) {
    const offering = await OfferingRepo.findById(id);
    if (!offering || offering.teacher_id !== teacherId) {
      throw new CustomError(Errors.OfferingNotFound.status, Errors.OfferingNotFound.message);
    }
    await OfferingRepo.update(id, input);
    const offerings = await OfferingRepo.listByTeacher(teacherId);
    return offerings.find((item) => item.id === id);
  }
}

export default OfferingService;

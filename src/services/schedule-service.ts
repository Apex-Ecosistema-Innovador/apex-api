import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import ScheduleRepo from '../repositories/schedule-repo';
import EnrollmentRepo from '../repositories/enrollment-repo';
import UserRepo from '../repositories/user-repo';
import { parseSchedulePdf } from '../lib/schedule-parser';
import { currentTerm } from '../lib/term';
import type { OfferingCandidate, ScheduleItem, ScheduleOverview, StoredScheduleItem } from '../types/schedule';

const digitsOf = (value: string) => value.replace(/\D/g, '');

const groupByCode = (candidates: OfferingCandidate[]) => {
  const groups = new Map<string, OfferingCandidate[]>();
  for (const candidate of candidates) {
    groups.set(candidate.courseCode, [...(groups.get(candidate.courseCode) ?? []), candidate]);
  }
  return groups;
};

const describe = (item: StoredScheduleItem, candidates: OfferingCandidate[]): ScheduleItem => {
  const linked = candidates.find((candidate) => candidate.enrolled);
  if (linked) {
    return { ...item, status: 'linked', linkedOfferingId: linked.offeringId, options: [] };
  }
  if (candidates.length === 0) {
    return { ...item, status: 'unavailable', linkedOfferingId: null, options: [] };
  }
  return {
    ...item,
    status: 'choose',
    linkedOfferingId: null,
    options: candidates.map(({ offeringId, teacher }) => ({ offeringId, teacher })),
  };
};

class ScheduleService {
  public static async overview(studentId: string): Promise<ScheduleOverview> {
    const term = currentTerm();
    const [uploaded, items] = await Promise.all([ScheduleRepo.uploaded(studentId, term), ScheduleRepo.items(studentId, term)]);
    const candidates = await ScheduleRepo.candidates(
      studentId,
      term,
      items.map((item) => item.courseCode),
    );
    const byCode = groupByCode(candidates);
    return { term, uploaded, items: items.map((item) => describe(item, byCode.get(item.courseCode) ?? [])) };
  }

  public static async sync(studentId: string): Promise<ScheduleOverview> {
    const term = currentTerm();
    const items = await ScheduleRepo.items(studentId, term);
    const candidates = await ScheduleRepo.candidates(
      studentId,
      term,
      items.map((item) => item.courseCode),
    );
    const toLink: string[] = [];
    for (const group of groupByCode(candidates).values()) {
      if (group.length === 1 && !group[0].enrolled) toLink.push(group[0].offeringId);
    }
    await EnrollmentRepo.addMany(studentId, toLink);
    return ScheduleService.overview(studentId);
  }

  public static async upload(studentId: string, file: Buffer): Promise<ScheduleOverview> {
    const student = await UserRepo.findById(studentId);
    if (!student) throw new CustomError(Errors.UserNotFound.status, Errors.UserNotFound.message);

    const parsed = await parseSchedulePdf(file);
    if (digitsOf(student.cedula) !== parsed.document) {
      throw new CustomError(Errors.ScheduleNotYours.status, Errors.ScheduleNotYours.message);
    }
    const term = currentTerm();
    if (parsed.term !== term) {
      throw new CustomError(Errors.ScheduleWrongTerm.status, Errors.ScheduleWrongTerm.message);
    }

    await ScheduleRepo.replace(studentId, term, parsed.courses);
    return ScheduleService.sync(studentId);
  }
}

export default ScheduleService;

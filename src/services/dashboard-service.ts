import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import DashboardRepo from '../repositories/dashboard-repo';
import OfferingRepo from '../repositories/offering-repo';
import UserRepo from '../repositories/user-repo';
import AwardRepo from '../repositories/award-repo';
import EnrollmentRepo from '../repositories/enrollment-repo';
import AuthService from './auth-service';
import { StudentsQuery } from '../validators/dashboard-validator';

const BOM = String.fromCharCode(0xfeff);

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

class DashboardService {
  public static students(teacherId: string, query: StudentsQuery) {
    return DashboardRepo.students(teacherId, query);
  }

  public static async exportCsv(teacherId: string, query: StudentsQuery): Promise<string> {
    const { rows } = await DashboardRepo.students(teacherId, query, false);
    const header = ['Nombre', 'Cédula', 'Asignatura', 'Código', 'Periodo', 'Polipuntos'];
    const lines = rows.map((row) =>
      [row.fullName, row.cedula, row.courseName, row.courseCode, row.term, row.points].map(csvCell).join(','),
    );
    return `${BOM}${[header.map(csvCell).join(','), ...lines].join('\n')}`;
  }

  public static async studentDetail(teacherId: string, studentId: string) {
    const student = await UserRepo.findById(studentId);
    if (!student) throw new CustomError(Errors.UserNotFound.status, Errors.UserNotFound.message);

    const offeringIds = await EnrollmentRepo.sharedOfferingIds(studentId, teacherId);
    if (offeringIds.length === 0) throw new CustomError(Errors.NotEnrolled.status, Errors.NotEnrolled.message);

    const [offerings, totals, history] = await Promise.all([
      OfferingRepo.listByTeacher(teacherId),
      AwardRepo.totalsByOffering(studentId),
      AwardRepo.history(studentId, undefined, teacherId),
    ]);

    return {
      student: AuthService.toPublicUser(student),
      offerings: totals.filter((total) => offeringIds.includes(total.offeringId)),
      history,
      teacherOfferings: offerings,
    };
  }
}

export default DashboardService;

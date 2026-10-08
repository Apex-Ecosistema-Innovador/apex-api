import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import DashboardRepo from '../repositories/dashboard-repo';
import OfferingRepo from '../repositories/offering-repo';
import UserRepo from '../repositories/user-repo';
import AwardRepo from '../repositories/award-repo';
import EnrollmentRepo from '../repositories/enrollment-repo';
import AuthService from './auth-service';
import type { ExportQuery, PageQuery, StudentsQuery } from '../types/inputs';

const BOM = String.fromCharCode(0xfeff);

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

class DashboardService {
  public static students(teacherId: string, query: StudentsQuery) {
    return DashboardRepo.students(teacherId, query);
  }

  public static async exportCsv(teacherId: string, query: ExportQuery): Promise<string> {
    const { rows } = await DashboardRepo.students(teacherId, { ...query, page: 1 });
    const header = ['Nombre', 'Cédula', 'Asignatura', 'Código', 'Periodo', 'Polipuntos'];
    const lines = rows.map((row) =>
      [row.fullName, row.cedula, row.courseName, row.courseCode, row.term, row.points].map(csvCell).join(','),
    );
    return `${BOM}${[header.map(csvCell).join(','), ...lines].join('\n')}`;
  }

  public static async studentDetail(teacherId: string, studentId: string, { page, limit }: PageQuery) {
    const student = await UserRepo.findById(studentId);
    if (!student) throw new CustomError(Errors.UserNotFound.status, Errors.UserNotFound.message);

    const offeringIds = await EnrollmentRepo.sharedOfferingIds(studentId, teacherId);
    if (offeringIds.length === 0) throw new CustomError(Errors.NotEnrolled.status, Errors.NotEnrolled.message);

    const [offerings, totals, history] = await Promise.all([
      OfferingRepo.listByTeacher(teacherId),
      AwardRepo.totalsByOffering(studentId),
      AwardRepo.history(studentId, { teacherId, page, limit }),
    ]);

    return {
      detail: {
        student: AuthService.toPublicUser(student),
        offerings: totals.filter((total) => offeringIds.includes(total.offeringId)),
        history: history.rows,
        historyTotal: history.total,
        teacherOfferings: offerings,
      },
      total: history.total,
    };
  }
}

export default DashboardService;

import Database from '../lib/database';
import UserStatus from '../types/enums/user-status';
import type { OfferingCandidate, StoredScheduleItem } from '../types/schedule';

class ScheduleRepo {
  public static async uploaded(studentId: string, term: string): Promise<boolean> {
    const query = `SELECT 1 AS found FROM student_schedules WHERE student_id = $1 AND term = $2`;
    const rows = await Database.query<{ found: number }>(query, [studentId, term], {
      queryId: 'ScheduleRepo.uploaded',
    });
    return rows.length > 0;
  }

  public static async items(studentId: string, term: string): Promise<StoredScheduleItem[]> {
    const query = `
      SELECT
        student_schedule_items.course_code AS "courseCode",
        student_schedule_items.course_name AS "courseName"
      FROM student_schedules
      JOIN student_schedule_items ON student_schedule_items.schedule_id = student_schedules.id
      WHERE student_schedules.student_id = $1 AND student_schedules.term = $2
      ORDER BY student_schedule_items.course_code
    `;
    return Database.query<StoredScheduleItem>(query, [studentId, term], { queryId: 'ScheduleRepo.items' });
  }

  public static async replace(studentId: string, term: string, courses: StoredScheduleItem[]): Promise<void> {
    await Database.transaction(async (transaction) => {
      const schedules = await transaction.query<{ id: string }>(
        `
          INSERT INTO student_schedules (student_id, term)
          VALUES ($1, $2)
          ON CONFLICT (student_id, term) DO UPDATE SET uploaded_at = now()
          RETURNING id
        `,
        [studentId, term],
        { queryId: 'ScheduleRepo.replace.schedule' },
      );
      const scheduleId = schedules[0].id;
      await transaction.execute(`DELETE FROM student_schedule_items WHERE schedule_id = $1`, [scheduleId], {
        queryId: 'ScheduleRepo.replace.clear',
      });
      await transaction.execute(
        `
          INSERT INTO student_schedule_items (schedule_id, course_code, course_name)
          SELECT $1, course_code, course_name
          FROM unnest($2::text[], $3::text[]) AS course(course_code, course_name)
        `,
        [scheduleId, courses.map((course) => course.courseCode), courses.map((course) => course.courseName)],
        { queryId: 'ScheduleRepo.replace.items' },
      );
    });
  }

  public static async candidates(studentId: string, term: string, codes: string[]): Promise<OfferingCandidate[]> {
    if (codes.length === 0) return [];
    const query = `
      SELECT
        offerings.id AS "offeringId",
        offerings.course_code AS "courseCode",
        json_build_object('id', users.id, 'fullName', users.full_name) AS teacher,
        (enrollments.id IS NOT NULL) AS enrolled
      FROM offerings
      JOIN users ON users.id = offerings.teacher_id
      LEFT JOIN enrollments
        ON enrollments.offering_id = offerings.id AND enrollments.student_id = $1
      WHERE offerings.term = $2
        AND offerings.course_code = ANY($3::text[])
        AND offerings.active = true
        AND users.status = $4
      ORDER BY offerings.course_code, users.full_name
    `;
    return Database.query<OfferingCandidate>(query, [studentId, term, codes, UserStatus.Active], {
      queryId: 'ScheduleRepo.candidates',
    });
  }
}

export default ScheduleRepo;

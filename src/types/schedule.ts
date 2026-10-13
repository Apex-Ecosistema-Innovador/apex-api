export interface ParsedSchedule {
  term: string;
  document: string;
  courses: { courseCode: string; courseName: string }[];
}

export type ScheduleItemStatus = 'linked' | 'choose' | 'unavailable';

export interface ScheduleOption {
  offeringId: string;
  teacher: { id: string; fullName: string };
}

export interface ScheduleItem {
  courseCode: string;
  courseName: string;
  status: ScheduleItemStatus;
  linkedOfferingId: string | null;
  options: ScheduleOption[];
}

export interface ScheduleOverview {
  term: string;
  uploaded: boolean;
  items: ScheduleItem[];
}

export interface StoredScheduleItem {
  courseCode: string;
  courseName: string;
}

export interface OfferingCandidate {
  offeringId: string;
  courseCode: string;
  teacher: { id: string; fullName: string };
  enrolled: boolean;
}

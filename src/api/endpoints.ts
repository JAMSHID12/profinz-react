import { http, get, post, put } from './client';
import type {
  AcademicReport,
  AcademicTest,
  AcademicYear,
  AdminAttendanceDashboard,
  AttendanceMark,
  AttendanceRecord,
  AttendanceReport,
  AttendanceSheet,
  AuditEntry,
  AuthResponse,
  Batch,
  BatchHistoryEntry,
  BatchPerformanceRow,
  BatchSyllabus,
  BulkResult,
  Course,
  DisciplineRecord,
  DisciplineType,
  EntryExit,
  Exam,
  ExamType,
  Faculty,
  FacultyAssignment,
  FacultyDashboardData,
  FeePlan,
  FeeReport,
  FeeSummary,
  Fine,
  Inbox,
  Installment,
  MarksSheet,
  Mentor,
  MentorDashboardData,
  MessageLog,
  NotificationReport,
  PageResponse,
  ParentMeeting,
  Payment,
  PermissionInfo,
  PortalAttendance,
  PortalDashboard,
  PortalExamResult,
  PortalTestResult,
  ProgressCard,
  PublicConfig,
  PublicationStatus,
  Receipt,
  RegisterEntry,
  RoleInfo,
  ScheduleConflict,
  ScheduleEntry,
  SessionUser,
  SettingsView,
  StaffSummary,
  StudentAttendanceDetail,
  StudentDetail,
  StudentPerformance,
  StudentRow,
  Subject,
  SyllabusProgressRow,
  SyllabusTopic,
  TakerClass,
  UpcomingExam,
  UserAccount,
} from '../types';

type Body = Record<string, unknown>;
type Filters = Record<string, string | number | boolean | null | undefined>;

/** Calls without a response body resolve to true, so callers can tell success from failure. */
const done = () => true as const;

export const configApi = {
  publicConfig: () => get<PublicConfig>('/config/public'),
  settings: () => get<SettingsView>('/settings'),
};

export const authApi = {
  login: (username: string, password: string) => post<AuthResponse>('/auth/login', { username, password }),
  me: () => get<SessionUser>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<void>('/auth/change-password', { currentPassword, newPassword }).then(done),
};

export const dashboardApi = {
  summary: () => get<StaffSummary>('/dashboard/summary'),
  mentor: () => get<MentorDashboardData>('/dashboard/mentor'),
  faculty: () => get<FacultyDashboardData>('/dashboard/faculty'),
  /** The administrator's attendance and discipline dashboard (default: the last 30 days). */
  admin: (filters?: Filters) => get<AdminAttendanceDashboard>('/dashboard/admin', filters),
  studentAttendance: (studentId: number, filters?: Filters) =>
    get<StudentAttendanceDetail>(`/dashboard/attendance/students/${studentId}`, filters),
};

export const academicApi = {
  courses: (activeOnly = false) => get<Course[]>('/courses', { activeOnly }),
  saveCourse: (id: number | undefined, body: Body) => (id ? put<Course>(`/courses/${id}`, body) : post<Course>('/courses', body)),
  subjects: (courseId?: number) => get<Subject[]>('/subjects', { courseId }),
  saveSubject: (id: number | undefined, body: Body) =>
    id ? put<Subject>(`/subjects/${id}`, body) : post<Subject>('/subjects', body),
  years: () => get<AcademicYear[]>('/academic-years'),
  saveYear: (id: number | undefined, body: Body) =>
    id ? put<AcademicYear>(`/academic-years/${id}`, body) : post<AcademicYear>('/academic-years', body),
  batches: (filters?: Filters) => get<Batch[]>('/batches', filters),
  saveBatch: (id: number | undefined, body: Body) => (id ? put<Batch>(`/batches/${id}`, body) : post<Batch>('/batches', body)),
};

export const staffApi = {
  mentors: () => get<Mentor[]>('/mentors'),
  saveMentor: (id: number | undefined, body: Body) => (id ? put<Mentor>(`/mentors/${id}`, body) : post<Mentor>('/mentors', body)),
  faculty: () => get<Faculty[]>('/faculty'),
  saveFaculty: (id: number | undefined, body: Body) =>
    id ? put<Faculty>(`/faculty/${id}`, body) : post<Faculty>('/faculty', body),
  assignments: (filters?: Filters) => get<FacultyAssignment[]>('/faculty-assignments', filters),
  assign: (body: Body) => post<FacultyAssignment>('/faculty-assignments', body),
  setAssignmentActive: (id: number, value: boolean) =>
    put<FacultyAssignment>(`/faculty-assignments/${id}/active`, undefined, { value }),
};

export const studentApi = {
  search: (filters?: Filters) => get<StudentRow[]>('/students', filters),
  detail: (id: number) => get<StudentDetail>(`/students/${id}`),
  history: (id: number) => get<BatchHistoryEntry[]>(`/students/${id}/batch-history`),
  save: async (id: number | undefined, body: Body, photo?: File | null) => {
    const form = new FormData();
    form.append('student', new Blob([JSON.stringify(body)], { type: 'application/json' }));
    if (photo) form.append('photo', photo);
    const response = await http.request<{ data: StudentDetail }>({
      method: id ? 'PUT' : 'POST', url: id ? `/students/${id}` : '/students',
      data: form, headers: { 'Content-Type': undefined },
    });
    return response.data.data;
  },
  transfer: (id: number, body: Body) => post<StudentDetail>(`/students/${id}/transfer`, body),
  createLogin: (id: number, password?: string) =>
    post<StudentDetail>(`/students/${id}/login`, password ? { password } : {}),
};


export const scheduleApi = {
  search: (filters?: Filters) => get<ScheduleEntry[]>('/schedules', filters),
  conflicts: (body: Body, excludeId?: number) => post<ScheduleConflict[]>('/schedules/conflicts', body, { excludeId }),
  create: (body: Body) => post<ScheduleEntry[]>('/schedules', body),
  update: (id: number, body: Body) => put<ScheduleEntry>(`/schedules/${id}`, body),
  register: (filters?: Filters) => get<RegisterEntry[]>('/class-register', filters),
  recordRegister: (body: Body) => post<RegisterEntry>('/class-register', body),
  entries: (filters?: Filters) => get<EntryExit[]>('/faculty-entry-exit', filters),
  saveEntry: (id: number | undefined, body: Body) =>
    id ? put<EntryExit>(`/faculty-entry-exit/${id}`, body) : post<EntryExit>('/faculty-entry-exit', body),
};

export const attendanceApi = {
  /** Mentors and faculty only: what the signed-in user takes attendance for on a date. */
  classes: (date: string) => get<TakerClass[]>('/attendance/classes', { date }),
  sheet: (batchId: number, date: string, scheduleId?: number) =>
    get<AttendanceSheet>('/attendance/sheet', { batchId, date, scheduleId }),
  saveBulk: (body: {
    batchId: number;
    date: string;
    scheduleId?: number;
    entries: (AttendanceMark & { studentId: number })[];
  }) => post<BulkResult>('/attendance/bulk', body),
  update: (id: number, mark: AttendanceMark) => put<AttendanceRecord>(`/attendance/${id}`, mark),
  history: (filters?: Filters) => get<PageResponse<AttendanceRecord>>('/attendance', filters),
};

export const assessmentApi = {
  tests: (filters?: Filters) => get<AcademicTest[]>('/tests', filters),
  saveTest: (id: number | undefined, body: Body) =>
    id ? put<AcademicTest>(`/tests/${id}`, body) : post<AcademicTest>('/tests', body),
  testSheet: (id: number) => get<MarksSheet>(`/tests/${id}/results`),
  saveTestMarks: (id: number, entries: Body[]) => put<MarksSheet>(`/tests/${id}/results`, { entries }),
  testStatus: (id: number, status: PublicationStatus) => post<AcademicTest>(`/tests/${id}/status`, { status }),
  exams: (filters?: Filters) => get<Exam[]>('/exams', filters),
  saveExam: (id: number | undefined, body: Body) => (id ? put<Exam>(`/exams/${id}`, body) : post<Exam>('/exams', body)),
  examSheet: (id: number) => get<MarksSheet>(`/exams/${id}/results`),
  saveExamMarks: (id: number, entries: Body[]) => put<MarksSheet>(`/exams/${id}/results`, { entries }),
  examStatus: (id: number, status: PublicationStatus) => post<Exam>(`/exams/${id}/status`, { status }),
  examTypes: () => get<ExamType[]>('/exam-types'),
  saveExamType: (id: number | undefined, body: Body) =>
    id ? put<ExamType>(`/exam-types/${id}`, body) : post<ExamType>('/exam-types', body),
};

export const performanceApi = {
  student: (id: number, filters?: Filters) => get<StudentPerformance>(`/performance/students/${id}`, filters),
  batch: (id: number, filters?: Filters) => get<BatchPerformanceRow[]>(`/performance/batches/${id}`, filters),
};

export const progressApi = {
  search: (filters?: Filters) => get<ProgressCard[]>('/progress-cards', filters),
  detail: (id: number) => get<ProgressCard>(`/progress-cards/${id}`),
  generate: (body: Body) => post<ProgressCard[]>('/progress-cards/generate', body),
  update: (id: number, body: Body) => put<ProgressCard>(`/progress-cards/${id}`, body),
  status: (id: number, status: PublicationStatus) => post<ProgressCard>(`/progress-cards/${id}/status`, { status }),
};

export const syllabusApi = {
  topics: (filters?: Filters) => get<SyllabusTopic[]>('/syllabus/topics', filters),
  saveTopic: (id: number | undefined, body: Body) =>
    id ? put<SyllabusTopic>(`/syllabus/topics/${id}`, body) : post<SyllabusTopic>('/syllabus/topics', body),
  progress: (batchId: number, subjectId?: number) => get<BatchSyllabus>('/syllabus/progress', { batchId, subjectId }),
  updateProgress: (batchId: number, topicId: number, body: Body) =>
    put<SyllabusProgressRow>(`/syllabus/progress/${batchId}/${topicId}`, body),
};

export const disciplineApi = {
  records: (filters?: Filters) => get<DisciplineRecord[]>('/discipline-records', filters),
  saveRecord: (id: number | undefined, body: Body) =>
    id ? put<DisciplineRecord>(`/discipline-records/${id}`, body) : post<DisciplineRecord>('/discipline-records', body),
  fines: (filters?: Filters) => get<Fine[]>('/fines', filters),
  createFine: (body: Body) => post<Fine>('/fines', body),
  fineStatus: (id: number, body: Body) => post<Fine>(`/fines/${id}/status`, body),
  types: () => get<DisciplineType[]>('/discipline-types'),
  saveType: (id: number | undefined, body: Body) =>
    id ? put<DisciplineType>(`/discipline-types/${id}`, body) : post<DisciplineType>('/discipline-types', body),
};

export const meetingApi = {
  search: (filters?: Filters) => get<ParentMeeting[]>('/parent-meetings', filters),
  save: (id: number | undefined, body: Body) =>
    id ? put<ParentMeeting>(`/parent-meetings/${id}`, body) : post<ParentMeeting>('/parent-meetings', body),
};

export const feeApi = {
  plans: (studentId?: number) => get<FeePlan[]>('/fees/plans', { studentId }),
  /** The fee comes from the course master; only the student's discount is sent. */
  createPlan: (body: Body) => post<FeePlan>('/fees/plans', body),
  createBulk: (body: Body) => post<{ created: FeePlan[]; skipped: number }>('/fees/plans/bulk', body),
  changeDiscount: (id: number, discountAmount: number, reason?: string) =>
    put<FeePlan>(`/fees/plans/${id}/discount`, { discountAmount, reason }),
  updatePlan: (id: number, body: Body) => put<FeePlan>(`/fees/plans/${id}`, body),
  installments: (filters?: Filters) => get<Installment[]>('/fees/installments', filters),
  waive: (id: number) => post<Installment>(`/fees/installments/${id}/waive`),
  remind: (id: number) => post<void>(`/fees/installments/${id}/reminder`).then(done),
  studentSummary: (studentId: number) => get<FeeSummary>(`/fees/student/${studentId}`),
  payments: (filters?: Filters) => get<PageResponse<Payment>>('/payments', filters),
  recordPayment: (body: Body) => post<Payment>('/payments', body),
  receipt: (id: number) => get<Receipt>(`/payments/${id}/receipt`),
};

export const messageApi = {
  logs: (filters?: Filters) => get<PageResponse<MessageLog>>('/whatsapp/messages', filters),
  retry: (id: number) => post<MessageLog>(`/whatsapp/messages/${id}/retry`),
  test: (phoneNumber: string, message?: string, parameters?: string[]) => post<unknown>('/whatsapp/test', { phoneNumber, message, parameters }),
};

export const reportApi = {
  attendance: (filters?: Filters) => get<AttendanceReport>('/reports/attendance', filters),
  fees: (filters?: Filters) => get<FeeReport>('/reports/fees', filters),
  notifications: (filters?: Filters) => get<NotificationReport>('/reports/notifications', filters),
  academic: (filters: Filters) => get<AcademicReport>('/reports/academic', filters),
};

export const adminApi = {
  users: (search?: string) => get<UserAccount[]>('/users', { search }),
  saveUser: (id: number | undefined, body: Body) =>
    id ? put<UserAccount>(`/users/${id}`, body) : post<UserAccount>('/users', body),
  resetPassword: (id: number, newPassword: string) => put<void>(`/users/${id}/password`, { newPassword }).then(done),
  roles: () => get<RoleInfo[]>('/rbac/roles'),
  permissions: () => get<PermissionInfo[]>('/rbac/permissions'),
  setRolePermissions: (code: string, permissions: string[]) =>
    put<RoleInfo>(`/rbac/roles/${code}/permissions`, { permissions }),
  audit: (filters?: Filters) => get<PageResponse<AuditEntry>>('/audit-logs', filters),
};

/** Student self-service. No ids: the server resolves the student from the login. */
export const portalApi = {
  profile: () => get<StudentDetail>('/students/me'),
  dashboard: () => get<PortalDashboard>('/students/me/dashboard'),
  schedule: (from?: string, to?: string) => get<ScheduleEntry[]>('/students/me/schedule', { from, to }),
  attendance: (from?: string, to?: string) => get<PortalAttendance>('/students/me/attendance', { from, to }),
  tests: (type?: string) => get<PortalTestResult[]>('/students/me/tests', { type }),
  exams: () => get<{ upcoming: UpcomingExam[]; results: PortalExamResult[] }>('/students/me/exams'),
  performance: () => get<StudentPerformance>('/students/me/performance'),
  progressCards: () => get<ProgressCard[]>('/students/me/progress-cards'),
  progressCard: (id: number) => get<ProgressCard>(`/students/me/progress-cards/${id}`),
  discipline: () => get<DisciplineRecord[]>('/students/me/discipline'),
  fines: () => get<Fine[]>('/students/me/fines'),
  fees: () => get<FeeSummary>('/students/me/fees'),
  syllabus: () => get<BatchSyllabus>('/students/me/syllabus'),
  notifications: () => get<Inbox>('/students/me/notifications'),
  markRead: () => post<void>('/students/me/notifications/read').then(done),
};

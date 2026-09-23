// Shapes returned by the backend. Null fields are omitted by the API, hence the optionals.

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data: T;
  errors?: Record<string, string>;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface Ref {
  id: number;
  name: string;
}

// ---- Configuration and session ------------------------------------------------

export type RoleCode =
  | 'DIRECTORS'
  | 'ADMINISTRATIVE'
  | 'SALES'
  | 'ACCOUNTS'
  | 'ACADEMICS'
  | 'STUDENTS'
  | 'MENTORS'
  | 'FACULTY';

export type ModuleKey =
  | 'academics'
  | 'administration'
  | 'fees'
  | 'notifications'
  | 'reports'
  | 'studentPortal'
  | 'sales'
  | 'accounts'
  | 'directors';

export interface PublicConfig {
  client: {
    code: string;
    name: string;
    tagline?: string;
    logo?: string;
    currency?: string;
    locale?: string;
    timezone?: string;
  };
  branding: { primaryColor?: string; loginMessage?: string };
  modules: Record<ModuleKey, boolean>;
  roles: Record<string, boolean>;
  features: { performance: boolean; studentSyllabus: boolean };
}

export type Portal = 'STAFF' | 'MENTOR' | 'FACULTY' | 'STUDENT';

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  roles: RoleCode[];
  permissions: string[];
  studentId?: number;
  mentorId?: number;
  facultyId?: number;
  mustChangePassword: boolean;
  portal: Portal;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: SessionUser;
}

// ---- Users and roles ------------------------------------------------------------

export interface UserAccount {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  mobile?: string;
  roles: RoleCode[];
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface RoleInfo {
  code: RoleCode;
  name: string;
  description?: string;
  enabled: boolean;
  activeUsers: number;
  permissions: string[];
}

export interface PermissionInfo {
  code: string;
  name: string;
  module: string;
}

export interface AuditEntry {
  id: number;
  entityType: string;
  entityId?: number;
  action: string;
  summary: string;
  details?: string;
  performedByName?: string;
  performedAt: string;
}

// ---- Academic structure -------------------------------------------------------------

export type RecordStatus = 'ACTIVE' | 'INACTIVE';

export interface Course {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: RecordStatus;
  displayOrder: number;
  /** Standard fee billed to every student of the course (master data). */
  feeAmount?: number;
  defaultInstallments?: number;
  subjectCount: number;
}

export interface Subject {
  id: number;
  course: Ref;
  code: string;
  name: string;
  description?: string;
  status: RecordStatus;
  displayOrder: number;
}

export interface AcademicYear {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  current: boolean;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
}

export interface Batch {
  id: number;
  name: string;
  course: Ref;
  academicYear: Ref;
  mentor?: Ref;
  startDate?: string;
  endDate?: string;
  capacity?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'INACTIVE';
  description?: string;
  studentCount: number;
}

export interface Mentor {
  id: number;
  fullName: string;
  employeeCode?: string;
  mobile?: string;
  email?: string;
  specialization?: string;
  active: boolean;
  username?: string;
  batchCount: number;
}

export type FacultyType = 'FULL_TIME' | 'GUEST' | 'VISITING';

export interface Faculty {
  id: number;
  fullName: string;
  employeeCode?: string;
  mobile?: string;
  email?: string;
  facultyType?: FacultyType;
  specialization?: string;
  active: boolean;
  username?: string;
}

export interface FacultyAssignment {
  id: number;
  faculty: Ref;
  batch: Ref;
  subject: Ref;
  active: boolean;
}

// ---- Students and parents --------------------------------------------------------------

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'COMPLETED' | 'DROPPED' | 'SUSPENDED';

export interface ParentSummary {
  name: string;
  relation?: string;
  phoneNumber: string;
  whatsappNumber?: string;
  email?: string;
  whatsappOptIn: boolean;
}

export interface StudentRow {
  id: number;
  studentCode?: string;
  admissionNumber: string;
  fullName: string;
  mobile?: string;
  email?: string;
  course?: Ref;
  batch?: Ref;
  parent?: ParentSummary;
  admissionDate?: string;
  status: StudentStatus;
  username?: string;
}

export interface StudentDetail extends StudentRow {
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  photoUrl?: string;
  academicYear?: Ref;
  mentor?: Ref;
}

export interface BatchHistoryEntry {
  id: number;
  batch: Ref;
  course: Ref;
  academicYear: Ref;
  startDate: string;
  endDate?: string;
  status: 'CURRENT' | 'COMPLETED' | 'TRANSFERRED';
  reason?: string;
}


// ---- Schedule and teaching -----------------------------------------------------------------

export type ScheduleStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface ScheduleEntry {
  id: number;
  batch: Ref;
  course: Ref;
  subject: Ref;
  faculty?: Ref;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  room?: string;
  status: ScheduleStatus;
  notes?: string;
}

export interface ScheduleConflict {
  type: 'FACULTY' | 'BATCH' | 'ROOM';
  date: string;
  message: string;
  existing?: ScheduleEntry;
}

export interface RegisterEntry {
  id: number;
  schedule: ScheduleEntry;
  faculty?: Ref;
  actualStart: string;
  actualEnd: string;
  topicCovered: string;
  studentCount?: number;
  remarks?: string;
}

export interface EntryExit {
  id: number;
  faculty: Ref;
  entryDate: string;
  sessionLabel: string;
  entryTime: string;
  exitTime?: string;
  remarks?: string;
}

// ---- Attendance ------------------------------------------------------------------------------

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type AbsenceReason = 'MEDICAL' | 'PERSONAL' | 'OTHER';

export interface AttendanceSummary {
  totalClasses: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
}

/** A whole-day register (no scheduleId) or one class the signed-in mentor or faculty member takes. */
export interface TakerClass {
  batch: Ref;
  scheduleId?: number;
  subject?: Ref;
  startTime?: string;
  endTime?: string;
  room?: string;
  faculty?: Ref;
  students: number;
  marked: number;
}

/** The details recorded with a mark, as the sheet and corrections send them. */
export interface AttendanceMark {
  status: AttendanceStatus;
  lateMinutes?: number;
  absenceReason?: AbsenceReason;
  noUniform: boolean;
  noIdTag: boolean;
  remarks?: string;
}

export interface SheetRow {
  attendanceId?: number;
  studentId: number;
  admissionNumber: string;
  fullName: string;
  photoUrl?: string;
  /** Missing until the sheet has been saved once; the screen starts such rows as present. */
  status?: AttendanceStatus;
  lateMinutes?: number;
  absenceReason?: AbsenceReason;
  noUniform: boolean;
  noIdTag: boolean;
  remarks?: string;
  parentNotifiable: boolean;
}

export interface AttendanceSheet {
  batch: Ref;
  date: string;
  schedule?: ScheduleEntry;
  alreadyMarked: boolean;
  markedAt?: string;
  markedBy?: string;
  /** Whether the signed-in user may save this sheet (mentor of the batch or faculty of the class). */
  canMark: boolean;
  classesThatDay: ScheduleEntry[];
  rows: SheetRow[];
}

export interface BulkResult {
  saved: number;
  created: number;
  updated: number;
  notificationsQueued: number;
  notificationsSkipped: number;
  observationsRecorded: number;
}

export interface AttendanceRecord {
  id: number;
  student: Ref;
  admissionNumber: string;
  batch: Ref;
  subject?: Ref;
  date: string;
  status: AttendanceStatus;
  lateMinutes?: number;
  absenceReason?: AbsenceReason;
  noUniform: boolean;
  noIdTag: boolean;
  remarks?: string;
  markedAt?: string;
  notificationStatus?: 'NOT_REQUIRED' | 'QUEUED' | 'SKIPPED';
  canCorrect: boolean;
}

// ---- Assessments -------------------------------------------------------------------------------

export type PublicationStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED';
export type TestType = 'DAILY' | 'WEEKLY';

export interface AcademicTest {
  id: number;
  testType: TestType;
  title: string;
  batch: Ref;
  subject: Ref;
  testDate: string;
  weekNumber?: number;
  maxMarks: number;
  status: PublicationStatus;
  remarks?: string;
  publishedAt?: string;
  resultCount: number;
}

export interface Exam {
  id: number;
  name: string;
  examType: Ref;
  course: Ref;
  batch: Ref;
  subject: Ref;
  examDate: string;
  startTime?: string;
  endTime?: string;
  maxMarks: number;
  passingMarks: number;
  faculty?: Ref;
  status: PublicationStatus;
  remarks?: string;
  publishedAt?: string;
  resultCount: number;
}

export interface MarksRow {
  studentId: number;
  admissionNumber: string;
  fullName: string;
  marksObtained?: number;
  absent: boolean;
  grade?: string;
  remarks?: string;
}

export interface MarksSheet {
  assessmentId: number;
  title: string;
  batch: Ref;
  subject: Ref;
  date: string;
  maxMarks: number;
  passingMarks?: number;
  status: PublicationStatus;
  editable: boolean;
  rows: MarksRow[];
}

export interface ExamType {
  id: number;
  code: string;
  name: string;
  displayOrder: number;
  active: boolean;
}

export interface Assessment {
  date: string;
  kind: string;
  title: string;
  subject: Ref;
  marks?: number;
  maxMarks: number;
  absent: boolean;
  percentage?: number;
  grade?: string;
}

export interface SubjectPerformance {
  subject: Ref;
  testAverage?: number;
  examAverage?: number;
  overall?: number;
  grade?: string;
  assessments: number;
}

export interface StudentPerformance {
  student: Ref;
  from: string;
  to: string;
  dailyTestAverage?: number;
  weeklyTestAverage?: number;
  examAverage?: number;
  attendancePercentage?: number;
  attendance: AttendanceSummary;
  overall?: number;
  grade?: string;
  weights: { dailyTest: number; weeklyTest: number; exam: number; attendance: number };
  subjects: SubjectPerformance[];
  trend: Assessment[];
}

export interface BatchPerformanceRow {
  student: Ref;
  admissionNumber: string;
  overall?: number;
  grade?: string;
  attendancePercentage?: number;
  examAverage?: number;
}

export interface ProgressCardItem {
  id: number;
  subject?: Ref;
  subjectName: string;
  testAverage?: number;
  examAverage?: number;
  overallPercentage?: number;
  grade?: string;
  remarks?: string;
}

export interface ProgressCard {
  id: number;
  student: Ref;
  admissionNumber: string;
  batch?: Ref;
  title: string;
  periodStart: string;
  periodEnd: string;
  attendancePercentage?: number;
  dailyTestAverage?: number;
  weeklyTestAverage?: number;
  examAverage?: number;
  performanceScore?: number;
  grade?: string;
  syllabusCompletion?: number;
  disciplineCount: number;
  pendingFineAmount?: number;
  mentorRemarks?: string;
  status: PublicationStatus;
  publishedAt?: string;
  items?: ProgressCardItem[];
}

// ---- Syllabus -----------------------------------------------------------------------------------

export type SyllabusStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';

export interface SyllabusTopic {
  id: number;
  course: Ref;
  subject: Ref;
  title: string;
  description?: string;
  sequenceNo: number;
  plannedHours?: number;
  active: boolean;
}

export interface SyllabusProgressRow {
  topicId: number;
  subject: Ref;
  title: string;
  sequenceNo: number;
  plannedDate?: string;
  completedDate?: string;
  status: SyllabusStatus;
  remarks?: string;
}

export interface BatchSyllabus {
  batch: Ref;
  completion: number;
  subjects: { subject: Ref; totalTopics: number; completedTopics: number; completion: number }[];
  topics: SyllabusProgressRow[];
}

// ---- Discipline, fines, meetings ---------------------------------------------------------------------

export interface DisciplineType {
  id: number;
  code: string;
  name: string;
  defaultFineAmount?: number;
  displayOrder: number;
  active: boolean;
}

export interface DisciplineRecord {
  id: number;
  student: Ref;
  admissionNumber: string;
  batch?: Ref;
  disciplineType: Ref;
  incidentDate: string;
  description: string;
  actionTaken?: string;
  status: 'OPEN' | 'RESOLVED';
}

export type FineStatus = 'PENDING' | 'PAID' | 'WAIVED' | 'CANCELLED';

export interface Fine {
  id: number;
  student: Ref;
  admissionNumber: string;
  batch?: Ref;
  reason: string;
  amount: number;
  fineDate: string;
  dueDate?: string;
  status: FineStatus;
  paidDate?: string;
  paymentReference?: string;
  remarks?: string;
}

export type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'FOLLOW_UP';

export interface ParentMeeting {
  id: number;
  student: Ref;
  parent?: ParentSummary;
  mentor?: Ref;
  meetingDate: string;
  discussion?: string;
  academicIssues?: string;
  attendanceIssues?: string;
  disciplineIssues?: string;
  actionItems?: string;
  followUpDate?: string;
  status: MeetingStatus;
}

// ---- Fees ----------------------------------------------------------------------------------------------

export type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CARD' | 'CHEQUE' | 'OTHER';

export interface Installment {
  id: number;
  planId: number;
  planTitle: string;
  student: Ref;
  admissionNumber: string;
  batch?: Ref;
  installmentNo: number;
  label: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  pendingAmount: number;
  status: InstallmentStatus;
  reminderCount: number;
  lastReminderDate?: string;
}

export interface FeePlan {
  id: number;
  student: Ref;
  admissionNumber: string;
  title: string;
  course?: Ref;
  academicYear?: Ref;
  /** The course fee when the plan was created. */
  totalAmount: number;
  /** This student's own discount, and why. */
  discountAmount: number;
  discountReason?: string;
  netAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'ACTIVE' | 'CLOSED' | 'CANCELLED';
  notes?: string;
  installments: Installment[];
}

export interface Payment {
  id: number;
  receiptNumber: string;
  student: Ref;
  admissionNumber: string;
  installmentId: number;
  installmentLabel: string;
  planTitle: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  createdAt?: string;
}

export interface Receipt {
  centreName: string;
  receiptNumber: string;
  paymentDate: string;
  studentName: string;
  admissionNumber: string;
  planTitle: string;
  installmentLabel: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  installmentBalance: number;
  currency?: string;
}

export interface FeeSummary {
  totalFee: number;
  discount: number;
  netFee: number;
  paid: number;
  outstanding: number;
  overdue: number;
  nextDueAmount?: number;
  nextDueDate?: string;
  plans: FeePlan[];
  payments: Payment[];
}

// ---- Notifications ------------------------------------------------------------------------------------------

export type NotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';
export type NotificationChannel = 'WHATSAPP' | 'IN_APP' | 'SMS' | 'EMAIL';

export interface MessageLog {
  id: number;
  eventType: string;
  channel: NotificationChannel;
  recipientType: 'PARENT' | 'STUDENT';
  studentId?: number;
  studentName?: string;
  parentName?: string;
  destination?: string;
  templateName?: string;
  title?: string;
  preview?: string;
  status: NotificationStatus;
  retryCount: number;
  errorMessage?: string;
  scheduledAt?: string;
  sentAt?: string;
  createdAt?: string;
}

export interface InboxItem {
  id: number;
  eventType: string;
  title?: string;
  message?: string;
  createdAt: string;
  read: boolean;
}

export interface Inbox {
  unread: number;
  items: InboxItem[];
}

// ---- Dashboards -----------------------------------------------------------------------------------------------

export interface AttendanceToday {
  present: number;
  absent: number;
  late: number;
  excused: number;
  marked: number;
  batchesMarked: number;
  activeBatches: number;
}

export interface StaffSummary {
  date: string;
  activeStudents: number;
  activeBatches: number;
  activeCourses: number;
  mentors: number;
  faculty: number;
  attendance: AttendanceToday;
  todaysClasses: ScheduleEntry[];
  upcomingExams: Exam[];
  resultsAwaitingReview: number;
  progressCardsAwaitingReview: number;
  pendingFines?: number;
  feesOutstanding?: number;
  feesOverdue?: number;
  queuedMessages?: number;
  failedMessages?: number;
  recentMessages: MessageLog[];
}

export interface MentorDashboardData {
  date: string;
  batches: { batch: Batch; attendanceMarkedToday: boolean; syllabusCompletion: number }[];
  students: number;
  attendance: AttendanceToday;
  absentOrLateToday: AttendanceRecord[];
  recentTests: AcademicTest[];
  pendingProgressCards: ProgressCard[];
  upcomingExams: Exam[];
  upcomingParentMeetings: ParentMeeting[];
}

export type RiskLevel = 'CRITICAL' | 'AT_RISK' | 'MONITOR' | 'OK';

export interface AttendanceTrendPoint {
  start: string;
  end: string;
  /** The ISO date for daily points, "W1", "W2"... for weekly ones. */
  label: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
}

export interface StudentRisk {
  studentId: number;
  fullName: string;
  admissionNumber: string;
  photoUrl?: string;
  batch?: Ref;
  summary: AttendanceSummary;
  absences: number;
  late: number;
  noUniform: number;
  noIdTag: number;
  otherIssues: number;
  issues: number;
  risk: RiskLevel;
}

/** The administrator's attendance and discipline dashboard (administrators only). */
export interface AdminAttendanceDashboard {
  from: string;
  to: string;
  asOf: string;
  courseId?: number;
  batchId?: number;
  mentorId?: number;
  activeStudents: number;
  totals: AttendanceSummary;
  /** The period of the same length just before; missing when it has no attendance. */
  previousTotals?: AttendanceSummary;
  today: { marked: number; present: number; late: number; absent: number; absentWithoutReason: number; notMarked: number };
  studentsAtRisk: number;
  granularity: 'DAY' | 'WEEK';
  trend: AttendanceTrendPoint[];
  /** Filled only when comparing with the previous period. */
  previousTrend: AttendanceTrendPoint[];
  /** Lowest attendance first. */
  classes: { batch: Ref; course: Ref; mentor?: Ref; students: number; summary: AttendanceSummary }[];
  discipline: { late: number; noUniform: number; noIdTag: number; other: number; open: number };
  disciplineWeeks: { start: string; end: string; label: string; late: number; noUniform: number; noIdTag: number; other: number }[];
  absenceReasons: { key: string; label: string; count: number }[];
  weekdays: { day: string; marks: number; attended: number }[];
  /** Most serious risk first, then the lowest attendance. */
  students: StudentRisk[];
}

export interface StudentAttendanceDetail {
  studentId: number;
  fullName: string;
  admissionNumber: string;
  photoUrl?: string;
  batch?: Ref;
  from: string;
  to: string;
  summary: AttendanceSummary;
  /** One entry per day with marks: the most serious status that day. */
  days: { date: string; status: AttendanceStatus; marks: number }[];
  /** Newest first. */
  records: AttendanceRecord[];
}

export interface FacultyDashboardData {
  date: string;
  todaysClasses: ScheduleEntry[];
  upcomingClasses: ScheduleEntry[];
  batches: Ref[];
  subjects: Ref[];
  pendingMarks: {
    kind: string;
    id: number;
    title: string;
    batch: Ref;
    subject: Ref;
    date: string;
    entered: number;
    students: number;
  }[];
  syllabus: { batch: Ref; subject: Ref; totalTopics: number; completedTopics: number; completion: number }[];
  todaysEntries: EntryExit[];
}

// ---- Student portal ---------------------------------------------------------------------------------------------

export interface PortalTestResult {
  date: string;
  type: string;
  title: string;
  subject: Ref;
  weekNumber?: number;
  marksObtained?: number;
  maxMarks: number;
  absent: boolean;
  percentage?: number;
  grade?: string;
  remarks?: string;
}

export interface PortalExamResult {
  date: string;
  examName: string;
  examType: string;
  subject: Ref;
  marksObtained?: number;
  maxMarks: number;
  passingMarks: number;
  absent: boolean;
  percentage?: number;
  grade?: string;
  result: 'PASS' | 'FAIL' | 'ABSENT';
  remarks?: string;
}

export interface UpcomingExam {
  id: number;
  date: string;
  startTime?: string;
  endTime?: string;
  name: string;
  examType: string;
  subject: Ref;
}

export interface PortalDashboard {
  fullName: string;
  admissionNumber: string;
  course?: Ref;
  batch?: Ref;
  mentor?: Ref;
  academicYear?: Ref;
  attendancePercentage?: number;
  performance?: number;
  grade?: string;
  pendingFines?: number;
  feeBalance?: number;
  nextDueAmount?: number;
  nextDueDate?: string;
  upcomingExams: UpcomingExam[];
  todaysClasses: ScheduleEntry[];
  recentResults: PortalExamResult[];
  unreadNotifications: number;
  feesEnabled: boolean;
}

export interface PortalAttendance {
  from: string;
  to: string;
  summary: AttendanceSummary;
  history: { date: string; subject?: Ref; status: AttendanceStatus; remarks?: string }[];
}

// ---- Reports and settings ------------------------------------------------------------------------------------------

export interface AttendanceReport {
  from: string;
  to: string;
  batchId?: number;
  totals: AttendanceSummary;
  rows: {
    studentId: number;
    studentName: string;
    admissionNumber: string;
    batchName?: string;
    summary: AttendanceSummary;
  }[];
}

export interface FeeReport {
  from: string;
  to: string;
  billed: number;
  paid: number;
  pending: number;
  collectedInPeriod: number;
  rows: { status: InstallmentStatus; installments: number; billed: number; paid: number; pending: number }[];
}

export interface NotificationReport {
  from: string;
  to: string;
  total: number;
  byStatus: { label: string; count: number }[];
  byEvent: { label: string; count: number }[];
  byChannel: { label: string; count: number }[];
}

export interface AcademicReport {
  batchId: number;
  from: string;
  to: string;
  students: BatchPerformanceRow[];
}

export interface SettingsView {
  client: Record<string, string | undefined>;
  branding: Record<string, string | undefined>;
  modules: Record<string, boolean>;
  roles: Record<string, boolean>;
  academics: {
    performanceEnabled: boolean;
    weights: Record<string, number>;
    grades: { grade: string; min: number }[];
    studentSyllabusVisible: boolean;
  };
  channels: Record<string, boolean>;
  events: Record<string, string[]>;
  whatsapp: Record<string, unknown> & { templates?: Record<string, string> };
  fees: Record<string, unknown>;
  database: Record<string, unknown>;
}

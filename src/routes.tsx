import ExcelImportPage from './pages/imports/ExcelImportPage';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  FileBadge,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  Layers,
  ListChecks,
  MessageSquare,
  NotebookPen,
  Receipt,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
  UsersRound,
  UserRound,
  Wallet,
  Bell,
  Database,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ATTENDANCE_TAKERS } from './access';
import type { AppRoute } from './access';
import { useAuth } from './context/AuthContext';
import AdminDashboard from './pages/home/AdminDashboard';
import StaffDashboard from './pages/home/StaffDashboard';
import MentorDashboard from './pages/home/MentorDashboard';
import FacultyDashboard from './pages/home/FacultyDashboard';
import PortalDashboard from './pages/portal/PortalDashboard';
import {
  PortalAttendance,
  PortalDiscipline,
  PortalFees,
  PortalNotifications,
  PortalPerformance,
  PortalProgressCards,
  PortalResults,
  PortalSchedule,
  PortalSyllabus,
} from './pages/portal/PortalPages';
import StudentsPage from './pages/academics/StudentsPage';
import StudentDetailPage from './pages/academics/StudentDetailPage';
import CoursesPage from './pages/setup/CoursesPage';
import { AcademicYearsPage, BatchesPage } from './pages/setup/StructurePages';
import { FacultyPage, MentorsPage } from './pages/setup/StaffPages';
import MasterDataPage from './pages/setup/MasterDataPage';
import SchedulePage from './pages/operations/SchedulePage';
import AttendancePage from './pages/operations/AttendancePage';
import AttendanceHistoryPage from './pages/operations/AttendanceHistoryPage';
import { ClassRegisterPage, FacultyEntryExitPage } from './pages/operations/TeachingPages';
import SyllabusPage from './pages/operations/SyllabusPage';
import DisciplinePage from './pages/operations/DisciplinePage';
import ParentMeetingsPage from './pages/operations/ParentMeetingsPage';
import TestsPage from './pages/assessments/TestsPage';
import ExamsPage from './pages/assessments/ExamsPage';
import MarksEntryPage from './pages/assessments/MarksEntryPage';
import PerformancePage from './pages/assessments/PerformancePage';
import ProgressCardsPage from './pages/assessments/ProgressCardsPage';
import FeesPage from './pages/fees/FeesPage';
import { PaymentsPage, ReceiptPage } from './pages/fees/PaymentsPages';
import MessagesPage from './pages/admin/MessagesPage';
import ReportsPage from './pages/admin/ReportsPage';
import UsersPage from './pages/admin/UsersPage';
import RolesPage from './pages/admin/RolesPage';
import AuditPage from './pages/admin/AuditPage';
import SettingsPage from './pages/admin/SettingsPage';

/** The home screen depends on the user's portal: staff, mentor, faculty or student. */
function Home() {
  const { user } = useAuth();
  switch (user?.portal) {
    case 'STUDENT':
      return <PortalDashboard />;
    case 'MENTOR':
      return <MentorDashboard />;
    case 'FACULTY':
      return <FacultyDashboard />;
    default:
      // Administrators get the attendance and discipline dashboard (the API allows it to no one else).
      return user?.roles.includes('ADMINISTRATIVE') ? <AdminDashboard /> : <StaffDashboard />;
  }
}

const STAFF = ['STAFF', 'MENTOR', 'FACULTY'] as const;
/** Administration and academic staff only: mentors and faculty do not see these screens at all. */
const OFFICE = ['STAFF'] as const;
const ACADEMICS = 'academics' as const;

export const ROUTES: AppRoute[] = [

  // ---- Home ---------------------------------------------------------------------------
  { path: '/', element: <Home />, permissions: ['DASHBOARD_VIEW', 'MY_PROFILE_VIEW'],
    nav: { section: 'Overview', label: 'Dashboard', icon: LayoutDashboard } },

  // ---- Student self-service -----------------------------------------------------------------
  { path: '/my/schedule', element: <PortalSchedule />, portals: ['STUDENT'], module: 'studentPortal', permissions: ['MY_SCHEDULE_VIEW'],
    nav: { section: 'My studies', label: 'Timetable', icon: CalendarDays } },
  { path: '/my/attendance', element: <PortalAttendance />, portals: ['STUDENT'], module: 'studentPortal', permissions: ['MY_ATTENDANCE_VIEW'],
    nav: { section: 'My studies', label: 'Attendance', icon: CalendarCheck } },
  { path: '/my/results', element: <PortalResults />, portals: ['STUDENT'], module: 'studentPortal', permissions: ['MY_TEST_RESULTS_VIEW', 'MY_EXAM_RESULTS_VIEW'],
    nav: { section: 'My studies', label: 'Results', icon: ClipboardCheck } },
  { path: '/my/performance', element: <PortalPerformance />, portals: ['STUDENT'], module: 'studentPortal', feature: 'performance',
    permissions: ['MY_PERFORMANCE_VIEW'], nav: { section: 'My studies', label: 'Performance', icon: TrendingUp } },
  { path: '/my/progress-cards', element: <PortalProgressCards />, portals: ['STUDENT'], module: 'studentPortal', permissions: ['MY_PROGRESS_CARD_VIEW'],
    nav: { section: 'My studies', label: 'Progress cards', icon: FileBadge } },
  { path: '/my/syllabus', element: <PortalSyllabus />, portals: ['STUDENT'], module: 'studentPortal', feature: 'studentSyllabus',
    permissions: ['MY_SYLLABUS_VIEW'], nav: { section: 'My studies', label: 'Syllabus', icon: BookOpen } },
  { path: '/my/discipline', element: <PortalDiscipline />, portals: ['STUDENT'], module: 'studentPortal', permissions: ['MY_DISCIPLINE_VIEW', 'MY_FINE_VIEW'],
    nav: { section: 'My account', label: 'Discipline & fines', icon: ShieldAlert } },
  { path: '/my/fees', element: <PortalFees />, portals: ['STUDENT'], module: 'fees', permissions: ['MY_FEE_VIEW'],
    nav: { section: 'My account', label: 'Fees', icon: Wallet } },
  { path: '/my/notifications', element: <PortalNotifications />, portals: ['STUDENT'], module: 'studentPortal', permissions: ['MY_NOTIFICATION_VIEW'],
    nav: { section: 'My account', label: 'Notifications', icon: Bell } },

  // ---- Students -----------------------------------------------------------------------------
  { path: '/students', element: <StudentsPage />, portals: [...OFFICE], module: ACADEMICS, permissions: ['STUDENT_VIEW', 'ASSIGNED_STUDENT_VIEW'],
    nav: { section: 'Students', label: 'Students', icon: GraduationCap } },
  { path: '/students/:id', element: <StudentDetailPage />, portals: [...OFFICE], module: ACADEMICS, permissions: ['STUDENT_VIEW', 'ASSIGNED_STUDENT_VIEW'] },
  { path: '/parent-meetings', element: <ParentMeetingsPage />, portals: [...OFFICE], module: ACADEMICS, permissions: ['PARENT_MEETING_VIEW'],
    nav: { section: 'Students', label: 'Parent meetings', icon: UsersRound } },
  { path: '/discipline', element: <DisciplinePage />, portals: [...OFFICE], module: ACADEMICS, permissions: ['DISCIPLINE_VIEW', 'FINE_VIEW'],
    nav: { section: 'Students', label: 'Discipline & fines', icon: ShieldAlert } },

  // ---- Daily academics ----------------------------------------------------------------------------
  // Taking attendance is for mentors and faculty only; everyone else may at most view the history.
  { path: '/attendance', element: <AttendancePage />, portals: [...STAFF], module: ACADEMICS, permissions: ['ATTENDANCE_CREATE'],
    roles: [...ATTENDANCE_TAKERS], nav: { section: 'Academics', label: 'Take attendance', icon: CalendarCheck } },
  { path: '/attendance/history', element: <AttendanceHistoryPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['ATTENDANCE_VIEW'],
    nav: { section: 'Academics', label: 'Attendance history', icon: History } },
  { path: '/schedule', element: <SchedulePage />, portals: [...STAFF], module: ACADEMICS, permissions: ['SCHEDULE_VIEW', 'MY_SCHEDULE_VIEW'],
    nav: { section: 'Academics', label: 'Class schedule', icon: CalendarClock } },
  { path: '/class-register', element: <ClassRegisterPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['CLASS_REGISTER_VIEW'],
    nav: { section: 'Academics', label: 'Class register', icon: NotebookPen } },
  { path: '/faculty-entry-exit', element: <FacultyEntryExitPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['FACULTY_ENTRY_EXIT_VIEW'],
    nav: { section: 'Academics', label: 'Entry / exit', icon: Clock } },
  { path: '/syllabus', element: <SyllabusPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['SYLLABUS_VIEW'],
    nav: { section: 'Academics', label: 'Syllabus', icon: BookOpen } },

  // ---- Assessments ----------------------------------------------------------------------------------
  { path: '/tests', element: <TestsPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['TEST_VIEW'],
    nav: { section: 'Assessments', label: 'Tests', icon: ListChecks } },
  { path: '/tests/:id/marks', element: <MarksEntryPage kind="test" />, portals: [...STAFF], module: ACADEMICS, permissions: ['TEST_VIEW', 'TEST_MARKS_ENTRY'] },
  { path: '/exams', element: <ExamsPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['EXAM_VIEW'],
    nav: { section: 'Assessments', label: 'Exams', icon: ClipboardList } },
  { path: '/exams/:id/marks', element: <MarksEntryPage kind="exam" />, portals: [...STAFF], module: ACADEMICS, permissions: ['EXAM_VIEW', 'EXAM_MARKS_ENTRY'] },
  { path: '/performance', element: <PerformancePage />, portals: [...STAFF], module: ACADEMICS, feature: 'performance', permissions: ['PERFORMANCE_VIEW'],
    nav: { section: 'Assessments', label: 'Performance', icon: TrendingUp } },
  { path: '/progress-cards', element: <ProgressCardsPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['PROGRESS_CARD_VIEW'],
    nav: { section: 'Assessments', label: 'Progress cards', icon: FileText } },

  // ---- Fees ------------------------------------------------------------------------------------------------
  { path: '/fees', element: <FeesPage />, portals: [...STAFF], module: 'fees', permissions: ['FEE_VIEW'],
    nav: { section: 'Fees', label: 'Fees', icon: Receipt } },
  { path: '/payments', element: <PaymentsPage />, portals: [...STAFF], module: 'fees', permissions: ['FEE_VIEW'],
    nav: { section: 'Fees', label: 'Payments', icon: CreditCard } },
  { path: '/payments/:id/receipt', element: <ReceiptPage />, portals: [...STAFF], module: 'fees', permissions: ['FEE_VIEW'] },

  // ---- Communication and reports ------------------------------------------------------------------------------
  { path: '/messages', element: <MessagesPage />, portals: [...STAFF], module: 'notifications', permissions: ['NOTIFICATION_VIEW'],
    nav: { section: 'Communication', label: 'Messages', icon: MessageSquare } },
  { path: '/reports', element: <ReportsPage />, portals: [...OFFICE], module: 'reports', permissions: ['REPORT_VIEW'],
    nav: { section: 'Communication', label: 'Reports', icon: BarChart3 } },

  // ---- Academic setup ------------------------------------------------------------------------------------------
  { path: '/batches', element: <BatchesPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['BATCH_VIEW', 'MY_BATCH_VIEW'],
    nav: { section: 'Setup', label: 'Batches', icon: Layers } },
  { path: '/courses', element: <CoursesPage />, portals: [...OFFICE], module: ACADEMICS, permissions: ['COURSE_VIEW'],
    nav: { section: 'Setup', label: 'Courses & subjects', icon: BookMarked } },
  { path: '/academic-years', element: <AcademicYearsPage />, portals: [...OFFICE], module: ACADEMICS, permissions: ['ACADEMIC_YEAR_VIEW'],
    nav: { section: 'Setup', label: 'Academic years', icon: CalendarDays } },
  { path: '/mentors', element: <MentorsPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['MENTOR_VIEW'],
    nav: { section: 'Setup', label: 'Mentors', icon: Users } },
  { path: '/faculty', element: <FacultyPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['FACULTY_VIEW'],
    nav: { section: 'Setup', label: 'Faculty', icon: UserCog } },
  { path: '/master-data', element: <MasterDataPage />, portals: [...STAFF], module: ACADEMICS, permissions: ['MASTER_DATA_MANAGE'],
    nav: { section: 'Setup', label: 'Master data', icon: Database } },

  { path: '/imports/students', element: <ExcelImportPage key='students' kind='students' />, roles: ['ADMINISTRATIVE'], module: 'administration', permissions: ['STUDENT_CREATE'], nav: { section: 'Bulk upload', label: 'Students', icon: Database } },
  { path: '/imports/faculty', element: <ExcelImportPage key='faculty' kind='faculty' />, roles: ['ADMINISTRATIVE'], module: 'administration', permissions: ['FACULTY_MANAGE'], nav: { section: 'Bulk upload', label: 'Faculty', icon: Database } },
  { path: '/imports/mentors', element: <ExcelImportPage key='mentors' kind='mentors' />, roles: ['ADMINISTRATIVE'], module: 'administration', permissions: ['MENTOR_MANAGE'], nav: { section: 'Bulk upload', label: 'Mentors', icon: Database } },
  { path: '/imports/fees', element: <ExcelImportPage key='fees' kind='fees' />, roles: ['ADMINISTRATIVE'], module: 'administration', permissions: ['COURSE_MANAGE'], nav: { section: 'Bulk upload', label: 'Fee structure', icon: Database } },

  // ---- Administration ---------------------------------------------------------------------------------------------
  { path: '/users', element: <UsersPage />, portals: [...STAFF], module: 'administration', permissions: ['USER_VIEW'],
    nav: { section: 'Administration', label: 'Users', icon: Users } },
  { path: '/roles', element: <RolesPage />, portals: [...STAFF], module: 'administration', permissions: ['ROLE_VIEW'],
    nav: { section: 'Administration', label: 'Roles & permissions', icon: ShieldCheck } },
  { path: '/audit', element: <AuditPage />, portals: [...STAFF], module: 'administration', permissions: ['AUDIT_VIEW'],
    nav: { section: 'Administration', label: 'Audit log', icon: ScrollText } },
  { path: '/settings', element: <SettingsPage />, portals: [...STAFF], module: 'administration', permissions: ['SETTINGS_VIEW'],
    nav: { section: 'Administration', label: 'Settings', icon: Settings } },
];

/** The icon of each menu section's accordion header. */
export const NAV_SECTION_ICONS: Record<string, LucideIcon> = {
  Overview: LayoutDashboard,
  'My studies': BookOpen,
  'My account': UserRound,
  Students: GraduationCap,
  Academics: CalendarCheck,
  Assessments: ClipboardList,
  Fees: Wallet,
  Communication: MessageSquare,
  Setup: Layers,
  Administration: ShieldCheck,
  'Bulk upload': Database,
};

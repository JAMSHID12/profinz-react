import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, CalendarCheck, ClipboardCheck, GraduationCap, MessageSquare, Wallet } from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { Badge, Card, CardHeader, EmptyState, Loadable, PageHeader, StatCard } from '../../components/ui';
import { formatDate, formatDay, formatMoney } from '../../utils/format';
import type { ScheduleEntry } from '../../types';

export function ClassList({ classes, empty }: { classes: ScheduleEntry[]; empty: string }) {
  if (classes.length === 0) return <EmptyState title={empty} />;
  return (
    <ul className="divide-y divide-slate-100">
      {classes.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">
              {entry.subject.name} <span className="text-slate-400">&middot;</span> {entry.batch.name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {formatDay(entry.scheduleDate)} &middot; {entry.startTime}-{entry.endTime}
              {entry.room ? ` · ${entry.room}` : ''}
              {entry.faculty ? ` · ${entry.faculty.name}` : ''}
            </p>
          </div>
          {entry.status !== 'SCHEDULED' && <Badge value={entry.status} />}
        </li>
      ))}
    </ul>
  );
}

export default function StaffDashboard() {
  const query = useQuery(() => dashboardApi.summary(), []);
  const { can } = useAuth();
  const { config } = useConfig();

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${config.client.name} at a glance`} />
      <Loadable query={query}>
        {(summary) => {
          const attendance = summary.attendance;
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Active students" value={summary.activeStudents} hint={`${summary.activeBatches} ${summary.activeBatches === 1 ? 'batch' : 'batches'}`}
                  icon={<GraduationCap size={18} />} />
                <StatCard label="Attendance today" value={`${attendance.present + attendance.late} present`}
                  hint={`${attendance.absent} absent, ${attendance.late} late, ${attendance.excused} excused - ${attendance.batchesMarked}/${attendance.activeBatches} batches marked`}
                  icon={<CalendarCheck size={18} />} tone={attendance.absent > 0 ? 'warning' : 'default'} />
                <StatCard label="Awaiting review" value={summary.resultsAwaitingReview + summary.progressCardsAwaitingReview}
                  hint={`${summary.resultsAwaitingReview} results, ${summary.progressCardsAwaitingReview} progress cards`}
                  icon={<ClipboardCheck size={18} />} />
                <StatCard label="Pending fines" value={formatMoney(summary.pendingFines)} icon={<AlertTriangle size={18} />}
                  tone={(summary.pendingFines ?? 0) > 0 ? 'warning' : 'default'} />
                {summary.feesOutstanding !== undefined && (
                  <StatCard label="Fees outstanding" value={formatMoney(summary.feesOutstanding)}
                    hint={`${formatMoney(summary.feesOverdue)} overdue`} icon={<Wallet size={18} />}
                    tone={(summary.feesOverdue ?? 0) > 0 ? 'danger' : 'default'} />
                )}
                {summary.queuedMessages !== undefined && (
                  <StatCard label="Messages" value={`${summary.queuedMessages} queued`}
                    hint={`${summary.failedMessages ?? 0} failed`} icon={<MessageSquare size={18} />}
                    tone={(summary.failedMessages ?? 0) > 0 ? 'danger' : 'default'} />
                )}
                <StatCard label="Courses" value={summary.activeCourses} hint={`${summary.mentors} mentors, ${summary.faculty} faculty`}
                  icon={<BookOpen size={18} />} />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Today's classes" subtitle={formatDate(summary.date)}
                    actions={can('SCHEDULE_VIEW') ? <Link to="/schedule" className="text-xs font-semibold text-brand-600">Schedule</Link> : undefined} />
                  <ClassList classes={summary.todaysClasses} empty="No classes today" />
                </Card>
                <Card>
                  <CardHeader title="Exams in the next 7 days"
                    actions={can('EXAM_VIEW') ? <Link to="/exams" className="text-xs font-semibold text-brand-600">All exams</Link> : undefined} />
                  {summary.upcomingExams.length === 0 ? (
                    <EmptyState title="No upcoming exams" />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {summary.upcomingExams.map((exam) => (
                        <li key={exam.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{exam.name}</p>
                            <p className="text-xs text-slate-500">
                              {exam.batch.name} &middot; {formatDay(exam.examDate)}
                              {exam.startTime ? ` · ${exam.startTime}` : ''}
                            </p>
                          </div>
                          <Badge value={exam.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {summary.recentMessages.length > 0 && (
                <Card>
                  <CardHeader title="Recent parent messages"
                    actions={<Link to="/messages" className="text-xs font-semibold text-brand-600">Message log</Link>} />
                  <ul className="divide-y divide-slate-100">
                    {summary.recentMessages.map((message) => (
                      <li key={message.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-800">{message.preview ?? message.title}</p>
                          <p className="text-xs text-slate-500">
                            {message.parentName ?? message.studentName} &middot; {message.destination}
                          </p>
                        </div>
                        <Badge value={message.status} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          );
        }}
      </Loadable>
    </div>
  );
}

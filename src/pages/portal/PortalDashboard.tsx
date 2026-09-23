import { Link } from 'react-router-dom';
import { Bell, CalendarCheck, TrendingUp, Wallet } from 'lucide-react';
import { portalApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useConfig } from '../../context/ConfigContext';
import { Badge, Card, CardHeader, EmptyState, Loadable, PageHeader, StatCard } from '../../components/ui';
import { formatDate, formatDay, formatMoney, formatPercent } from '../../utils/format';
import { ClassList } from '../home/StaffDashboard';

export default function PortalDashboard() {
  const query = useQuery(() => portalApi.dashboard(), []);
  const { config } = useConfig();

  return (
    <Loadable query={query}>
      {(data) => (
        <div className="space-y-5">
          <PageHeader
            title={`Welcome, ${data.fullName}`}
            subtitle={[data.admissionNumber, data.batch?.name, data.course?.name, data.mentor ? `Mentor: ${data.mentor.name}` : null]
              .filter(Boolean)
              .join(' · ')}
          />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Attendance" value={formatPercent(data.attendancePercentage)} icon={<CalendarCheck size={18} />}
              tone={data.attendancePercentage === undefined ? 'default' : data.attendancePercentage >= 75 ? 'positive' : 'danger'} />
            {config.features.performance && (
              <StatCard label="Performance" value={formatPercent(data.performance)} hint={data.grade ? `Grade ${data.grade}` : undefined}
                icon={<TrendingUp size={18} />} />
            )}
            {data.feesEnabled ? (
              <StatCard label="Fee balance" value={formatMoney(data.feeBalance)}
                hint={data.nextDueDate ? `Next ${formatMoney(data.nextDueAmount)} on ${formatDate(data.nextDueDate)}` : 'Nothing due'}
                icon={<Wallet size={18} />} tone={(data.feeBalance ?? 0) > 0 ? 'warning' : 'default'} />
            ) : (
              <StatCard label="Pending fines" value={formatMoney(data.pendingFines)} tone={(data.pendingFines ?? 0) > 0 ? 'warning' : 'default'} />
            )}
            <StatCard label="Notifications" value={data.unreadNotifications} hint="unread" icon={<Bell size={18} />} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Today's classes" actions={<Link to="/my/schedule" className="text-xs font-semibold text-brand-600">Timetable</Link>} />
              <ClassList classes={data.todaysClasses} empty="No classes today" />
            </Card>
            <Card>
              <CardHeader title="Upcoming exams" />
              {data.upcomingExams.length === 0 ? (
                <EmptyState title="No exams scheduled" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.upcomingExams.map((exam) => (
                    <li key={exam.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{exam.name}</p>
                      <p className="text-xs text-slate-500">
                        {exam.subject.name} &middot; {formatDay(exam.date)}
                        {exam.startTime ? ` · ${exam.startTime}-${exam.endTime ?? ''}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="Recent results" actions={<Link to="/my/results" className="text-xs font-semibold text-brand-600">All results</Link>} />
            {data.recentResults.length === 0 ? (
              <EmptyState title="No published results yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentResults.map((result) => (
                  <li key={`${result.examName}-${result.date}`} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{result.examName}</p>
                      <p className="text-xs text-slate-500">{result.subject.name} &middot; {formatDate(result.date)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{result.absent ? '-' : `${result.marksObtained} / ${result.maxMarks}`}</span>
                      <Badge value={result.result} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </Loadable>
  );
}

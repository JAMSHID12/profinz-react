import { Link } from 'react-router-dom';
import { CalendarCheck, ClipboardList, FileText, Users } from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { canTakeAttendance } from '../../access';
import { Badge, Card, CardHeader, EmptyState, Loadable, PageHeader, ProgressBar, StatCard } from '../../components/ui';
import { formatDate, formatDay, formatPercent } from '../../utils/format';

export default function MentorDashboard() {
  const query = useQuery(() => dashboardApi.mentor(), []);
  const { user } = useAuth();

  return (
    <div>
      <PageHeader
        title={`Hello, ${user?.fullName ?? ''}`}
        subtitle="Your batches today"
        actions={canTakeAttendance(user) && <Link to="/attendance" className="btn-primary"><CalendarCheck size={16} /> Take attendance</Link>}
      />
      <Loadable query={query}>
        {(data) => (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="My students" value={data.students} hint={`${data.batches.length} ${data.batches.length === 1 ? 'batch' : 'batches'}`} icon={<Users size={18} />} />
              <StatCard label="Present today" value={data.attendance.present + data.attendance.late}
                hint={`${data.attendance.batchesMarked}/${data.attendance.activeBatches} batches marked`} icon={<CalendarCheck size={18} />} />
              <StatCard label="Absent or late" value={data.attendance.absent + data.attendance.late}
                tone={data.attendance.absent > 0 ? 'warning' : 'default'} icon={<ClipboardList size={18} />} />
              <StatCard label="Cards to review" value={data.pendingProgressCards.length} icon={<FileText size={18} />} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.batches.map(({ batch, attendanceMarkedToday, syllabusCompletion }) => (
                <Card key={batch.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{batch.name}</p>
                      <p className="text-xs text-slate-500">{batch.course.name} &middot; {batch.studentCount} students</p>
                    </div>
                    {canTakeAttendance(user) && !attendanceMarkedToday ? (
                      <Link to={`/attendance?batchId=${batch.id}`} className="btn-primary btn-sm"><CalendarCheck size={14} /> Take attendance</Link>
                    ) : (
                      <Badge value={attendanceMarkedToday ? 'COMPLETED' : 'PENDING'} label={attendanceMarkedToday ? 'Marked' : 'Not marked'} />
                    )}
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>Syllabus</span>
                      <span>{formatPercent(syllabusCompletion)}</span>
                    </div>
                    <ProgressBar value={syllabusCompletion} />
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader title="Absent or late today" subtitle={formatDate(data.date)} />
                {data.absentOrLateToday.length === 0 ? (
                  <EmptyState title="Everyone marked is present" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.absentOrLateToday.map((record) => (
                      <li key={record.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="text-sm font-medium text-slate-800">
                          {record.student.name}
                          <span className="ml-2 text-xs font-normal text-slate-500">{record.batch.name}</span>
                        </span>
                        <Badge value={record.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader title="Recent tests" actions={<Link to="/tests" className="text-xs font-semibold text-brand-600">All tests</Link>} />
                {data.recentTests.length === 0 ? (
                  <EmptyState title="No recent tests" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.recentTests.map((test) => (
                      <li key={test.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{test.title}</p>
                          <p className="text-xs text-slate-500">{test.batch.name} &middot; {formatDate(test.testDate)}</p>
                        </div>
                        <Badge value={test.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader title="Progress cards awaiting review"
                  actions={<Link to="/progress-cards" className="text-xs font-semibold text-brand-600">Progress cards</Link>} />
                {data.pendingProgressCards.length === 0 ? (
                  <EmptyState title="Nothing to review" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.pendingProgressCards.map((card) => (
                      <li key={card.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <p className="truncate text-sm text-slate-800">{card.student.name} &middot; {card.title}</p>
                        <Badge value={card.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader title="Upcoming exams" />
                {data.upcomingExams.length === 0 ? (
                  <EmptyState title="No exams in the next two weeks" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.upcomingExams.map((exam) => (
                      <li key={exam.id} className="px-4 py-3 text-sm">
                        <span className="font-medium text-slate-800">{exam.name}</span>
                        <span className="ml-2 text-xs text-slate-500">{exam.batch.name} &middot; {formatDay(exam.examDate)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}
      </Loadable>
    </div>
  );
}

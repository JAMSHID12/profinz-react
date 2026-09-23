import { Link } from 'react-router-dom';
import { BookOpenCheck, CalendarCheck, Clock, NotebookPen } from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { canTakeAttendance } from '../../access';
import { Card, CardHeader, EmptyState, Loadable, PageHeader, ProgressBar, StatCard } from '../../components/ui';
import { formatDate, formatPercent } from '../../utils/format';
import { ClassList } from './StaffDashboard';

export default function FacultyDashboard() {
  const query = useQuery(() => dashboardApi.faculty(), []);
  const { user, can } = useAuth();

  return (
    <div>
      <PageHeader
        title={`Hello, ${user?.fullName ?? ''}`}
        subtitle="Your teaching day"
        actions={
          <>
            {canTakeAttendance(user) && <Link to="/attendance" className="btn-primary"><CalendarCheck size={16} /> Take attendance</Link>}
            {can('CLASS_REGISTER_CREATE') && <Link to="/class-register" className="btn-secondary"><NotebookPen size={16} /> Class register</Link>}
            {can('FACULTY_ENTRY_EXIT_CREATE') && <Link to="/faculty-entry-exit" className="btn-secondary"><Clock size={16} /> Entry / exit</Link>}
          </>
        }
      />
      <Loadable query={query}>
        {(data) => (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Classes today" value={data.todaysClasses.length} icon={<Clock size={18} />} />
              <StatCard label="Marks to enter" value={data.pendingMarks.length} tone={data.pendingMarks.length > 0 ? 'warning' : 'default'}
                icon={<NotebookPen size={18} />} />
              <StatCard label="Batches" value={data.batches.length} hint={data.batches.map((batch) => batch.name).join(', ')} />
              <StatCard label="Subjects" value={data.subjects.length} hint={data.subjects.map((subject) => subject.name).join(', ')}
                icon={<BookOpenCheck size={18} />} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader title="Today's classes" subtitle={formatDate(data.date)} />
                <ClassList classes={data.todaysClasses} empty="No classes today" />
              </Card>
              <Card>
                <CardHeader title="Marks waiting to be entered" />
                {data.pendingMarks.length === 0 ? (
                  <EmptyState title="All marks are entered" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.pendingMarks.map((item) => (
                      <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                          <p className="text-xs text-slate-500">
                            {item.batch.name} &middot; {formatDate(item.date)} &middot; {item.entered}/{item.students} entered
                          </p>
                        </div>
                        <Link to={`/${item.kind === 'EXAM' ? 'exams' : 'tests'}/${item.id}/marks`} className="btn-secondary btn-sm">
                          Enter marks
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader title="Upcoming classes" />
                <ClassList classes={data.upcomingClasses} empty="No upcoming classes" />
              </Card>
              <Card>
                <CardHeader title="Syllabus progress" actions={<Link to="/syllabus" className="text-xs font-semibold text-brand-600">Update</Link>} />
                {data.syllabus.length === 0 ? (
                  <EmptyState title="No syllabus topics yet" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.syllabus.map((row) => (
                      <li key={`${row.batch.id}-${row.subject.id}`} className="px-4 py-3">
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium text-slate-800">{row.subject.name} <span className="text-xs text-slate-500">{row.batch.name}</span></span>
                          <span className="text-xs text-slate-500">{row.completedTopics}/{row.totalTopics} &middot; {formatPercent(row.completion)}</span>
                        </div>
                        <ProgressBar value={row.completion} />
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

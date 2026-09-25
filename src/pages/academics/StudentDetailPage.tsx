import { useState } from 'react';
import { educationLabel } from '../../utils/eligibility';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftRight, KeyRound, Pencil } from 'lucide-react';
import {
  attendanceApi,
  disciplineApi,
  feeApi,
  meetingApi,
  performanceApi,
  progressApi,
  studentApi,
} from '../../api/endpoints';
import { useAction, useQuery } from '../../hooks/useQuery';
import { useBatches } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { DataTable } from '../../components/DataTable';
import { FeeSummaryView, PerformanceView } from '../../components/academic';
import { Field, refOptions, SelectInput, TextInput } from '../../components/forms';
import { Badge, Card, CardHeader, InfoGrid, Loadable, Modal, PageHeader, Tabs } from '../../components/ui';
import { formatDate, formatMoney, formatPercent, todayIso } from '../../utils/format';
import type { FeePlan, StudentDetail } from '../../types';
import DiscountDialog from '../fees/DiscountDialog';
import StudentForm from './StudentForm';

type Tab = 'overview' | 'attendance' | 'performance' | 'discipline' | 'fees' | 'history' | 'meetings' | 'cards';

export default function StudentDetailPage() {
  const id = Number(useParams().id);
  const { can } = useAuth();
  const { config, moduleEnabled } = useConfig();
  const query = useQuery(() => studentApi.detail(id), [id]);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <Loadable query={query}>
      {(student) => (
        <div>
          <PageHeader
            title={student.fullName}
            subtitle={
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{student.admissionNumber}</span>
                {student.batch && <span>&middot; {student.batch.name}</span>}
                {student.mentor && <span>&middot; Mentor {student.mentor.name}</span>}
                <Badge value={student.status} />
              </span>
            }
            actions={can('STUDENT_UPDATE') && (
              <>
                <button type="button" className="btn-secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>
                <button type="button" className="btn-secondary" onClick={() => setMoving(true)}><ArrowLeftRight size={15} /> Move to batch</button>
                <button type="button" className="btn-secondary" onClick={() => setLoginOpen(true)}>
                  <KeyRound size={15} /> {student.username ? 'Reset login' : 'Create login'}
                </button>
              </>
            )}
          />
          <Tabs<Tab>
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'attendance', label: 'Attendance', hidden: !can('ATTENDANCE_VIEW') },
              { key: 'performance', label: 'Performance', hidden: !can('PERFORMANCE_VIEW') || !config.features.performance },
              { key: 'cards', label: 'Progress cards', hidden: !can('PROGRESS_CARD_VIEW') },
              { key: 'discipline', label: 'Discipline & fines', hidden: !can('DISCIPLINE_VIEW', 'FINE_VIEW') },
              { key: 'fees', label: 'Fees', hidden: !can('FEE_VIEW') || !moduleEnabled('fees') },
              { key: 'meetings', label: 'Parent meetings', hidden: !can('PARENT_MEETING_VIEW') },
              { key: 'history', label: 'Batch history' },
            ]}
          />
          {tab === 'overview' && <Overview student={student} />}
          {tab === 'attendance' && <AttendanceTab studentId={id} />}
          {tab === 'performance' && <PerformanceTab studentId={id} />}
          {tab === 'cards' && <CardsTab studentId={id} />}
          {tab === 'discipline' && <DisciplineTab studentId={id} />}
          {tab === 'fees' && <FeesTab studentId={id} />}
          {tab === 'meetings' && <MeetingsTab studentId={id} />}
          {tab === 'history' && <HistoryTab studentId={id} />}

          <StudentForm open={editing} student={student} onClose={() => setEditing(false)}
            onSaved={(saved) => { setEditing(false); query.setData(saved); }} />
          <MoveDialog open={moving} student={student} onClose={() => setMoving(false)}
            onMoved={(saved) => { setMoving(false); query.setData(saved); }} />
          <LoginDialog open={loginOpen} student={student} onClose={() => setLoginOpen(false)}
            onDone={(saved) => { setLoginOpen(false); query.setData(saved); }} />
        </div>
      )}
    </Loadable>
  );
}

function Overview({ student }: { student: StudentDetail }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Student</h2>
        <InfoGrid
          items={[
            ['Student ID', student.studentCode],
            ['Education category', educationLabel(student.educationCategory, student.educationCategoryDetail)],
            ['Admission date', formatDate(student.admissionDate)],
            ['Course', student.course?.name],
            ['Academic year', student.academicYear?.name],
            ['Date of birth', formatDate(student.dateOfBirth)],
            ['Gender', student.gender],
            ['Mobile', student.mobile],
            ['E-mail', student.email],
            ['Address', student.address],
            ['Portal login', student.username ?? 'Not created'],
          ]}
        />
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Parent</h2>
        {student.parent ? (
          <InfoGrid
            items={[
              ['Name', student.parent.name],
              ['Relation', student.parent.relation],
              ['Phone', student.parent.phoneNumber],
              ['WhatsApp', student.parent.whatsappNumber ?? student.parent.phoneNumber],
              ['E-mail', student.parent.email],
              ['WhatsApp updates', student.parent.whatsappOptIn ? 'Opted in' : 'Opted out'],
            ]}
          />
        ) : (
          <p className="text-sm text-slate-500">No parent contact recorded. Edit the student to add parent details.</p>
        )}
      </Card>
    </div>
  );
}

function AttendanceTab({ studentId }: { studentId: number }) {
  const [page, setPage] = useState(0);
  const query = useQuery(() => attendanceApi.history({ studentId, page, size: 25 }), [studentId, page]);
  return (
    <Card>
      <DataTable
        rows={query.data?.content}
        loading={query.loading}
        error={query.error}
        onRetry={query.reload}
        rowKey={(row) => row.id}
        empty="No attendance recorded"
        columns={[
          { header: 'Date', render: (row) => formatDate(row.date) },
          { header: 'Class', render: (row) => row.subject?.name ?? 'Whole day' },
          { header: 'Status', render: (row) => <Badge value={row.status} /> },
          { header: 'Parent message', render: (row) => (row.notificationStatus ? <Badge value={row.notificationStatus} /> : '-') },
          { header: 'Remarks', render: (row) => row.remarks ?? '' },
        ]}
      />
      {query.data && (
        <div className="px-4 py-3 text-xs text-slate-500">
          <button type="button" className="btn-secondary btn-sm mr-2" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
          <button type="button" className="btn-secondary btn-sm" disabled={page + 1 >= query.data.totalPages} onClick={() => setPage(page + 1)}>Older</button>
        </div>
      )}
    </Card>
  );
}

function PerformanceTab({ studentId }: { studentId: number }) {
  const query = useQuery(() => performanceApi.student(studentId), [studentId]);
  return <Loadable query={query}>{(performance) => <PerformanceView performance={performance} />}</Loadable>;
}

function CardsTab({ studentId }: { studentId: number }) {
  const query = useQuery(() => progressApi.search({ studentId }), [studentId]);
  return (
    <Card>
      <DataTable
        rows={query.data}
        loading={query.loading}
        error={query.error}
        rowKey={(row) => row.id}
        empty="No progress cards yet"
        columns={[
          { header: 'Title', render: (row) => <Link className="font-medium text-brand-700" to={`/progress-cards?open=${row.id}`}>{row.title}</Link> },
          { header: 'Period', render: (row) => `${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}` },
          { header: 'Performance', render: (row) => formatPercent(row.performanceScore) },
          { header: 'Status', render: (row) => <Badge value={row.status} /> },
        ]}
      />
    </Card>
  );
}

function DisciplineTab({ studentId }: { studentId: number }) {
  const { can } = useAuth();
  const records = useQuery(() => disciplineApi.records({ studentId }), [studentId], can('DISCIPLINE_VIEW'));
  const fines = useQuery(() => disciplineApi.fines({ studentId }), [studentId], can('FINE_VIEW'));
  return (
    <div className="space-y-5">
      {can('FINE_VIEW') && (
        <Card>
          <CardHeader title="Fines" />
          <DataTable rows={fines.data} loading={fines.loading} error={fines.error} rowKey={(row) => row.id} empty="No fines"
            columns={[
              { header: 'Date', render: (row) => formatDate(row.fineDate) },
              { header: 'Reason', render: (row) => row.reason },
              { header: 'Amount', render: (row) => formatMoney(row.amount) },
              { header: 'Status', render: (row) => <Badge value={row.status} /> },
            ]} />
        </Card>
      )}
      {can('DISCIPLINE_VIEW') && (
        <Card>
          <CardHeader title="Discipline records" />
          <DataTable rows={records.data} loading={records.loading} error={records.error} rowKey={(row) => row.id} empty="No records"
            columns={[
              { header: 'Date', render: (row) => formatDate(row.incidentDate) },
              { header: 'Type', render: (row) => row.disciplineType.name },
              { header: 'Details', render: (row) => row.description },
              { header: 'Action', render: (row) => row.actionTaken ?? '-' },
              { header: 'Status', render: (row) => <Badge value={row.status} /> },
            ]} />
        </Card>
      )}
    </div>
  );
}

function FeesTab({ studentId }: { studentId: number }) {
  const { can } = useAuth();
  const query = useQuery(() => feeApi.studentSummary(studentId), [studentId]);
  const [editing, setEditing] = useState<FeePlan | null>(null);
  return (
    <>
      <Loadable query={query}>
        {(summary) => (
          <FeeSummaryView summary={summary} planActions={can('FEE_MANAGE') ? (plan) => plan.status === 'ACTIVE' && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(plan)}>Change discount</button>
          ) : undefined} />
        )}
      </Loadable>
      <DiscountDialog plan={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); query.reload(); }} />
    </>
  );
}

function MeetingsTab({ studentId }: { studentId: number }) {
  const query = useQuery(() => meetingApi.search({ studentId }), [studentId]);
  return (
    <Card>
      <DataTable rows={query.data} loading={query.loading} error={query.error} rowKey={(row) => row.id} empty="No parent meetings yet"
        columns={[
          { header: 'Date', render: (row) => formatDate(row.meetingDate) },
          { header: 'Parent', render: (row) => row.parent?.name ?? '-' },
          { header: 'Mentor', render: (row) => row.mentor?.name ?? '-' },
          { header: 'Discussion', render: (row) => row.discussion ?? '-' },
          { header: 'Status', render: (row) => <Badge value={row.status} /> },
        ]} />
    </Card>
  );
}

function HistoryTab({ studentId }: { studentId: number }) {
  const query = useQuery(() => studentApi.history(studentId), [studentId]);
  return (
    <Card>
      <DataTable rows={query.data} loading={query.loading} error={query.error} rowKey={(row) => row.id} empty="Not assigned to a batch yet"
        columns={[
          { header: 'Batch', render: (row) => <span className="font-medium text-slate-800">{row.batch.name}</span> },
          { header: 'Course', render: (row) => row.course.name },
          { header: 'Academic year', render: (row) => row.academicYear.name },
          { header: 'From', render: (row) => formatDate(row.startDate) },
          { header: 'To', render: (row) => formatDate(row.endDate) },
          { header: 'Status', render: (row) => <Badge value={row.status} /> },
          { header: 'Reason', render: (row) => row.reason ?? '' },
        ]} />
    </Card>
  );
}

function MoveDialog({ open, student, onClose, onMoved }: {
  open: boolean; student: StudentDetail; onClose: () => void; onMoved: (student: StudentDetail) => void;
}) {
  const batches = useBatches().filter((batch) => batch.id !== student.batch?.id && batch.status === 'ACTIVE');
  const [batchId, setBatchId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const { run, busy, errors } = useAction();

  const move = async () => {
    const saved = await run(
      () => studentApi.transfer(student.id, { batchId: Number(batchId), effectiveDate, reason }),
      'Student moved to the new batch',
    );
    if (saved) onMoved(saved);
  };

  return (
    <Modal open={open} title="Move to another batch" onClose={onClose}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={move} disabled={busy || !batchId}>Move</button>
      </>}>
      <p className="mb-4 text-sm text-slate-500">
        The current assignment{student.batch ? ` to ${student.batch.name}` : ''} is closed and kept in the batch history.
      </p>
      <Field label="New batch" error={errors.batchId}>
        <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="Select a batch" />
      </Field>
      <Field label="Effective from">
        <input type="date" className="input" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
      </Field>
      <Field label="Reason">
        <TextInput value={reason} onChange={setReason} placeholder="e.g. Moved to the evening batch" />
      </Field>
    </Modal>
  );
}

function LoginDialog({ open, student, onClose, onDone }: {
  open: boolean; student: StudentDetail; onClose: () => void; onDone: (student: StudentDetail) => void;
}) {
  const [password, setPassword] = useState('');
  const { run, busy, errors } = useAction();

  const submit = async () => {
    const saved = await run(
      () => studentApi.createLogin(student.id, password || undefined),
      'Login ready - the student must change the password at first sign-in',
    );
    if (saved) {
      setPassword('');
      onDone(saved);
    }
  };

  return (
    <Modal open={open} title={student.username ? 'Reset student login' : 'Create student login'} onClose={onClose}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={submit} disabled={busy}>Save</button>
      </>}>
      <p className="mb-4 text-sm text-slate-500">
        Username: <span className="font-mono font-semibold text-slate-700">{student.username ?? student.admissionNumber}</span>.
        Leave the password empty to use the default student password from the configuration.
      </p>
      <Field label="Temporary password (optional)" error={errors.password}>
        <input type="password" className="input" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </Field>
    </Modal>
  );
}

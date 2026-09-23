import { useState } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { portalApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useConfig } from '../../context/ConfigContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../api/client';
import { DataTable } from '../../components/DataTable';
import { AttendanceStats, FeeSummaryView, PerformanceView, ProgressCardView, SyllabusView } from '../../components/academic';
import { Badge, Card, CardHeader, EmptyState, Loadable, Modal, PageHeader, Tabs } from '../../components/ui';
import { addDays, formatDate, formatDateTime, formatDay, formatMoney, formatPercent, isoDaysFromToday, todayIso } from '../../utils/format';
import type { ProgressCard } from '../../types';

export function PortalSchedule() {
  const [from, setFrom] = useState(todayIso());
  const to = addDays(from, 6);
  const query = useQuery(() => portalApi.schedule(from, to), [from]);

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={`${formatDate(from)} - ${formatDate(to)}`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setFrom(addDays(from, -7))}><ChevronLeft size={16} /> Previous</button>
            <button type="button" className="btn-secondary" onClick={() => setFrom(todayIso())}>This week</button>
            <button type="button" className="btn-secondary" onClick={() => setFrom(addDays(from, 7))}>Next <ChevronRight size={16} /></button>
          </>
        }
      />
      <Card>
        <DataTable
          rows={query.data}
          loading={query.loading}
          error={query.error}
          onRetry={query.reload}
          rowKey={(row) => row.id}
          empty="No classes in this week"
          columns={[
            { header: 'Day', render: (row) => formatDay(row.scheduleDate) },
            { header: 'Time', render: (row) => `${row.startTime} - ${row.endTime}` },
            { header: 'Subject', render: (row) => <span className="font-medium text-slate-800">{row.subject.name}</span> },
            { header: 'Faculty', render: (row) => row.faculty?.name ?? '-' },
            { header: 'Room', render: (row) => row.room ?? '-' },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}

export function PortalAttendance() {
  const [from, setFrom] = useState(isoDaysFromToday(-30));
  const [to, setTo] = useState(todayIso());
  const query = useQuery(() => portalApi.attendance(from, to), [from, to]);

  return (
    <div>
      <PageHeader title="My attendance" subtitle="Present and late count as attended" />
      <Card className="mb-5 p-4">
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
      </Card>
      <Loadable query={query}>
        {(data) => (
          <div className="space-y-5">
            <AttendanceStats summary={data.summary} />
            <Card>
              <DataTable
                rows={data.history}
                rowKey={(row) => `${row.date}-${row.subject?.id ?? 'day'}`}
                empty="No attendance recorded in this period"
                columns={[
                  { header: 'Date', render: (row) => formatDay(row.date) },
                  { header: 'Class', render: (row) => row.subject?.name ?? 'Whole day' },
                  { header: 'Status', render: (row) => <Badge value={row.status} /> },
                  { header: 'Remarks', render: (row) => row.remarks ?? '' },
                ]}
              />
            </Card>
          </div>
        )}
      </Loadable>
    </div>
  );
}

type ResultTab = 'DAILY' | 'WEEKLY' | 'EXAMS';

export function PortalResults() {
  const [tab, setTab] = useState<ResultTab>('DAILY');
  const tests = useQuery(() => portalApi.tests(tab), [tab], tab !== 'EXAMS');
  const exams = useQuery(() => portalApi.exams(), [], tab === 'EXAMS');

  return (
    <div>
      <PageHeader title="My results" subtitle="Results appear here once they are published" />
      <Tabs
        tabs={[
          { key: 'DAILY', label: 'Daily tests' },
          { key: 'WEEKLY', label: 'Weekly tests' },
          { key: 'EXAMS', label: 'Exams' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab !== 'EXAMS' ? (
        <Card>
          <DataTable
            rows={tests.data}
            loading={tests.loading}
            error={tests.error}
            onRetry={tests.reload}
            rowKey={(row) => `${row.date}-${row.title}`}
            empty="No published results yet"
            columns={[
              { header: 'Date', render: (row) => formatDate(row.date) },
              { header: 'Test', render: (row) => <span className="font-medium text-slate-800">{row.title}</span> },
              { header: 'Subject', render: (row) => row.subject.name },
              { header: 'Marks', render: (row) => (row.absent ? <Badge value="ABSENT" /> : `${row.marksObtained} / ${row.maxMarks}`) },
              { header: '%', render: (row) => formatPercent(row.percentage) },
              { header: 'Grade', render: (row) => row.grade ?? '-' },
            ]}
          />
        </Card>
      ) : (
        <Loadable query={exams}>
          {(data) => (
            <div className="space-y-5">
              <Card>
                <CardHeader title="Upcoming exams" />
                <DataTable
                  rows={data.upcoming}
                  rowKey={(row) => row.id}
                  empty="No exams scheduled"
                  columns={[
                    { header: 'Date', render: (row) => formatDay(row.date) },
                    { header: 'Time', render: (row) => (row.startTime ? `${row.startTime} - ${row.endTime ?? ''}` : '-') },
                    { header: 'Exam', render: (row) => row.name },
                    { header: 'Type', render: (row) => row.examType },
                    { header: 'Subject', render: (row) => row.subject.name },
                  ]}
                />
              </Card>
              <Card>
                <CardHeader title="Results" />
                <DataTable
                  rows={data.results}
                  rowKey={(row) => `${row.date}-${row.examName}`}
                  empty="No published exam results yet"
                  columns={[
                    { header: 'Date', render: (row) => formatDate(row.date) },
                    { header: 'Exam', render: (row) => <span className="font-medium text-slate-800">{row.examName}</span> },
                    { header: 'Subject', render: (row) => row.subject.name },
                    { header: 'Marks', render: (row) => (row.absent ? '-' : `${row.marksObtained} / ${row.maxMarks}`) },
                    { header: '%', render: (row) => formatPercent(row.percentage) },
                    { header: 'Grade', render: (row) => row.grade ?? '-' },
                    { header: 'Result', render: (row) => <Badge value={row.result} /> },
                  ]}
                />
              </Card>
            </div>
          )}
        </Loadable>
      )}
    </div>
  );
}

export function PortalPerformance() {
  const query = useQuery(() => portalApi.performance(), []);
  return (
    <div>
      <PageHeader title="My performance" subtitle="Based on published tests, exams and attendance" />
      <Loadable query={query}>{(performance) => <PerformanceView performance={performance} />}</Loadable>
    </div>
  );
}

export function PortalProgressCards() {
  const query = useQuery(() => portalApi.progressCards(), []);
  const { config } = useConfig();
  const toast = useToast();
  const [open, setOpen] = useState<ProgressCard | null>(null);

  const view = async (id: number) => {
    try {
      setOpen(await portalApi.progressCard(id));
    } catch (failure) {
      toast.error(errorMessage(failure));
    }
  };

  return (
    <div>
      <PageHeader title="Progress cards" />
      <Card>
        <DataTable
          rows={query.data}
          loading={query.loading}
          error={query.error}
          onRetry={query.reload}
          rowKey={(row) => row.id}
          empty="No progress cards published yet"
          onRowClick={(row) => view(row.id)}
          columns={[
            { header: 'Title', render: (row) => <span className="font-medium text-slate-800">{row.title}</span> },
            { header: 'Period', render: (row) => `${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}` },
            { header: 'Performance', render: (row) => formatPercent(row.performanceScore) },
            { header: 'Grade', render: (row) => row.grade ?? '-' },
            { header: 'Published', render: (row) => formatDateTime(row.publishedAt) },
          ]}
        />
      </Card>
      <Modal open={open !== null} title="Progress card" onClose={() => setOpen(null)} wide>
        {open && (
          <ProgressCardView card={open} centreName={config.client.name}
            actions={<button type="button" className="btn-secondary btn-sm no-print" onClick={() => window.print()}><Printer size={14} /> Print</button>} />
        )}
      </Modal>
    </div>
  );
}

export function PortalDiscipline() {
  const records = useQuery(() => portalApi.discipline(), []);
  const fines = useQuery(() => portalApi.fines(), []);
  return (
    <div className="space-y-5">
      <PageHeader title="Discipline and fines" />
      <Card>
        <CardHeader title="Fines" />
        <DataTable
          rows={fines.data}
          loading={fines.loading}
          error={fines.error}
          onRetry={fines.reload}
          rowKey={(row) => row.id}
          empty="No fines"
          columns={[
            { header: 'Date', render: (row) => formatDate(row.fineDate) },
            { header: 'Reason', render: (row) => row.reason },
            { header: 'Amount', render: (row) => formatMoney(row.amount) },
            { header: 'Due', render: (row) => formatDate(row.dueDate) },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="Discipline records" />
        <DataTable
          rows={records.data}
          loading={records.loading}
          error={records.error}
          onRetry={records.reload}
          rowKey={(row) => row.id}
          empty="No discipline records - keep it up!"
          columns={[
            { header: 'Date', render: (row) => formatDate(row.incidentDate) },
            { header: 'Type', render: (row) => row.disciplineType.name },
            { header: 'Details', render: (row) => row.description },
            { header: 'Action taken', render: (row) => row.actionTaken ?? '-' },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}

export function PortalFees() {
  const query = useQuery(() => portalApi.fees(), []);
  return (
    <div>
      <PageHeader title="My fees" />
      <Loadable query={query}>{(summary) => <FeeSummaryView summary={summary} />}</Loadable>
    </div>
  );
}

export function PortalSyllabus() {
  const query = useQuery(() => portalApi.syllabus(), []);
  return (
    <div>
      <PageHeader title="Syllabus progress" subtitle="What your batch has covered so far" />
      <Loadable query={query}>{(syllabus) => <SyllabusView syllabus={syllabus} />}</Loadable>
    </div>
  );
}

export function PortalNotifications() {
  const query = useQuery(() => portalApi.notifications(), []);
  const toast = useToast();

  const markRead = async () => {
    try {
      await portalApi.markRead();
      query.reload();
    } catch (failure) {
      toast.error(errorMessage(failure));
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        actions={query.data && query.data.unread > 0 ? <button type="button" className="btn-secondary" onClick={markRead}>Mark all as read</button> : undefined}
      />
      <Loadable query={query}>
        {(inbox) =>
          inbox.items.length === 0 ? (
            <Card><EmptyState title="No notifications yet" /></Card>
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100">
                {inbox.items.map((item) => (
                  <li key={item.id} className={`px-4 py-3 ${item.read ? '' : 'bg-brand-50/60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800">{item.title ?? item.eventType}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatDateTime(item.createdAt)}</span>
                    </div>
                    {item.message && <p className="mt-1 text-sm text-slate-600">{item.message}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )
        }
      </Loadable>
    </div>
  );
}

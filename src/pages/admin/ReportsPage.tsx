import { useState } from 'react';
import { Printer } from 'lucide-react';
import { reportApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useBatches } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { DataTable } from '../../components/DataTable';
import { AttendanceStats } from '../../components/academic';
import { refOptions, SelectInput } from '../../components/forms';
import { Badge, Card, CardHeader, EmptyState, Loadable, PageHeader, StatCard, Tabs } from '../../components/ui';
import { formatMoney, formatPercent, isoDaysFromToday, titleCase, todayIso } from '../../utils/format';

type Tab = 'attendance' | 'academic' | 'fees' | 'messages';

export default function ReportsPage() {
  const { can } = useAuth();
  const { config, moduleEnabled } = useConfig();
  const batches = useBatches();
  const [tab, setTab] = useState<Tab>('attendance');
  const [from, setFrom] = useState(isoDaysFromToday(-30));
  const [to, setTo] = useState(todayIso());
  const [batchId, setBatchId] = useState('');

  return (
    <div>
      <PageHeader title="Reports" subtitle={`${config.client.name} - ${from} to ${to}`}
        actions={<button type="button" className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'attendance', label: 'Attendance' },
        { key: 'academic', label: 'Academic', hidden: !can('PERFORMANCE_VIEW') || !config.features.performance },
        { key: 'fees', label: 'Fees', hidden: !can('FEE_VIEW') || !moduleEnabled('fees') },
        { key: 'messages', label: 'Messages', hidden: !can('NOTIFICATION_VIEW') || !moduleEnabled('notifications') },
      ]} />
      <Card className="no-print mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="date" className="input" value={from} max={to} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
          <input type="date" className="input" value={to} min={from} onChange={(event) => setTo(event.target.value)} aria-label="To" />
          {(tab === 'attendance' || tab === 'academic') && (
            <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder={tab === 'academic' ? 'Select a batch' : 'All batches'} />
          )}
        </div>
      </Card>
      {tab === 'attendance' && <AttendanceReportView from={from} to={to} batchId={batchId} />}
      {tab === 'academic' && (batchId ? <AcademicReportView from={from} to={to} batchId={batchId} /> : <Card><EmptyState title="Choose a batch" /></Card>)}
      {tab === 'fees' && <FeeReportView from={from} to={to} />}
      {tab === 'messages' && <MessageReportView from={from} to={to} />}
    </div>
  );
}

function AttendanceReportView({ from, to, batchId }: { from: string; to: string; batchId: string }) {
  const query = useQuery(() => reportApi.attendance({ from, to, batchId }), [from, to, batchId]);
  return (
    <Loadable query={query}>
      {(report) => (
        <div className="space-y-5">
          <AttendanceStats summary={report.totals} />
          <Card>
            <DataTable rows={report.rows} rowKey={(row) => row.studentId} empty="No attendance in this period"
              columns={[
                { header: 'Student', render: (row) => <span className="font-medium text-slate-800">{row.studentName}</span> },
                { header: 'Admission no.', render: (row) => row.admissionNumber },
                { header: 'Batch', render: (row) => row.batchName ?? '-' },
                { header: 'Classes', render: (row) => row.summary.totalClasses },
                { header: 'Present', render: (row) => row.summary.present },
                { header: 'Late', render: (row) => row.summary.late },
                { header: 'Absent', render: (row) => row.summary.absent },
                { header: 'Excused', render: (row) => row.summary.excused },
                { header: '%', render: (row) => (
                  <span className={row.summary.attendancePercentage < 75 ? 'font-semibold text-rose-600' : 'font-semibold'}>
                    {formatPercent(row.summary.attendancePercentage)}
                  </span>
                ) },
              ]} />
          </Card>
        </div>
      )}
    </Loadable>
  );
}

function AcademicReportView({ from, to, batchId }: { from: string; to: string; batchId: string }) {
  const query = useQuery(() => reportApi.academic({ from, to, batchId }), [from, to, batchId]);
  return (
    <Loadable query={query}>
      {(report) => (
        <Card>
          <DataTable rows={[...report.students].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))} rowKey={(row) => row.student.id}
            empty="No students"
            columns={[
              { header: 'Student', render: (row) => <span className="font-medium text-slate-800">{row.student.name}</span> },
              { header: 'Admission no.', render: (row) => row.admissionNumber },
              { header: 'Overall', render: (row) => formatPercent(row.overall) },
              { header: 'Grade', render: (row) => row.grade ?? '-' },
              { header: 'Exams', render: (row) => formatPercent(row.examAverage) },
              { header: 'Attendance', render: (row) => formatPercent(row.attendancePercentage) },
            ]} />
        </Card>
      )}
    </Loadable>
  );
}

function FeeReportView({ from, to }: { from: string; to: string }) {
  const query = useQuery(() => reportApi.fees({ from, to }), [from, to]);
  return (
    <Loadable query={query}>
      {(report) => (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Billed" value={formatMoney(report.billed)} />
            <StatCard label="Paid" value={formatMoney(report.paid)} tone="positive" />
            <StatCard label="Pending" value={formatMoney(report.pending)} tone={report.pending > 0 ? 'warning' : 'default'} />
            <StatCard label="Collected in period" value={formatMoney(report.collectedInPeriod)} />
          </div>
          <Card>
            <CardHeader title="Installments by status" />
            <DataTable rows={report.rows} rowKey={(row) => row.status}
              columns={[
                { header: 'Status', render: (row) => <Badge value={row.status} /> },
                { header: 'Installments', render: (row) => row.installments },
                { header: 'Billed', render: (row) => formatMoney(row.billed) },
                { header: 'Paid', render: (row) => formatMoney(row.paid) },
                { header: 'Pending', render: (row) => formatMoney(row.pending) },
              ]} />
          </Card>
        </div>
      )}
    </Loadable>
  );
}

function MessageReportView({ from, to }: { from: string; to: string }) {
  const query = useQuery(() => reportApi.notifications({ from, to }), [from, to]);
  return (
    <Loadable query={query}>
      {(report) => (
        <div className="space-y-5">
          <StatCard label="Messages in period" value={report.total} />
          <div className="grid gap-5 lg:grid-cols-3">
            {([['By status', report.byStatus], ['By event', report.byEvent], ['By channel', report.byChannel]] as const).map(([title, counts]) => (
              <Card key={title}>
                <CardHeader title={title} />
                <DataTable rows={counts} rowKey={(row) => row.label} empty="None"
                  columns={[
                    { header: 'Label', render: (row) => titleCase(row.label) },
                    { header: 'Count', render: (row) => row.count },
                  ]} />
              </Card>
            ))}
          </div>
        </div>
      )}
    </Loadable>
  );
}

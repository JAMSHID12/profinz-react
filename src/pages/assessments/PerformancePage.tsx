import { useEffect, useState } from 'react';
import { performanceApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useBatches } from '../../hooks/lookups';
import { DataTable } from '../../components/DataTable';
import { PerformanceView } from '../../components/academic';
import { FilterBar, refOptions, SelectInput } from '../../components/forms';
import { Card, EmptyState, Loadable, Modal, PageHeader } from '../../components/ui';
import { formatPercent, isoDaysFromToday, todayIso } from '../../utils/format';
import type { Ref } from '../../types';

export default function PerformancePage() {
  const batches = useBatches();
  const [batchId, setBatchId] = useState('');
  const [from, setFrom] = useState(isoDaysFromToday(-90));
  const [to, setTo] = useState(todayIso());
  const [student, setStudent] = useState<Ref | null>(null);
  const query = useQuery(() => performanceApi.batch(Number(batchId), { from, to }), [batchId, from, to], Boolean(batchId));
  const detail = useQuery(() => performanceApi.student(student!.id, { from, to }), [student?.id, from, to], student !== null);

  useEffect(() => {
    if (!batchId && batches.length > 0) setBatchId(String(batches[0].id));
  }, [batches, batchId]);

  const rows = [...(query.data ?? [])].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));

  return (
    <div>
      <PageHeader title="Performance" subtitle="Weighted from published daily tests, weekly tests, exams and attendance" />
      <Card>
        <FilterBar>
          <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="Select a batch" />
          <input type="date" className="input" value={from} max={to} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
          <input type="date" className="input" value={to} min={from} onChange={(event) => setTo(event.target.value)} aria-label="To" />
        </FilterBar>
        {!batchId ? <EmptyState title="Choose a batch" /> : (
          <DataTable rows={query.data ? rows : null} loading={query.loading} error={query.error} onRetry={query.reload}
            rowKey={(row) => row.student.id} empty="No students in this batch" onRowClick={(row) => setStudent(row.student)}
            columns={[
              { header: 'Rank', render: (row) => rows.indexOf(row) + 1, className: 'w-14' },
              { header: 'Student', render: (row) => <span className="font-medium text-slate-800">{row.student.name}</span> },
              { header: 'Admission no.', render: (row) => row.admissionNumber },
              { header: 'Overall', render: (row) => <span className="font-semibold">{formatPercent(row.overall)}</span> },
              { header: 'Grade', render: (row) => row.grade ?? '-' },
              { header: 'Exams', render: (row) => formatPercent(row.examAverage) },
              { header: 'Attendance', render: (row) => formatPercent(row.attendancePercentage) },
            ]} />
        )}
      </Card>
      <Modal open={student !== null} title={student?.name ?? ''} onClose={() => setStudent(null)} wide>
        {student && <Loadable query={detail}>{(performance) => <PerformanceView performance={performance} />}</Loadable>}
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { attendanceApi } from '../../api/endpoints';
import { useAction, useQuery } from '../../hooks/useQuery';
import { useBatches, useStudents } from '../../hooks/lookups';
import { DataTable } from '../../components/DataTable';
import { enumOptions, FilterBar, refOptions, SelectInput } from '../../components/forms';
import { Badge, Card, Modal, PageHeader, Pagination } from '../../components/ui';
import { ATTENDANCE_STATUSES, MarkDetails, MarkEditor } from '../../components/attendance';
import { formatDate, formatDateTime, isoDaysFromToday, todayIso } from '../../utils/format';
import type { AttendanceMark, AttendanceRecord } from '../../types';

/**
 * Attendance as recorded. Anyone with ATTENDANCE_VIEW can look; a mark can be corrected only by
 * the mentor of the batch or the faculty member of the class (the server says which, per row).
 */
export default function AttendanceHistoryPage() {
  const batches = useBatches();
  const [batchId, setBatchId] = useState('');
  const students = useStudents(batchId ? Number(batchId) : undefined);
  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(isoDaysFromToday(-14));
  const [to, setTo] = useState(todayIso());
  const [page, setPage] = useState(0);
  const query = useQuery(
    () => attendanceApi.history({ batchId, studentId, status, from, to, page, size: 25 }),
    [batchId, studentId, status, from, to, page],
  );
  const { run, busy } = useAction();
  const [editing, setEditing] = useState<{ record: AttendanceRecord; mark: AttendanceMark } | null>(null);

  const startCorrection = (record: AttendanceRecord) => setEditing({
    record,
    mark: {
      status: record.status,
      lateMinutes: record.lateMinutes,
      absenceReason: record.absenceReason,
      noUniform: record.noUniform,
      noIdTag: record.noIdTag,
      remarks: record.remarks,
    },
  });

  const saveCorrection = async () => {
    if (!editing) return;
    const { record, mark } = editing;
    const saved = await run(() => attendanceApi.update(record.id, { ...mark, remarks: mark.remarks?.trim() || undefined }),
      'Attendance corrected');
    if (saved) {
      setEditing(null);
      query.reload();
    }
  };

  const filter = (apply: () => void) => {
    apply();
    setPage(0);
  };

  const rows = query.data?.content;
  const canCorrectAny = rows?.some((row) => row.canCorrect) ?? false;

  return (
    <div>
      <PageHeader title="Attendance history"
        subtitle="Mentors and faculty correct their own registers; parents are messaged only when a mark becomes absent or late" />
      <Card>
        <FilterBar>
          <SelectInput value={batchId} onChange={(v) => filter(() => { setBatchId(v); setStudentId(''); })} options={refOptions(batches)} placeholder="All batches" />
          <SelectInput value={studentId} onChange={(v) => filter(() => setStudentId(v))}
            options={students.map((student) => ({ value: student.id, label: `${student.fullName} (${student.admissionNumber})` }))} placeholder="All students" />
          <SelectInput value={status} onChange={(v) => filter(() => setStatus(v))} options={enumOptions(ATTENDANCE_STATUSES)} placeholder="Any status" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className="input" value={from} max={to} onChange={(event) => filter(() => setFrom(event.target.value))} aria-label="From" />
            <input type="date" className="input" value={to} min={from} onChange={(event) => filter(() => setTo(event.target.value))} aria-label="To" />
          </div>
        </FilterBar>
        <DataTable
          rows={rows}
          loading={query.loading}
          error={query.error}
          onRetry={query.reload}
          rowKey={(row) => row.id}
          empty="No attendance in this period"
          columns={[
            { header: 'Date', render: (row) => <span className="whitespace-nowrap">{formatDate(row.date)}</span> },
            {
              header: 'Student',
              render: (row) => (
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{row.student.name}</p>
                  <p className="text-xs text-slate-500">{row.admissionNumber}</p>
                </div>
              ),
            },
            { header: 'Batch', render: (row) => row.batch.name },
            { header: 'Class', render: (row) => row.subject?.name ?? 'Whole day' },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
            { header: 'Details', render: (row) => <MarkDetails mark={row} className="max-w-xs" /> },
            { header: 'Parent message', render: (row) => (row.notificationStatus ? <Badge value={row.notificationStatus} /> : '-') },
            { header: 'Marked', render: (row) => <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(row.markedAt)}</span> },
            ...(canCorrectAny ? [{
              header: '',
              render: (row: AttendanceRecord) => row.canCorrect && (
                <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => startCorrection(row)}>
                  <Pencil size={13} /> Correct
                </button>
              ),
            }] : []),
          ]}
        />
        {query.data && (
          <Pagination page={query.data.page} totalPages={query.data.totalPages} totalElements={query.data.totalElements} onChange={setPage} />
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        title={editing ? `${editing.record.student.name} - ${formatDate(editing.record.date)}` : ''}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={saveCorrection} disabled={busy}>
              {busy ? 'Saving…' : 'Save correction'}
            </button>
          </>
        }
      >
        {editing && (
          <>
            <p className="mb-3 text-sm text-slate-500">{editing.record.batch.name} &middot; {editing.record.subject?.name ?? 'Whole day'}</p>
            <MarkEditor showStatus value={editing.mark} onChange={(mark) => setEditing({ ...editing, mark })} />
          </>
        )}
      </Modal>
    </div>
  );
}

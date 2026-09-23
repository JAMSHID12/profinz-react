import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Save } from 'lucide-react';
import { assessmentApi } from '../../api/endpoints';
import { useAction, useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { Badge, Card, Loadable, Notice, PageHeader } from '../../components/ui';
import { formatDate } from '../../utils/format';
import type { PublicationStatus } from '../../types';
import { PublicationActions } from './Publication';

interface Row { marks: string; absent: boolean; remarks: string }

/** Marks entry for one test or exam. Faculty can only open the subjects they teach. */
export default function MarksEntryPage({ kind }: { kind: 'test' | 'exam' }) {
  const id = Number(useParams().id);
  const { can } = useAuth();
  const isTest = kind === 'test';
  const query = useQuery(() => (isTest ? assessmentApi.testSheet(id) : assessmentApi.examSheet(id)), [id, kind]);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const { run, busy } = useAction();
  const canEnter = can(isTest ? 'TEST_MARKS_ENTRY' : 'EXAM_MARKS_ENTRY');
  const canPublish = can(isTest ? 'TEST_PUBLISH' : 'EXAM_PUBLISH');

  useEffect(() => {
    if (!query.data) return;
    setRows(Object.fromEntries(query.data.rows.map((row) => [row.studentId, {
      marks: row.marksObtained === undefined || row.marksObtained === null ? '' : String(row.marksObtained),
      absent: row.absent,
      remarks: row.remarks ?? '',
    }])));
  }, [query.data]);

  const update = (studentId: number, change: Partial<Row>) =>
    setRows((current) => ({ ...current, [studentId]: { ...current[studentId], ...change } }));

  const save = async () => {
    const entries = Object.entries(rows)
      .filter(([, row]) => row.absent || row.marks.trim() !== '')
      .map(([studentId, row]) => ({
        studentId: Number(studentId),
        marksObtained: row.absent ? undefined : Number(row.marks),
        absent: row.absent,
        remarks: row.remarks || undefined,
      }));
    const sheet = await run(
      () => (isTest ? assessmentApi.saveTestMarks(id, entries) : assessmentApi.saveExamMarks(id, entries)),
      'Marks saved',
    );
    if (sheet) query.setData(sheet);
  };

  const move = async (next: PublicationStatus) => {
    const done = await run<unknown>(
      () => (isTest ? assessmentApi.testStatus(id, next) : assessmentApi.examStatus(id, next)),
      `Moved to ${next.toLowerCase()}`,
    );
    if (done) query.reload();
  };

  return (
    <Loadable query={query}>
      {(sheet) => {
        const max = Number(sheet.maxMarks);
        const invalid = Object.values(rows).some((row) => !row.absent && row.marks !== '' && (Number.isNaN(Number(row.marks)) || Number(row.marks) < 0 || Number(row.marks) > max));
        const entered = Object.values(rows).filter((row) => row.absent || row.marks !== '').length;
        return (
          <div>
            <Link to={isTest ? '/tests' : '/exams'} className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
              <ArrowLeft size={14} /> Back to {isTest ? 'tests' : 'exams'}
            </Link>
            <PageHeader
              title={sheet.title}
              subtitle={`${sheet.batch.name} · ${sheet.subject.name} · ${formatDate(sheet.date)} · out of ${sheet.maxMarks}${sheet.passingMarks ? `, pass ${sheet.passingMarks}` : ''}`}
              actions={
                <>
                  <Badge value={sheet.status} />
                  {canPublish && <PublicationActions status={sheet.status} busy={busy} onChange={move} size="md" />}
                </>
              }
            />
            {!sheet.editable && (
              <div className="mb-4"><Notice tone="warning"><Lock size={14} className="mr-1 inline" /> Published marks are locked. Withdraw the results to correct them.</Notice></div>
            )}
            <Card>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Student</th><th className="w-36">Marks</th><th>Absent</th><th>Grade</th><th>Remarks</th></tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row) => {
                      const value = rows[row.studentId] ?? { marks: '', absent: false, remarks: '' };
                      const bad = !value.absent && value.marks !== '' && (Number(value.marks) > max || Number(value.marks) < 0 || Number.isNaN(Number(value.marks)));
                      const editable = sheet.editable && canEnter;
                      return (
                        <tr key={row.studentId}>
                          <td>
                            <p className="font-medium text-slate-800">{row.fullName}</p>
                            <p className="text-xs text-slate-500">{row.admissionNumber}</p>
                          </td>
                          <td>
                            <input className={`input ${bad ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}`} inputMode="decimal"
                              value={value.absent ? '' : value.marks} disabled={!editable || value.absent}
                              onChange={(event) => update(row.studentId, { marks: event.target.value })} aria-label={`Marks for ${row.fullName}`} />
                          </td>
                          <td>
                            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={value.absent} disabled={!editable}
                              onChange={(event) => update(row.studentId, { absent: event.target.checked })} aria-label={`${row.fullName} absent`} />
                          </td>
                          <td>{row.grade ?? '-'}</td>
                          <td>
                            <input className="input" value={value.remarks} disabled={!editable}
                              onChange={(event) => update(row.studentId, { remarks: event.target.value })} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {sheet.editable && canEnter && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                  <p className="text-xs text-slate-500">
                    {entered} of {sheet.rows.length} entered{invalid && <span className="ml-2 text-rose-600">Marks must be between 0 and {sheet.maxMarks}</span>}
                  </p>
                  <button type="button" className="btn-primary" onClick={save} disabled={busy || invalid || entered === 0}>
                    <Save size={16} /> Save marks
                  </button>
                </div>
              )}
            </Card>
          </div>
        );
      }}
    </Loadable>
  );
}

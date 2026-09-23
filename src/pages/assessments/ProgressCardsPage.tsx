import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Printer } from 'lucide-react';
import { progressApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { DataTable } from '../../components/DataTable';
import { ProgressCardView } from '../../components/academic';
import { blankToUndefined, enumOptions, Field, FilterBar, numberOrUndefined, refOptions, SelectInput, TextArea, TextInput } from '../../components/forms';
import { Badge, Card, Modal, PageHeader } from '../../components/ui';
import { formatDate, formatPercent, isoDaysFromToday, todayIso } from '../../utils/format';
import type { ProgressCard, PublicationStatus } from '../../types';
import { PublicationActions } from './Publication';
import { StudentPicker } from '../operations/DisciplinePage';

const STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED'] as const;

export default function ProgressCardsPage() {
  const { can } = useAuth();
  const { config } = useConfig();
  const batches = useBatches();
  const [params, setParams] = useSearchParams();
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('');
  const query = useQuery(() => progressApi.search({ batchId, status }), [batchId, status]);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState<ProgressCard | null>(null);
  const [remarks, setRemarks] = useState('');
  const [itemRemarks, setItemRemarks] = useState<Record<number, string>>({});
  const gen = useForm({ mode: 'batch', batchId: '', studentId: '', title: '', periodStart: isoDaysFromToday(-30), periodEnd: todayIso(), mentorRemarks: '' });
  const { run, busy, errors } = useAction();

  const openCard = async (id: number) => {
    const card = await run(() => progressApi.detail(id));
    if (card) {
      setOpen(card);
      setRemarks(card.mentorRemarks ?? '');
      setItemRemarks(Object.fromEntries((card.items ?? []).map((item) => [item.id, item.remarks ?? ''])));
    }
  };

  useEffect(() => {
    const requested = Number(params.get('open'));
    if (requested) {
      openCard(requested);
      setParams({}, { replace: true });
    }
  }, [params]);

  const generate = async () => {
    const v = gen.values;
    const cards = await run(() => progressApi.generate({
      batchId: v.mode === 'batch' ? numberOrUndefined(v.batchId) : undefined,
      studentId: v.mode === 'student' ? numberOrUndefined(v.studentId) : undefined,
      title: v.title,
      periodStart: v.periodStart,
      periodEnd: v.periodEnd,
      mentorRemarks: blankToUndefined(v.mentorRemarks),
    }));
    if (cards) {
      setGenerating(false);
      query.reload();
      window.alert(`${cards.length} progress card(s) generated as drafts. Review and publish them when ready.`);
    }
  };

  const saveRemarks = async () => {
    if (!open) return;
    const saved = await run(() => progressApi.update(open.id, {
      title: open.title,
      mentorRemarks: remarks,
      items: Object.entries(itemRemarks).map(([itemId, value]) => ({ itemId: Number(itemId), remarks: value })),
    }), 'Progress card updated');
    if (saved) {
      setOpen(saved);
      query.reload();
    }
  };

  const move = async (card: ProgressCard, next: PublicationStatus) => {
    const saved = await run(() => progressApi.status(card.id, next), `Progress card moved to ${next.toLowerCase()}`);
    if (saved) {
      query.reload();
      if (open?.id === card.id) setOpen({ ...open, status: saved.status, publishedAt: saved.publishedAt });
    }
  };

  const editable = open && open.status !== 'PUBLISHED' && can('PROGRESS_CARD_CREATE');

  return (
    <div>
      <PageHeader title="Progress cards" subtitle="Generated from attendance, tests, exams, syllabus and discipline; published after review"
        actions={can('PROGRESS_CARD_CREATE') && <button type="button" className="btn-primary" onClick={() => setGenerating(true)}><Plus size={16} /> Generate</button>} />
      <Card>
        <FilterBar>
          <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="All batches" />
          <SelectInput value={status} onChange={setStatus} options={enumOptions(STATUSES)} placeholder="Any status" />
        </FilterBar>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id}
          empty="No progress cards" onRowClick={(row) => openCard(row.id)}
          columns={[
            { header: 'Student', render: (row) => <span className="font-medium text-slate-800">{row.student.name}</span> },
            { header: 'Batch', render: (row) => row.batch?.name ?? '-' },
            { header: 'Title', render: (row) => row.title },
            { header: 'Period', render: (row) => `${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}` },
            { header: 'Performance', render: (row) => `${formatPercent(row.performanceScore)}${row.grade ? ` (${row.grade})` : ''}` },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
            { header: '', render: (row) => can('PROGRESS_CARD_PUBLISH') && (
              <div onClick={(event) => event.stopPropagation()}><PublicationActions status={row.status} busy={busy} onChange={(next) => move(row, next)} /></div>
            ) },
          ]} />
      </Card>

      <Modal open={generating} title="Generate progress cards" onClose={() => setGenerating(false)} wide
        footer={<><button type="button" className="btn-secondary" onClick={() => setGenerating(false)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={generate} disabled={busy}>Generate drafts</button></>}>
        <Field label="For">
          <SelectInput value={gen.values.mode} onChange={(v) => gen.set('mode', v)}
            options={[{ value: 'batch', label: 'Every student of a batch' }, { value: 'student', label: 'One student' }]} />
        </Field>
        {gen.values.mode === 'batch' ? (
          <Field label="Batch" error={errors.batchId}><SelectInput value={gen.values.batchId} onChange={(v) => gen.set('batchId', v)} options={refOptions(batches)} placeholder="Select" /></Field>
        ) : (
          <StudentPicker batchId={gen.values.batchId} studentId={gen.values.studentId} error={errors.studentId}
            onBatch={(v) => gen.set('batchId', v)} onStudent={(v) => gen.set('studentId', v)} />
        )}
        <Field label="Title" error={errors.title}><TextInput value={gen.values.title} onChange={(v) => gen.set('title', v)} placeholder="Monthly progress - June" /></Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Period from" error={errors.periodStart}><input type="date" className="input" value={gen.values.periodStart} onChange={(e) => gen.set('periodStart', e.target.value)} /></Field>
          <Field label="Period to" error={errors.periodEnd}><input type="date" className="input" value={gen.values.periodEnd} onChange={(e) => gen.set('periodEnd', e.target.value)} /></Field>
        </div>
        <Field label="Mentor remarks (optional, for every card)"><TextArea value={gen.values.mentorRemarks} onChange={(v) => gen.set('mentorRemarks', v)} rows={2} /></Field>
      </Modal>

      <Modal open={open !== null} title="Progress card" onClose={() => setOpen(null)} wide
        footer={open && (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {can('PROGRESS_CARD_PUBLISH') ? <PublicationActions status={open.status} busy={busy} onChange={(next) => move(open, next)} size="md" /> : <span />}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>
              {editable && <button type="button" className="btn-primary" onClick={saveRemarks} disabled={busy}>Save remarks</button>}
            </div>
          </div>
        )}>
        {open && (
          <div className="space-y-4">
            <ProgressCardView card={editable ? { ...open, mentorRemarks: undefined } : open} centreName={config.client.name} />
            {editable && (
              <>
                <Field label="Mentor remarks"><TextArea value={remarks} onChange={setRemarks} rows={3} /></Field>
                {(open.items ?? []).map((item) => (
                  <Field key={item.id} label={`Remarks for ${item.subjectName}`} className="mb-2">
                    <TextInput value={itemRemarks[item.id] ?? ''} onChange={(v) => setItemRemarks((current) => ({ ...current, [item.id]: v }))} />
                  </Field>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Pencil, Plus, Power, RotateCcw } from 'lucide-react';
import { assessmentApi, disciplineApi, educationCategoryApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { SetupTable as DataTable } from './SetupTable';
import { Checkbox, Field, numberOrUndefined, TextInput } from '../../components/forms';
import { Badge, Card, CardHeader, Modal, PageHeader } from '../../components/ui';
import { formatMoney } from '../../utils/format';

type Kind = 'discipline' | 'exam' | 'education';
interface Editable { id?: number; code: string; name: string; displayOrder: number; active: boolean; defaultFineAmount?: number }

/** Per-client lists that would otherwise be hard-coded: discipline and exam types. */
export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<Kind>('education');
  const [changingStatus, setChangingStatus] = useState<Editable | null>(null);
  const educationCategories = useQuery(() => educationCategoryApi.list(), []);
  const disciplineTypes = useQuery(() => disciplineApi.types(), []);
  const examTypes = useQuery(() => assessmentApi.examTypes(), []);
  const [editing, setEditing] = useState<{ kind: Kind; item: Editable | null } | null>(null);
  const { values, set, setValues } = useForm({ code: '', name: '', displayOrder: '', active: true, defaultFineAmount: '' });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    if (!editing) return;
    setErrors({});
    const item = editing.item;
    setValues({
      code: item?.code ?? '',
      name: item?.name ?? '',
      displayOrder: item ? String(item.displayOrder) : '',
      active: item?.active ?? true,
      defaultFineAmount: item?.defaultFineAmount ? String(item.defaultFineAmount) : '',
    });
  }, [editing]);

  const save = async () => {
    if (!editing) return;
    const body = {
      code: values.code,
      name: values.name,
      displayOrder: numberOrUndefined(values.displayOrder),
      active: values.active,
      defaultFineAmount: editing.kind === 'discipline' ? numberOrUndefined(values.defaultFineAmount) : undefined,
    };
    const id = editing.item?.id;
    const saved = await run(
      () => (editing.kind === 'education' ? educationCategoryApi.save(id, body) : editing.kind === 'discipline' ? disciplineApi.saveType(id, body) : assessmentApi.saveExamType(id, body)),
      'Saved',
    );
    if (saved) {
      setEditing(null);
      (editing.kind === 'education' ? educationCategories : editing.kind === 'discipline' ? disciplineTypes : examTypes).reload();
    }
  };

  const definitions = {
    education: { title: 'Education category', singular: 'category', description: 'Used by student profiles and topic-based attendance. Inactive categories remain on existing records.' },
    discipline: { title: 'Discipline types', singular: 'discipline type', description: 'Manage discipline categories and their default fines. Inactive types remain on existing records.' },
    exam: { title: 'Exam types', singular: 'exam type', description: 'Manage exam categories and their display order. Inactive types remain on existing exams.' },
  };
  const definition = definitions[activeTab];
  const query = activeTab === 'education' ? educationCategories : activeTab === 'discipline' ? disciplineTypes : examTypes;
  const changeStatus = async () => {
    if (!changingStatus || busy) return;
    const body = { ...changingStatus, active: !changingStatus.active };
    const saved = await run(() => activeTab === 'education' ? educationCategoryApi.save(changingStatus.id, body) : activeTab === 'discipline' ? disciplineApi.saveType(changingStatus.id, body) : assessmentApi.saveExamType(changingStatus.id, body), body.active ? 'Activated' : 'Deactivated');
    if (saved) { setChangingStatus(null); query.reload(); }
  };

  return (
    <div className="setup-page">
      <PageHeader title="Master data" subtitle="Manage education categories, discipline types and exam types used in the system." />
      <nav className="setup-tabs" aria-label="Master data sections">
        {(['education', 'discipline', 'exam'] as const).map(kind => <button type="button" key={kind} aria-pressed={activeTab === kind} onClick={() => setActiveTab(kind)}>{definitions[kind].title}</button>)}
      </nav>
      <Card>
        <CardHeader title={definition.title} subtitle={definition.description} actions={<button type="button" className="btn-primary" onClick={() => setEditing({ kind: activeTab, item: null })}><Plus size={18} /> Add {definition.singular}</button>} />
        <DataTable<Editable> key={activeTab} rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={row => row.id!} empty={`No ${definition.title.toLowerCase()} yet`}
          columns={[
            { header: 'Code', render: row => row.code },
            { header: 'Name', render: row => row.name },
            activeTab === 'discipline' ? { header: 'Default fine', render: row => row.defaultFineAmount != null ? formatMoney(row.defaultFineAmount) : '—' } : { header: 'Order', render: row => row.displayOrder },
            { header: 'Status', render: row => <Badge value={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
            { header: 'Actions', className: 'w-36', render: row => <div className="setup-row-actions">
              <button type="button" className="btn-ghost" aria-label={`Edit ${row.name}`} title="Edit" onClick={() => setEditing({ kind: activeTab, item: row })}><Pencil size={18} /></button>
              <button type="button" className={`btn-ghost ${row.active ? 'setup-deactivate' : ''}`} aria-label={`${row.active ? 'Deactivate' : 'Reactivate'} ${row.name}`} title={row.active ? 'Deactivate' : 'Reactivate'} onClick={() => setChangingStatus(row)}>{row.active ? <Power size={18} /> : <RotateCcw size={18} />}</button>
            </div> },
          ]} />
      </Card>
      <Modal className="setup-dialog" open={changingStatus !== null} title={`${changingStatus?.active ? 'Deactivate' : 'Reactivate'} ${definition.singular}`} onClose={() => { if (!busy) setChangingStatus(null); }} footer={<><button type="button" className="btn-secondary" disabled={busy} onClick={() => setChangingStatus(null)}>Cancel</button><button type="button" className={changingStatus?.active ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={changeStatus}>{busy ? 'Saving…' : changingStatus?.active ? 'Deactivate' : 'Reactivate'}</button></>}>
        <p className="text-sm text-slate-600">{changingStatus?.active ? `Deactivate ${changingStatus.name}? Existing records will be preserved.` : `Make ${changingStatus?.name} available again?`}</p>
      </Modal>
      <Modal className="setup-dialog" open={editing !== null} title={`${editing?.item ? 'Edit' : 'Add'} ${editing?.kind === 'education' ? 'education category' : editing?.kind === 'exam' ? 'exam type' : 'discipline type'}`}
        onClose={() => { if (!busy) setEditing(null); }}
        footer={<><button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
          <button type="submit" form="master-data-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
        <form id="master-data-form" onSubmit={event => { event.preventDefault(); if (!busy) void save(); }}><fieldset disabled={busy}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Code" error={errors.code}><TextInput aria-label="Code" required value={values.code} onChange={(v) => set('code', v)} disabled={editing?.kind === 'education' && Boolean(editing.item)} /></Field>
          <Field label="Display order"><TextInput aria-label="Display order" type="number" min="0" value={values.displayOrder} onChange={(v) => set('displayOrder', v)} inputMode="numeric" /></Field>
        </div>
        <Field label="Name" error={errors.name}><TextInput aria-label="Name" required value={values.name} onChange={(v) => set('name', v)} /></Field>
        {editing?.kind === 'discipline' && (
          <Field label="Default fine (optional)" error={errors.defaultFineAmount}>
            <TextInput aria-label="Default fine" type="number" min="0" step="0.01" value={values.defaultFineAmount} onChange={(v) => set('defaultFineAmount', v)} inputMode="decimal" />
          </Field>
        )}
        <Checkbox checked={values.active} onChange={(v) => set('active', v)} label="Active" />
        </fieldset></form>
      </Modal>
    </div>
  );
}

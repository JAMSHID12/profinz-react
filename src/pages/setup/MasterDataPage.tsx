import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { assessmentApi, disciplineApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { DataTable } from '../../components/DataTable';
import { Checkbox, Field, numberOrUndefined, TextInput } from '../../components/forms';
import { Badge, Card, CardHeader, Modal, PageHeader } from '../../components/ui';
import { formatMoney } from '../../utils/format';

type Kind = 'discipline' | 'exam';
interface Editable { id?: number; code: string; name: string; displayOrder: number; active: boolean; defaultFineAmount?: number }

/** Per-client lists that would otherwise be hard-coded: discipline and exam types. */
export default function MasterDataPage() {
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
      () => (editing.kind === 'discipline' ? disciplineApi.saveType(id, body) : assessmentApi.saveExamType(id, body)),
      'Saved',
    );
    if (saved) {
      setEditing(null);
      (editing.kind === 'discipline' ? disciplineTypes : examTypes).reload();
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Master data" subtitle="Lists this centre can adapt without code changes" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Discipline types" actions={
            <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing({ kind: 'discipline', item: null })}><Plus size={14} /> Add</button>} />
          <DataTable rows={disciplineTypes.data} loading={disciplineTypes.loading} error={disciplineTypes.error} rowKey={(row) => row.id}
            columns={[
              { header: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
              { header: 'Name', render: (row) => row.name },
              { header: 'Default fine', render: (row) => (row.defaultFineAmount ? formatMoney(row.defaultFineAmount) : '-') },
              { header: 'Status', render: (row) => <Badge value={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
              { header: '', render: (row) => <button type="button" className="btn-ghost" aria-label="Edit"
                onClick={() => setEditing({ kind: 'discipline', item: row })}><Pencil size={14} /></button> },
            ]} />
        </Card>
        <Card>
          <CardHeader title="Exam types" actions={
            <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing({ kind: 'exam', item: null })}><Plus size={14} /> Add</button>} />
          <DataTable rows={examTypes.data} loading={examTypes.loading} error={examTypes.error} rowKey={(row) => row.id}
            columns={[
              { header: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
              { header: 'Name', render: (row) => row.name },
              { header: 'Order', render: (row) => row.displayOrder },
              { header: 'Status', render: (row) => <Badge value={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
              { header: '', render: (row) => <button type="button" className="btn-ghost" aria-label="Edit"
                onClick={() => setEditing({ kind: 'exam', item: row })}><Pencil size={14} /></button> },
            ]} />
        </Card>
      </div>
      <Modal open={editing !== null} title={`${editing?.item ? 'Edit' : 'Add'} ${editing?.kind === 'exam' ? 'exam type' : 'discipline type'}`}
        onClose={() => setEditing(null)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Code" error={errors.code}><TextInput value={values.code} onChange={(v) => set('code', v)} /></Field>
          <Field label="Display order"><TextInput value={values.displayOrder} onChange={(v) => set('displayOrder', v)} inputMode="numeric" /></Field>
        </div>
        <Field label="Name" error={errors.name}><TextInput value={values.name} onChange={(v) => set('name', v)} /></Field>
        {editing?.kind === 'discipline' && (
          <Field label="Default fine (optional)" error={errors.defaultFineAmount}>
            <TextInput value={values.defaultFineAmount} onChange={(v) => set('defaultFineAmount', v)} inputMode="decimal" />
          </Field>
        )}
        <Checkbox checked={values.active} onChange={(v) => set('active', v)} label="Active" />
      </Modal>
    </div>
  );
}

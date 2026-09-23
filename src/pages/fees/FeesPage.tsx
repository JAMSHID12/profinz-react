import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, Percent, Plus } from 'lucide-react';
import { feeApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches, useCourses, useStudents } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, Checkbox, enumOptions, Field, FilterBar, numberOrUndefined, refOptions, SelectInput, TextInput } from '../../components/forms';
import { Badge, Card, Modal, Notice, PageHeader, Tabs } from '../../components/ui';
import { formatDate, formatMoney, todayIso } from '../../utils/format';
import type { Course, FeePlan, Installment } from '../../types';
import DiscountDialog from './DiscountDialog';

const STATUSES = ['PENDING', 'PARTIAL', 'OVERDUE', 'PAID', 'WAIVED'] as const;
const METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'] as const;

/**
 * Fees work in two layers: every course has a fixed fee in the master data, and each
 * student's plan carries their own discount. Installments and payments follow from that.
 */
export default function FeesPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'installments' | 'plans'>('installments');
  const [planOpen, setPlanOpen] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <div>
      <PageHeader title="Fees" subtitle="Course fee from the course master, less each student's own discount"
        actions={can('FEE_MANAGE') && <button type="button" className="btn-primary" onClick={() => setPlanOpen(true)}><Plus size={16} /> New fee plan</button>} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'installments', label: 'Installments & collection' },
        { key: 'plans', label: 'Fee plans & discounts' },
      ]} />
      {tab === 'installments' ? <InstallmentsTab key={version} /> : <PlansTab key={version} />}
      <NewPlanDialog open={planOpen} onClose={() => setPlanOpen(false)}
        onSaved={() => { setPlanOpen(false); setVersion((v) => v + 1); setTab('plans'); }} />
    </div>
  );
}

// ---- Installments -------------------------------------------------------------------------------

function InstallmentsTab() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const batches = useBatches();
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('');
  const query = useQuery(() => feeApi.installments({ batchId, status }), [batchId, status]);
  const [paying, setPaying] = useState<Installment | null>(null);
  const { run, busy } = useAction();

  const waive = async (row: Installment) => {
    if (!window.confirm(`Waive ${formatMoney(row.pendingAmount)} for ${row.student.name}?`)) return;
    if (await run(() => feeApi.waive(row.id), 'Installment waived')) query.reload();
  };

  const remind = async (row: Installment) => {
    if (await run(() => feeApi.remind(row.id), 'Reminder queued for the parent')) query.reload();
  };

  const rows = query.data ?? null;
  const balance = (rows ?? []).reduce((sum, row) => sum + Number(row.pendingAmount), 0);

  return (
    <Card>
      <FilterBar>
        <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="All batches" />
        <SelectInput value={status} onChange={setStatus} options={enumOptions(STATUSES)} placeholder="Any status" />
        <div className="flex items-center text-sm text-slate-600 lg:col-span-2">
          {rows && <span>Balance of listed installments: <span className="font-semibold text-slate-800">{formatMoney(balance)}</span></span>}
        </div>
      </FilterBar>
      <DataTable rows={rows} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No installments found"
        columns={[
          { header: 'Student', render: (row) => (
            <button type="button" className="text-left" onClick={() => navigate(`/students/${row.student.id}`)}>
              <p className="font-medium text-slate-800 hover:text-brand-700">{row.student.name}</p>
              <p className="text-xs text-slate-500">{row.admissionNumber}{row.batch ? ` · ${row.batch.name}` : ''}</p>
            </button>
          ) },
          { header: 'Plan', render: (row) => `${row.planTitle} - ${row.label}` },
          { header: 'Due', render: (row) => formatDate(row.dueDate) },
          { header: 'Amount', render: (row) => formatMoney(row.amount) },
          { header: 'Balance', render: (row) => <span className="font-medium">{formatMoney(row.pendingAmount)}</span> },
          { header: 'Status', render: (row) => <Badge value={row.status} /> },
          { header: 'Reminders', render: (row) => (row.reminderCount > 0 ? `${row.reminderCount} (last ${formatDate(row.lastReminderDate)})` : '-') },
          {
            header: '',
            render: (row) => row.status !== 'PAID' && row.status !== 'WAIVED' && (
              <div className="flex justify-end gap-1.5">
                {can('PAYMENT_CREATE') && <button type="button" className="btn-primary btn-sm" onClick={() => setPaying(row)}>Collect</button>}
                {can('FEE_MANAGE') && (
                  <>
                    <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => remind(row)} title="Send a reminder"><BellRing size={13} /></button>
                    <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => waive(row)}>Waive</button>
                  </>
                )}
              </div>
            ),
          },
        ]} />
      <PaymentDialog installment={paying} onClose={() => setPaying(null)}
        onPaid={(paymentId) => { setPaying(null); navigate(`/payments/${paymentId}/receipt`); }} />
    </Card>
  );
}

function PaymentDialog({ installment, onClose, onPaid }: { installment: Installment | null; onClose: () => void; onPaid: (id: number) => void }) {
  const { values, set, setValues } = useForm({ amount: '', paymentDate: todayIso(), paymentMethod: 'CASH', referenceNumber: '', notes: '', notifyParent: true });
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    if (!installment) return;
    setErrors({});
    setValues({ amount: String(installment.pendingAmount), paymentDate: todayIso(), paymentMethod: 'CASH', referenceNumber: '', notes: '', notifyParent: true });
  }, [installment]);

  const save = async () => {
    if (!installment) return;
    const payment = await run(() => feeApi.recordPayment({
      installmentId: installment.id,
      amount: numberOrUndefined(values.amount),
      paymentDate: values.paymentDate,
      paymentMethod: values.paymentMethod,
      referenceNumber: blankToUndefined(values.referenceNumber),
      notes: blankToUndefined(values.notes),
      notifyParent: values.notifyParent,
    }), 'Payment recorded');
    if (payment) onPaid(payment.id);
  };

  return (
    <Modal open={installment !== null} title="Record payment" onClose={onClose}
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save and print receipt</button></>}>
      {installment && (
        <p className="mb-4 text-sm text-slate-600">
          {installment.student.name} &middot; {installment.planTitle} - {installment.label} &middot; balance{' '}
          <span className="font-semibold">{formatMoney(installment.pendingAmount)}</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Amount" error={errors.amount}><TextInput value={values.amount} onChange={(v) => set('amount', v)} inputMode="decimal" /></Field>
        <Field label="Date" error={errors.paymentDate}><input type="date" className="input" value={values.paymentDate} max={todayIso()} onChange={(e) => set('paymentDate', e.target.value)} /></Field>
        <Field label="Method"><SelectInput value={values.paymentMethod} onChange={(v) => set('paymentMethod', v)} options={enumOptions(METHODS)} /></Field>
        <Field label="Reference"><TextInput value={values.referenceNumber} onChange={(v) => set('referenceNumber', v)} placeholder="UPI / cheque no." /></Field>
      </div>
      <Field label="Notes"><TextInput value={values.notes} onChange={(v) => set('notes', v)} /></Field>
      <Checkbox checked={values.notifyParent} onChange={(v) => set('notifyParent', v)} label="Send a payment confirmation to the parent" />
    </Modal>
  );
}

// ---- Fee plans and discounts --------------------------------------------------------------------------

function PlansTab() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const courses = useCourses();
  const query = useQuery(() => feeApi.plans(), []);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [discountedOnly, setDiscountedOnly] = useState(false);
  const [editing, setEditing] = useState<FeePlan | null>(null);

  const rows = useMemo(() => {
    const text = search.trim().toLowerCase();
    return (query.data ?? []).filter((plan) =>
      plan.status !== 'CANCELLED'
      && (!courseId || plan.course?.id === Number(courseId))
      && (!discountedOnly || plan.discountAmount > 0)
      && (!text || plan.student.name.toLowerCase().includes(text) || plan.admissionNumber.toLowerCase().includes(text)));
  }, [query.data, search, courseId, discountedOnly]);

  const totals = rows.reduce((sum, plan) => ({
    fee: sum.fee + Number(plan.totalAmount),
    discount: sum.discount + Number(plan.discountAmount),
    net: sum.net + Number(plan.netAmount),
    paid: sum.paid + Number(plan.paidAmount),
    outstanding: sum.outstanding + Number(plan.outstandingAmount),
  }), { fee: 0, discount: 0, net: 0, paid: 0, outstanding: 0 });

  return (
    <Card>
      <FilterBar>
        <TextInput value={search} onChange={setSearch} placeholder="Search student or admission number" />
        <SelectInput value={courseId} onChange={setCourseId} options={refOptions(courses)} placeholder="All courses" />
        <div className="flex items-center"><Checkbox checked={discountedOnly} onChange={setDiscountedOnly} label="Only students with a discount" /></div>
      </FilterBar>
      {query.data && (
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-4 py-3 text-sm sm:grid-cols-5">
          <p><span className="block text-xs text-slate-500">Course fees</span><span className="font-semibold">{formatMoney(totals.fee)}</span></p>
          <p><span className="block text-xs text-slate-500">Discounts given</span><span className="font-semibold text-violet-700">{formatMoney(totals.discount)}</span></p>
          <p><span className="block text-xs text-slate-500">Payable</span><span className="font-semibold">{formatMoney(totals.net)}</span></p>
          <p><span className="block text-xs text-slate-500">Paid</span><span className="font-semibold text-emerald-700">{formatMoney(totals.paid)}</span></p>
          <p><span className="block text-xs text-slate-500">Balance</span><span className="font-semibold text-amber-700">{formatMoney(totals.outstanding)}</span></p>
        </div>
      )}
      <DataTable rows={query.data ? rows : null} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id}
        empty="No fee plans found"
        columns={[
          { header: 'Student', render: (row) => (
            <button type="button" className="text-left" onClick={() => navigate(`/students/${row.student.id}`)}>
              <p className="font-medium text-slate-800 hover:text-brand-700">{row.student.name}</p>
              <p className="text-xs text-slate-500">{row.admissionNumber}</p>
            </button>
          ) },
          { header: 'Plan', render: (row) => row.title },
          { header: 'Course fee', render: (row) => formatMoney(row.totalAmount) },
          { header: 'Discount', render: (row) => (row.discountAmount > 0 ? (
            <div>
              <p className="font-medium text-violet-700">- {formatMoney(row.discountAmount)}</p>
              {row.discountReason && <p className="text-xs text-slate-500">{row.discountReason}</p>}
            </div>
          ) : <span className="text-slate-400">-</span>) },
          { header: 'Payable', render: (row) => <span className="font-semibold">{formatMoney(row.netAmount)}</span> },
          { header: 'Paid', render: (row) => formatMoney(row.paidAmount) },
          { header: 'Balance', render: (row) => formatMoney(row.outstandingAmount) },
          { header: 'Status', render: (row) => <Badge value={row.status} /> },
          { header: '', render: (row) => can('FEE_MANAGE') && row.status === 'ACTIVE' && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(row)}><Percent size={13} /> Discount</button>
          ) },
        ]} />
      <DiscountDialog plan={editing} onClose={() => setEditing(null)}
        onSaved={(saved) => { setEditing(null); query.setData((query.data ?? []).map((plan) => (plan.id === saved.id ? saved : plan))); }} />
    </Card>
  );
}

// ---- New fee plan ----------------------------------------------------------------------------------------

interface DiscountRow { amount: string; reason: string }

function FeeInfo({ course }: { course?: Course }) {
  if (!course) return null;
  if (course.feeAmount === undefined || course.feeAmount === null) {
    return (
      <Notice tone="warning">
        No fee is set for {course.name}. Set it on the <Link to="/courses" className="font-semibold underline">Courses</Link> screen first.
      </Notice>
    );
  }
  return (
    <Notice>
      Course fee for <span className="font-semibold">{course.name}</span>: <span className="font-semibold">{formatMoney(course.feeAmount)}</span>
      {course.defaultInstallments ? `, normally in ${course.defaultInstallments} installment${course.defaultInstallments > 1 ? 's' : ''}` : ''}.
    </Notice>
  );
}

function NewPlanDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const batches = useBatches();
  const courses = useCourses();
  const [mode, setMode] = useState<'student' | 'batch'>('student');
  const [batchId, setBatchId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [discount, setDiscount] = useState<DiscountRow>({ amount: '', reason: '' });
  const [discounts, setDiscounts] = useState<Record<number, DiscountRow>>({});
  const [installments, setInstallments] = useState('');
  const [firstDueDate, setFirstDueDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const students = useStudents(batchId ? Number(batchId) : undefined);
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setStudentId('');
    setDiscount({ amount: '', reason: '' });
    setDiscounts({});
    setInstallments('');
    setNotes('');
    setFirstDueDate(todayIso());
  }, [open, mode]);

  const student = students.find((row) => row.id === Number(studentId));
  const batch = batches.find((row) => row.id === Number(batchId));
  const courseRef = mode === 'student' ? student?.course : batch?.course;
  const course = courses.find((row) => row.id === courseRef?.id);
  const fee = course?.feeAmount ?? null;
  const count = Number(installments || course?.defaultInstallments || 1);

  const payable = (amount: string) => {
    const value = Number(amount || 0);
    if (fee === null || Number.isNaN(value) || value < 0 || value > fee) return null;
    return fee - value;
  };

  const save = async () => {
    const common = {
      installmentCount: numberOrUndefined(installments),
      firstDueDate,
      notes: blankToUndefined(notes),
    };
    if (mode === 'student') {
      const saved = await run(() => feeApi.createPlan({
        ...common,
        studentId: Number(studentId),
        discountAmount: numberOrUndefined(discount.amount) ?? 0,
        discountReason: blankToUndefined(discount.reason),
      }), 'Fee plan created');
      if (saved) onSaved();
    } else {
      const result = await run(() => feeApi.createBulk({
        ...common,
        batchId: Number(batchId),
        discounts: Object.entries(discounts)
          .filter(([, row]) => Number(row.amount || 0) > 0)
          .map(([id, row]) => ({ studentId: Number(id), discountAmount: Number(row.amount), reason: blankToUndefined(row.reason) })),
      }));
      if (result) {
        window.alert(`${result.created.length} fee plan(s) created${result.skipped ? `, ${result.skipped} student(s) already had one` : ''}.`);
        onSaved();
      }
    }
  };

  const single = payable(discount.amount);
  const ready = fee !== null && (mode === 'student' ? Boolean(studentId) && single !== null : Boolean(batchId)
    && Object.values(discounts).every((row) => payable(row.amount) !== null));

  return (
    <Modal open={open} title="New fee plan" onClose={onClose} wide
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy || !ready}>Create</button></>}>
      <Field label="For">
        <SelectInput value={mode} onChange={(v) => setMode(v as 'student' | 'batch')}
          options={[{ value: 'student', label: 'One student' }, { value: 'batch', label: 'Every student of a batch' }]} />
      </Field>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="Batch" error={errors.batchId}>
          <SelectInput value={batchId} onChange={(v) => { setBatchId(v); setStudentId(''); setDiscounts({}); }}
            options={refOptions(batches)} placeholder={mode === 'batch' ? 'Select' : 'All batches'} />
        </Field>
        {mode === 'student' && (
          <Field label="Student" error={errors.studentId}>
            <SelectInput value={studentId} onChange={setStudentId} placeholder="Select"
              options={students.map((row) => ({ value: row.id, label: `${row.fullName} (${row.admissionNumber})` }))} />
          </Field>
        )}
      </div>

      <div className="mb-4"><FeeInfo course={course} /></div>

      {mode === 'student' ? (
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Discount for this student" hint="Leave empty for no discount" error={errors.discountAmount}>
            <TextInput value={discount.amount} onChange={(v) => setDiscount({ ...discount, amount: v })} inputMode="decimal" placeholder="0" />
          </Field>
          <Field label="Reason for the discount" error={errors.discountReason}>
            <TextInput value={discount.reason} onChange={(v) => setDiscount({ ...discount, reason: v })} maxLength={255}
              placeholder="Financial hardship" disabled={!Number(discount.amount || 0)} />
          </Field>
        </div>
      ) : batchId && (
        <div className="mb-4 max-h-72 overflow-y-auto rounded-lg border border-slate-200">
          <table className="table">
            <thead><tr><th>Student</th><th className="w-32">Discount</th><th>Reason</th><th>Payable</th></tr></thead>
            <tbody>
              {students.map((row) => {
                const entry = discounts[row.id] ?? { amount: '', reason: '' };
                const value = payable(entry.amount);
                return (
                  <tr key={row.id}>
                    <td><p className="font-medium text-slate-800">{row.fullName}</p><p className="text-xs text-slate-500">{row.admissionNumber}</p></td>
                    <td>
                      <input className={`input ${value === null && fee !== null ? 'border-rose-400' : ''}`} inputMode="decimal" placeholder="0"
                        value={entry.amount} onChange={(event) => setDiscounts({ ...discounts, [row.id]: { ...entry, amount: event.target.value } })}
                        aria-label={`Discount for ${row.fullName}`} />
                    </td>
                    <td>
                      <input className="input" value={entry.reason} maxLength={255} disabled={!Number(entry.amount || 0)}
                        onChange={(event) => setDiscounts({ ...discounts, [row.id]: { ...entry, reason: event.target.value } })}
                        aria-label={`Reason for ${row.fullName}`} />
                    </td>
                    <td className="whitespace-nowrap font-medium">{value === null ? '-' : formatMoney(value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {students.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No active students in this batch.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
        <Field label="Installments" hint={course?.defaultInstallments ? `Course default: ${course.defaultInstallments}` : undefined} error={errors.installmentCount}>
          <TextInput value={installments} onChange={setInstallments} inputMode="numeric" placeholder={String(course?.defaultInstallments ?? 1)} />
        </Field>
        <Field label="First due date" hint="Then monthly" error={errors.firstDueDate}>
          <input type="date" className="input" value={firstDueDate} onChange={(event) => setFirstDueDate(event.target.value)} />
        </Field>
        <Field label="Notes"><TextInput value={notes} onChange={setNotes} /></Field>
      </div>

      {mode === 'student' && single !== null && fee !== null && (
        <Notice>
          {formatMoney(fee)} course fee{Number(discount.amount || 0) > 0 ? ` - ${formatMoney(Number(discount.amount))} discount` : ''} ={' '}
          <span className="font-semibold">{formatMoney(single)}</span>
          {single > 0 ? `, in ${count} installment${count > 1 ? 's' : ''} of about ${formatMoney(single / count)}` : ' (nothing to collect)'}.
        </Notice>
      )}
      {mode === 'batch' && batchId && fee !== null && (
        <Notice>Students who already have a fee plan for this course and year are skipped.</Notice>
      )}
    </Modal>
  );
}

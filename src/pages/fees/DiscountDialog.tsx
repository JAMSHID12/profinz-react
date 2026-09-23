import { useEffect, useState } from 'react';
import { feeApi } from '../../api/endpoints';
import { useAction } from '../../hooks/useQuery';
import { Field, TextInput } from '../../components/forms';
import { Modal, Notice } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import type { FeePlan } from '../../types';

/**
 * Changes one student's discount. The course fee stays as billed; the new balance is divided
 * equally over the installments not yet paid, and nothing already paid is touched.
 */
export default function DiscountDialog({ plan, onClose, onSaved }: {
  plan: FeePlan | null;
  onClose: () => void;
  onSaved: (plan: FeePlan) => void;
}) {
  const [discount, setDiscount] = useState('');
  const [reason, setReason] = useState('');
  const { run, busy, errors, setErrors } = useAction();

  useEffect(() => {
    if (!plan) return;
    setErrors({});
    setDiscount(String(plan.discountAmount ?? 0));
    setReason(plan.discountReason ?? '');
  }, [plan]);

  if (!plan) return null;
  const amount = Number(discount || 0);
  const invalid = Number.isNaN(amount) || amount < 0 || amount > plan.totalAmount;
  const payable = invalid ? null : plan.totalAmount - amount;

  const save = async () => {
    const saved = await run(() => feeApi.changeDiscount(plan.id, amount, reason.trim() || undefined), 'Discount updated');
    if (saved) onSaved(saved);
  };

  return (
    <Modal open title={`Discount for ${plan.student.name}`} onClose={onClose}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy || invalid}>Save discount</button>
      </>}>
      <dl className="mb-4 grid grid-cols-2 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm">
        <dt className="text-slate-500">Fee plan</dt><dd className="text-slate-800">{plan.title}</dd>
        <dt className="text-slate-500">Course fee</dt><dd className="font-medium text-slate-800">{formatMoney(plan.totalAmount)}</dd>
        <dt className="text-slate-500">Current discount</dt>
        <dd className="text-slate-800">{formatMoney(plan.discountAmount)}{plan.discountReason ? ` (${plan.discountReason})` : ''}</dd>
        <dt className="text-slate-500">Paid so far</dt><dd className="text-slate-800">{formatMoney(plan.paidAmount)}</dd>
      </dl>
      <Field label="New discount" error={errors.discountAmount ?? (invalid ? `Between 0 and ${formatMoney(plan.totalAmount)}` : undefined)}>
        <TextInput value={discount} onChange={setDiscount} inputMode="decimal" autoFocus />
      </Field>
      <Field label="Reason" hint="e.g. Financial hardship, Sibling concession, Merit scholarship" error={errors.reason}>
        <TextInput value={reason} onChange={setReason} maxLength={255} />
      </Field>
      {payable !== null && (
        <Notice>
          The student will pay <span className="font-semibold">{formatMoney(payable)}</span> in total. The balance is
          divided equally over the installments not yet paid.
        </Notice>
      )}
    </Modal>
  );
}

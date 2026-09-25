import { useEffect, useState } from 'react';
import { studentApi, educationCategoryApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useBatches } from '../../hooks/lookups';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';
import { Modal } from '../../components/ui';
import { blankToUndefined, Checkbox, enumOptions, Field, numberOrUndefined, SelectInput, TextArea, TextInput } from '../../components/forms';
import type { StudentDetail } from '../../types';

const STATUSES = ['ACTIVE', 'INACTIVE', 'COMPLETED', 'DROPPED', 'SUSPENDED'] as const;
const EMPTY = {
  educationCategory: '', fullName: '', dateOfBirth: '', gender: '', mobile: '', email: '', address: '',
  parentName: '', parentPhoneNumber: '', parentWhatsappOptIn: false,
  batchId: '', admissionDate: '', status: 'ACTIVE', createLogin: true,
};

export default function StudentForm({ open, student, onClose, onSaved }: {
  open: boolean; student?: StudentDetail | null; onClose: () => void;
  onSaved: (student: StudentDetail) => void;
}) {
  const batches = useBatches();
  const categories = useQuery(() => educationCategoryApi.list(), [], open);
  const { values, set, setValues } = useForm(EMPTY);
  const { run, busy, errors, setErrors } = useAction();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const existingPhoto = usePhotoUrl(open ? student?.photoUrl : undefined);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setPhoto(null);
    setValues(student ? {
      educationCategory: student.educationCategoryDetail ? String(student.educationCategoryDetail.id) : '', fullName: student.fullName, dateOfBirth: student.dateOfBirth ?? '', gender: student.gender ?? '',
      mobile: student.mobile ?? '', email: student.email ?? '', address: student.address ?? '',
      parentName: student.parent?.name ?? '', parentPhoneNumber: student.parent?.phoneNumber ?? '',
      parentWhatsappOptIn: student.parent?.whatsappOptIn ?? false,
      batchId: student.batch ? String(student.batch.id) : '', admissionDate: student.admissionDate ?? '',
      status: student.status, createLogin: false,
    } : EMPTY);
  }, [open, student, setValues, setErrors]);

  useEffect(() => {
    if (!photo) { setPreview(undefined); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const save = async () => {
    const invalid: Record<string, string> = {};
    if (!values.fullName.trim()) invalid.fullName = 'Student name is required';
    if (!student && !values.batchId) invalid.batchId = 'Select a batch';
    if (!values.parentName.trim()) invalid.parentName = 'Parent name is required';
    if (!/^\+?[0-9]{7,15}$/.test(values.parentPhoneNumber.trim())) invalid.parentPhoneNumber = 'Include country code and 7–15 digits';
    if (Object.keys(invalid).length) { setErrors(invalid); return; }
    const body = {
      educationCategoryId: numberOrUndefined(values.educationCategory),
      fullName: values.fullName.trim(), dateOfBirth: blankToUndefined(values.dateOfBirth),
      gender: blankToUndefined(values.gender), mobile: blankToUndefined(values.mobile),
      email: blankToUndefined(values.email), address: blankToUndefined(values.address),
      parentName: values.parentName.trim(), parentPhoneNumber: values.parentPhoneNumber.trim(),
      parentWhatsappOptIn: values.parentWhatsappOptIn,
      batchId: student ? student.batch?.id : numberOrUndefined(values.batchId),
      admissionDate: blankToUndefined(values.admissionDate), status: values.status,
      createLogin: student ? undefined : values.createLogin,
    };
    const saved = await run(() => studentApi.save(student?.id, body, photo), student ? 'Student updated' : 'Student registered');
    if (saved) onSaved(saved);
  };

  return (
    <Modal open={open} title={student ? `Edit ${student.fullName}` : 'Register student'} onClose={() => { if (!busy) onClose(); }} wide
      footer={<><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : student ? 'Save changes' : 'Register student'}</button></>}>
      <div className="mb-5 grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2">
        <div><p className="text-xs font-medium text-slate-500">Admission number</p><p className="mt-1 text-sm font-semibold text-slate-800">{student?.admissionNumber ?? 'Generated when registered'}</p></div>
        <div><p className="text-xs font-medium text-slate-500">Student ID</p><p className="mt-1 text-sm font-semibold text-slate-800">{student?.studentCode ?? 'Generated from course and batch'}</p></div>
      </div>
      <h3 className="mb-3 font-semibold text-slate-900">Student details</h3>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.fullName}><TextInput value={values.fullName} onChange={v => set('fullName', v)} /></Field>
        <Field label="Batch / class" hint={student ? 'Use Move to batch to change placement' : 'Course is determined by the selected batch'} error={errors.batchId}>
          <SelectInput value={values.batchId} onChange={v => set('batchId', v)} disabled={Boolean(student)} placeholder="Select batch"
            options={batches.map(batch => ({ value: String(batch.id), label: `${batch.name} · ${batch.course.name}` }))} />
        </Field>
        <Field label="Education category" hint="Required before attendance for a category-specific topic" error={errors.educationCategoryId ?? categories.error ?? undefined}>
          <SelectInput value={values.educationCategory} onChange={v => set('educationCategory', v)} placeholder={categories.loading ? "Loading categories…" : "Select category"} disabled={categories.loading || Boolean(categories.error)}
            options={(categories.data ?? []).filter(c => c.active || c.id === student?.educationCategoryDetail?.id).map(c => ({ value: String(c.id), label: c.name + (c.active ? '' : ' (inactive)') }))} />
        </Field>
        <Field label="Date of birth" error={errors.dateOfBirth}><input type="date" className="input" value={values.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} /></Field>
        <Field label="Gender"><SelectInput value={values.gender} onChange={v => set('gender', v)} placeholder="Select"
          options={['Female', 'Male', 'Other'].map(value => ({ value, label: value }))} /></Field>
        <Field label="Student mobile" error={errors.mobile}><TextInput value={values.mobile} onChange={v => set('mobile', v)} inputMode="tel" /></Field>
        <Field label="E-mail" error={errors.email}><TextInput value={values.email} onChange={v => set('email', v)} type="email" /></Field>
        <Field label="Admission date" error={errors.admissionDate} hint="Defaults to today"><input type="date" className="input" value={values.admissionDate} onChange={e => set('admissionDate', e.target.value)} /></Field>
        {student && <Field label="Status"><SelectInput value={values.status} onChange={v => set('status', v)} options={enumOptions(STATUSES)} /></Field>}
      </div>
      <div className="my-4 border-t border-slate-200 pt-4">
        <h3 className="mb-3 font-semibold text-slate-900">Parent / guardian</h3>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Parent name" error={errors.parentName}><TextInput value={values.parentName} onChange={v => set('parentName', v)} /></Field>
          <Field label="Parent phone number" error={errors.parentPhoneNumber} hint="Include country code, e.g. +919876543210"><TextInput value={values.parentPhoneNumber} onChange={v => set('parentPhoneNumber', v)} inputMode="tel" /></Field>
        </div>
        <Checkbox checked={values.parentWhatsappOptIn} onChange={v => set('parentWhatsappOptIn', v)} label="Parent has agreed to receive WhatsApp attendance and fee updates" />
      </div>
      <div className="my-4 border-t border-slate-200 pt-4">
        <Field label="Student photo" hint="JPEG or PNG, up to 5 MB. Shown on the attendance register." error={errors.photo}>
          <input key={`${open}-${student?.id ?? 'new'}`} type="file" accept="image/jpeg,image/png" className="input" disabled={busy} onChange={e => {
            const file = e.target.files?.[0] ?? null;
            if (file && (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
              setErrors({ photo: 'Choose a JPEG or PNG photo no larger than 5 MB' }); e.target.value = ''; setPhoto(null); return;
            }
            setErrors({}); setPhoto(file);
          }} />
        </Field>
        {(preview || existingPhoto) && <img src={preview ?? existingPhoto} alt="Student photo preview" className="mb-3 h-24 w-24 rounded-xl border border-slate-200 object-cover" />}
      </div>
      <Field label="Address" error={errors.address}><TextArea value={values.address} onChange={v => set('address', v)} rows={2} /></Field>
      {!student && <Checkbox checked={values.createLogin} onChange={v => set('createLogin', v)} label="Create a student portal login using the generated admission number" />}
    </Modal>
  );
}

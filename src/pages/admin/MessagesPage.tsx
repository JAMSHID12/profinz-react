import { useState } from 'react';
import { RotateCcw, Send } from 'lucide-react';
import { messageApi } from '../../api/endpoints';
import { useAction, useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { enumOptions, Field, FilterBar, SelectInput, TextInput, TextArea } from '../../components/forms';
import { Badge, Card, Modal, PageHeader, Pagination } from '../../components/ui';
import { formatDateTime, titleCase } from '../../utils/format';

const STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'] as const;
const CHANNELS = ['WHATSAPP', 'IN_APP', 'SMS', 'EMAIL'] as const;
const EVENTS = ['STUDENT_ABSENT', 'STUDENT_LATE', 'FEE_DUE', 'PAYMENT_RECEIVED', 'EXAM_RESULT_PUBLISHED', 'PROGRESS_CARD_PUBLISHED', 'FINE_CREATED', 'CLASS_SCHEDULE_CHANGED', 'GENERAL'] as const;

/** Every message the platform queued, per channel, with its delivery status. */
export default function MessagesPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [event, setEvent] = useState('');
  const [page, setPage] = useState(0);
  const query = useQuery(() => messageApi.logs({ status, channel, event, page, size: 25 }), [status, channel, event, page]);
  const [testing, setTesting] = useState(false);
  const [phone, setPhone] = useState('');
  const [parameters, setParameters] = useState('');
  const { run, busy, errors } = useAction();

  const retry = async (id: number) => {
    if (await run(() => messageApi.retry(id), 'Queued for another attempt')) query.reload();
  };

  const sendTest = async () => {
    if (await run(() => messageApi.test(phone, undefined, parameters.trim() ? parameters.split(/\r?\n/).map(v => v.trim()) : undefined), 'Test message sent')) setTesting(false);
  };

  const filter = (apply: () => void) => {
    apply();
    setPage(0);
  };

  return (
    <div>
      <PageHeader title="Messages" subtitle="WhatsApp and in-app notifications sent to parents and students"
        actions={can('NOTIFICATION_MANAGE') && <button type="button" className="btn-secondary" onClick={() => setTesting(true)}><Send size={16} /> Send test</button>} />
      <Card>
        <FilterBar>
          <SelectInput value={status} onChange={(v) => filter(() => setStatus(v))} options={enumOptions(STATUSES)} placeholder="Any status" />
          <SelectInput value={channel} onChange={(v) => filter(() => setChannel(v))} options={enumOptions(CHANNELS)} placeholder="Any channel" />
          <SelectInput value={event} onChange={(v) => filter(() => setEvent(v))} options={enumOptions(EVENTS)} placeholder="Any event" />
        </FilterBar>
        <DataTable rows={query.data?.content} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No messages"
          columns={[
            { header: 'Created', render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span> },
            { header: 'Event', render: (row) => titleCase(row.eventType) },
            { header: 'Channel', render: (row) => titleCase(row.channel) },
            { header: 'To', render: (row) => (
              <div>
                <p className="text-sm text-slate-800">{row.recipientType === 'PARENT' ? row.parentName : row.studentName}</p>
                <p className="text-xs text-slate-500">{row.destination ?? ''}</p>
              </div>
            ) },
            { header: 'Message', render: (row) => <span className="line-clamp-2 max-w-md text-xs text-slate-600">{row.preview ?? row.title}</span> },
            { header: 'Status', render: (row) => (
              <div>
                <Badge value={row.status} />
                {row.errorMessage && <p className="mt-1 max-w-xs text-xs text-rose-600">{row.errorMessage}</p>}
              </div>
            ) },
            { header: 'Tries', render: (row) => row.retryCount },
            { header: '', render: (row) => can('NOTIFICATION_MANAGE') && row.status === 'FAILED' && (
              <button type="button" className="btn-secondary btn-sm" onClick={() => retry(row.id)} disabled={busy}><RotateCcw size={13} /> Retry</button>
            ) },
          ]} />
        {query.data && <Pagination page={query.data.page} totalPages={query.data.totalPages} totalElements={query.data.totalElements} onChange={setPage} />}
      </Card>
      <Modal open={testing} title="Send a test WhatsApp message" onClose={() => setTesting(false)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setTesting(false)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={sendTest} disabled={busy || !phone}>Send</button></>}>
        <Field label="Phone number" error={errors.phoneNumber}><TextInput value={phone} onChange={setPhone} placeholder="+919876543210" /></Field>
        <Field label="WABI template parameters" hint="One per line, in the approved template order: parent, student, class, date, centre.">
          <TextArea value={parameters} onChange={setParameters} rows={5} />
        </Field>
        <p className="text-xs text-slate-500">WABI uses its key-bound template. Send only to a consented test number.</p>
        <p className="text-xs text-slate-500">In mock mode nothing leaves the server; the result shows what would be sent.</p>
      </Modal>
    </div>
  );
}

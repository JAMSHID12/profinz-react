import { useState } from 'react';
import { adminApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { DataTable } from '../../components/DataTable';
import { enumOptions, FilterBar, SelectInput, TextInput } from '../../components/forms';
import { Badge, Card, PageHeader, Pagination } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

const ACTIONS = ['CREATE', 'UPDATE', 'STATUS_CHANGE', 'PUBLISH', 'DELETE'] as const;

/** Who changed what: attendance, marks, publishing, fees, roles and more. */
export default function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);
  const query = useQuery(() => adminApi.audit({ entityType, action, page, size: 50 }), [entityType, action, page]);

  return (
    <div>
      <PageHeader title="Audit log" subtitle="A permanent record of important changes" />
      <Card>
        <FilterBar>
          <TextInput value={entityType} onChange={(v) => { setEntityType(v); setPage(0); }} placeholder="Record type, e.g. Student, Test, Payment" />
          <SelectInput value={action} onChange={(v) => { setAction(v); setPage(0); }} options={enumOptions(ACTIONS)} placeholder="Any action" />
        </FilterBar>
        <DataTable rows={query.data?.content} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No entries"
          columns={[
            { header: 'When', render: (row) => <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(row.performedAt)}</span> },
            { header: 'Who', render: (row) => row.performedByName ?? 'System' },
            { header: 'Action', render: (row) => <Badge value={row.action === 'PUBLISH' ? 'PUBLISHED' : row.action === 'CREATE' ? 'ACTIVE' : 'PENDING'} label={row.action.replace('_', ' ')} /> },
            { header: 'Record', render: (row) => `${row.entityType}${row.entityId ? ` #${row.entityId}` : ''}` },
            { header: 'Summary', render: (row) => <span className="text-slate-800">{row.summary}</span> },
          ]} />
        {query.data && <Pagination page={query.data.page} totalPages={query.data.totalPages} totalElements={query.data.totalElements} onChange={setPage} />}
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { studentApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { useBatches } from '../../hooks/lookups';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { enumOptions, FilterBar, refOptions, SelectInput, TextInput } from '../../components/forms';
import { Badge, Card, PageHeader } from '../../components/ui';
import StudentForm from './StudentForm';

const STATUSES = ['ACTIVE', 'INACTIVE', 'COMPLETED', 'DROPPED', 'SUSPENDED'] as const;

export default function StudentsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const batches = useBatches();
  const [search, setSearch] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [creating, setCreating] = useState(false);
  const query = useQuery(() => studentApi.search({ search, batchId, status }), [search, batchId, status]);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={can('STUDENT_VIEW') ? 'All students of the centre' : 'Students of your batches'}
        actions={can('STUDENT_CREATE') && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Add student</button>
        )}
      />
      <Card>
        <FilterBar>
          <TextInput value={search} onChange={setSearch} placeholder="Search name or admission number" />
          <SelectInput value={batchId} onChange={setBatchId} options={refOptions(batches)} placeholder="All batches" />
          <SelectInput value={status} onChange={setStatus} options={enumOptions(STATUSES)} placeholder="Any status" />
        </FilterBar>
        <DataTable
          rows={query.data}
          loading={query.loading}
          error={query.error}
          onRetry={query.reload}
          rowKey={(row) => row.id}
          empty="No students found"
          onRowClick={(row) => navigate(`/students/${row.id}`)}
          columns={[
            { header: 'Admission no.', render: (row) => <span className="font-mono text-xs">{row.admissionNumber}</span> },
            { header: 'Name', render: (row) => <span className="font-medium text-slate-800">{row.fullName}</span> },
            { header: 'Batch', render: (row) => row.batch?.name ?? '-' },
            { header: 'Parent', render: (row) => (row.parent ? `${row.parent.name} (${row.parent.phoneNumber})` : '-') },
            { header: 'Portal login', render: (row) => row.username ?? <span className="text-slate-400">none</span> },
            { header: 'Status', render: (row) => <Badge value={row.status} /> },
          ]}
        />
      </Card>
      <StudentForm open={creating} onClose={() => setCreating(false)}
        onSaved={(student) => { setCreating(false); navigate(`/students/${student.id}`); }} />
    </div>
  );
}

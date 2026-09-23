import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus } from 'lucide-react';
import { adminApi } from '../../api/endpoints';
import { useAction, useForm, useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { DataTable } from '../../components/DataTable';
import { blankToUndefined, Checkbox, Field, FilterBar, TextInput } from '../../components/forms';
import { Badge, Card, Modal, Notice, PageHeader } from '../../components/ui';
import { formatDateTime, ROLE_LABELS } from '../../utils/format';
import type { RoleCode, UserAccount } from '../../types';

const ROLES: RoleCode[] = ['ADMINISTRATIVE', 'ACADEMICS', 'DIRECTORS', 'ACCOUNTS', 'SALES', 'MENTORS', 'FACULTY', 'STUDENTS'];

/**
 * Staff accounts. Mentor, faculty and student logins are normally created from their own
 * screens so the profile and the login stay linked.
 */
export default function UsersPage() {
  const { can } = useAuth();
  const { config } = useConfig();
  const [search, setSearch] = useState('');
  const query = useQuery(() => adminApi.users(search || undefined), [search]);
  const [editing, setEditing] = useState<UserAccount | 'new' | null>(null);
  const [resetting, setResetting] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const existing = editing && editing !== 'new' ? editing : null;
  const { values, set, setValues } = useForm({ username: '', password: '', fullName: '', email: '', mobile: '', roles: [] as RoleCode[], active: true });
  const { run, busy, errors, setErrors } = useAction();
  const roleEnabled = (role: RoleCode) => Boolean(config.roles[role.toLowerCase()]);

  useEffect(() => {
    setErrors({});
    setValues({
      username: existing?.username ?? '',
      password: '',
      fullName: existing?.fullName ?? '',
      email: existing?.email ?? '',
      mobile: existing?.mobile ?? '',
      roles: existing?.roles ?? [],
      active: existing?.active ?? true,
    });
  }, [editing]);

  const toggleRole = (role: RoleCode, on: boolean) =>
    set('roles', on ? [...values.roles, role] : values.roles.filter((item) => item !== role));

  const save = async () => {
    const body = {
      username: values.username,
      password: existing ? undefined : blankToUndefined(values.password),
      fullName: values.fullName,
      email: blankToUndefined(values.email),
      mobile: blankToUndefined(values.mobile),
      roles: values.roles,
      active: values.active,
    };
    if (await run(() => adminApi.saveUser(existing?.id, body), existing ? 'User updated' : 'User created')) {
      setEditing(null);
      query.reload();
    }
  };

  const reset = async () => {
    if (!resetting) return;
    if (await run(() => adminApi.resetPassword(resetting.id, newPassword), 'Password reset - the user must change it at next sign-in')) {
      setResetting(null);
      setNewPassword('');
      query.reload();
    }
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Sign-in accounts and their roles"
        actions={can('USER_MANAGE') && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add user</button>} />
      <Card>
        <FilterBar><TextInput value={search} onChange={setSearch} placeholder="Search name or username" /></FilterBar>
        <DataTable rows={query.data} loading={query.loading} error={query.error} onRetry={query.reload} rowKey={(row) => row.id} empty="No users found"
          columns={[
            { header: 'Name', render: (row) => <span className="font-medium text-slate-800">{row.fullName}</span> },
            { header: 'Username', render: (row) => <span className="font-mono text-xs">{row.username}</span> },
            { header: 'Roles', render: (row) => (
              <div className="flex flex-wrap gap-1">
                {row.roles.map((role) => (
                  <Badge key={role} value={roleEnabled(role) ? 'ACTIVE' : 'DISABLED'} label={ROLE_LABELS[role] ?? role} />
                ))}
              </div>
            ) },
            { header: 'Last sign-in', render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.lastLoginAt)}</span> },
            { header: 'Status', render: (row) => (
              <div className="flex flex-wrap gap-1">
                <Badge value={row.active ? 'ACTIVE' : 'INACTIVE'} />
                {row.mustChangePassword && <Badge value="PENDING" label="Must change password" />}
              </div>
            ) },
            { header: '', render: (row) => can('USER_MANAGE') && (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-ghost" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></button>
                <button type="button" className="btn-ghost" onClick={() => setResetting(row)} aria-label="Reset password"><KeyRound size={14} /></button>
              </div>
            ) },
          ]} />
      </Card>

      <Modal open={editing !== null} title={existing ? `Edit ${existing.username}` : 'Add user'} onClose={() => setEditing(null)} wide
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Username" error={errors.username}><TextInput value={values.username} onChange={(v) => set('username', v)} autoComplete="off" /></Field>
          <Field label="Full name" error={errors.fullName}><TextInput value={values.fullName} onChange={(v) => set('fullName', v)} /></Field>
          <Field label="E-mail" error={errors.email}><TextInput value={values.email} onChange={(v) => set('email', v)} type="email" /></Field>
          <Field label="Mobile" error={errors.mobile}><TextInput value={values.mobile} onChange={(v) => set('mobile', v)} /></Field>
          {!existing && (
            <Field label="Temporary password" hint="The user must change it at first sign-in" error={errors.password}>
              <input type="password" className="input" autoComplete="new-password" value={values.password} onChange={(e) => set('password', e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="Roles" error={errors.roles}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ROLES.map((role) => (
              <Checkbox key={role} checked={values.roles.includes(role)} onChange={(on) => toggleRole(role, on)}
                label={<span>{ROLE_LABELS[role]}{!roleEnabled(role) && <span className="ml-1 text-xs text-slate-400">(off)</span>}</span>} />
            ))}
          </div>
        </Field>
        <Notice>Roles marked "off" are switched off for {config.client.name} in the configuration; users holding only those roles cannot sign in.</Notice>
        <div className="mt-3"><Checkbox checked={values.active} onChange={(v) => set('active', v)} label="Active" /></div>
      </Modal>

      <Modal open={resetting !== null} title={`Reset password for ${resetting?.username ?? ''}`} onClose={() => setResetting(null)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setResetting(null)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={reset} disabled={busy || newPassword.length < 8}>Reset</button></>}>
        <Field label="New temporary password" hint="At least 8 characters" error={errors.newPassword}>
          <input type="password" className="input" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

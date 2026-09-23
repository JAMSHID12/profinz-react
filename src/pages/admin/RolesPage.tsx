import { useMemo, useState } from 'react';
import { adminApi } from '../../api/endpoints';
import { useAction, useQuery } from '../../hooks/useQuery';
import { useAuth } from '../../context/AuthContext';
import { Badge, Card, CardHeader, Loadable, Notice, PageHeader } from '../../components/ui';
import { titleCase } from '../../utils/format';
import type { PermissionInfo, RoleInfo } from '../../types';

/**
 * Roles come from the configuration (enabled or not); what each role may do is stored in the
 * database and can be adjusted here without a deployment.
 */
export default function RolesPage() {
  const { can, refreshSession } = useAuth();
  const roles = useQuery(() => adminApi.roles(), []);
  const permissions = useQuery(() => adminApi.permissions(), []);
  const [selected, setSelected] = useState<RoleInfo | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const { run, busy } = useAction();
  const editable = can('ROLE_MANAGE');

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionInfo[]>();
    for (const permission of permissions.data ?? []) {
      const list = map.get(permission.module) ?? [];
      list.push(permission);
      map.set(permission.module, list);
    }
    return Array.from(map.entries());
  }, [permissions.data]);

  const choose = (role: RoleInfo) => {
    setSelected(role);
    setDraft(new Set(role.permissions));
  };

  const toggle = (code: string) =>
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const save = async () => {
    if (!selected) return;
    const saved = await run(() => adminApi.setRolePermissions(selected.code, Array.from(draft)), `Permissions of ${selected.name} saved`);
    if (saved) {
      roles.reload();
      setSelected(saved);
      await refreshSession().catch(() => undefined);
    }
  };

  const changed = selected && (draft.size !== selected.permissions.length || selected.permissions.some((code) => !draft.has(code)));

  return (
    <div>
      <PageHeader title="Roles and permissions" subtitle="Which roles are switched on for this client, and what each role may do" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Roles" />
          <Loadable query={roles}>
            {(list) => (
              <ul className="divide-y divide-slate-100">
                {list.map((role) => (
                  <li key={role.code}>
                    <button type="button" onClick={() => choose(role)}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50 ${selected?.code === role.code ? 'bg-brand-50' : ''}`}>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{role.name}</p>
                        <p className="text-xs text-slate-500">
                          {role.activeUsers} {role.activeUsers === 1 ? 'user' : 'users'} &middot; {role.permissions.length} permissions
                        </p>
                      </div>
                      <Badge value={role.enabled ? 'ENABLED' : 'DISABLED'} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Loadable>
        </Card>
        <Card className="lg:col-span-2">
          {!selected ? (
            <div className="p-6 text-sm text-slate-500">Choose a role to see its permissions.</div>
          ) : (
            <>
              <CardHeader title={selected.name} subtitle={selected.description}
                actions={editable && <button type="button" className="btn-primary btn-sm" onClick={save} disabled={busy || !changed}>Save changes</button>} />
              <div className="space-y-4 p-4">
                {!selected.enabled && (
                  <Notice tone="warning">This role is switched off in the configuration (project.role.{selected.code.toLowerCase()}.enabled). Its permissions have no effect until it is enabled.</Notice>
                )}
                {selected.code === 'STUDENTS' && <Notice>Students can only hold the self-service ("My ...") permissions.</Notice>}
                {grouped.map(([module, list]) => (
                  <div key={module}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{titleCase(module)}</p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {list.map((permission) => (
                        <label key={permission.code} className="flex items-start gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" checked={draft.has(permission.code)}
                            disabled={!editable} onChange={() => toggle(permission.code)} />
                          <span>
                            {permission.name}
                            <span className="block font-mono text-[11px] text-slate-400">{permission.code}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

import { configApi } from '../../api/endpoints';
import { useQuery } from '../../hooks/useQuery';
import { Badge, Card, CardHeader, InfoGrid, Loadable, Notice, PageHeader } from '../../components/ui';
import { titleCase } from '../../utils/format';

function Toggles({ values }: { values: Record<string, boolean> }) {
  return (
    <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
      {Object.entries(values).map(([key, enabled]) => (
        <div key={key} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
          <span className="text-sm text-slate-700">{titleCase(key)}</span>
          <Badge value={enabled ? 'ENABLED' : 'DISABLED'} />
        </div>
      ))}
    </div>
  );
}

/**
 * Read-only view of the running configuration. Values are changed in application.yml or
 * environment variables and take effect on restart; secrets are never shown.
 */
export default function SettingsPage() {
  const query = useQuery(() => configApi.settings(), []);
  return (
    <div>
      <PageHeader title="Settings" subtitle="Client configuration currently in effect" />
      <Loadable query={query}>
        {(settings) => (
          <div className="space-y-5">
            <Notice>These values come from the server configuration (application.yml / environment variables). Change them there and restart the application.</Notice>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader title="Client" />
                <div className="p-4"><InfoGrid items={Object.entries(settings.client).map(([key, value]) => [titleCase(key), value])} /></div>
              </Card>
              <Card>
                <CardHeader title="Branding" />
                <div className="p-4">
                  <InfoGrid items={[
                    ['Logo', settings.branding.logo ? <img src={settings.branding.logo} alt="Logo" className="h-10 w-auto rounded" /> : '-'],
                    ['Primary colour', settings.branding.primaryColor ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 rounded" style={{ background: settings.branding.primaryColor }} />
                        {settings.branding.primaryColor}
                      </span>
                    ) : '-'],
                    ['Login message', settings.branding.loginMessage || '-'],
                  ]} />
                </div>
              </Card>
              <Card><CardHeader title="Modules" subtitle="project.module.*" /><Toggles values={settings.modules} /></Card>
              <Card><CardHeader title="Roles" subtitle="project.role.*" /><Toggles values={settings.roles} /></Card>
              <Card>
                <CardHeader title="Performance" />
                <div className="space-y-4 p-4">
                  <InfoGrid items={[
                    ['Performance tracking', settings.academics.performanceEnabled ? 'On' : 'Off'],
                    ['Students see syllabus', settings.academics.studentSyllabusVisible ? 'Yes' : 'No'],
                    ...Object.entries(settings.academics.weights).map(([key, value]) => [`Weight: ${titleCase(key.replace(/([A-Z])/g, '_$1'))}`, value] as [string, number]),
                  ]} />
                  <div className="flex flex-wrap gap-2">
                    {settings.academics.grades.map((band) => <Badge key={band.grade} value="PENDING" label={`${band.grade} ≥ ${band.min}%`} />)}
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader title="Notifications" />
                <Toggles values={settings.channels} />
                <div className="border-t border-slate-100 p-4">
                  <InfoGrid items={Object.entries(settings.events).map(([event, channels]) => [titleCase(event), channels.length ? channels.map(titleCase).join(', ') : 'Off'])} />
                </div>
              </Card>
              <Card>
                <CardHeader title="WhatsApp" />
                <div className="p-4">
                  <InfoGrid items={[
                    ['Mode', String(settings.whatsapp.mode ?? '-')],
                    ['WABI API key', settings.whatsapp.apiKeyConfigured ? 'Configured' : 'Not configured'],
                    ['WABI event', String(settings.whatsapp.event ?? '-')],
                    ['Queue interval', `${String(settings.whatsapp.queueIntervalSeconds ?? '-')} s`],
                    ['Max retries', String(settings.whatsapp.maxRetries ?? '-')],
                  ]} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Fees and database" />
                <div className="p-4">
                  <InfoGrid items={[
                    ['Receipt prefix', String(settings.fees.receiptPrefix ?? '-')],
                    ['Reminders', settings.fees.remindersEnabled ? `On (${String(settings.fees.reminderCron)})` : 'Off'],
                    ['Reminder days after due', Array.isArray(settings.fees.reminderOffsetDays) ? settings.fees.reminderOffsetDays.join(', ') : '-'],
                    ['Schema version', `V${String(settings.database.migrationVersion ?? '-')} ${String(settings.database.migrationDescription ?? '')}`],
                    ['Pending migrations', String(settings.database.pendingMigrations ?? 0)],
                  ]} />
                </div>
              </Card>
            </div>
          </div>
        )}
      </Loadable>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { configApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { ModuleKey, PublicConfig } from '../types';
import { applyBrandColor, applyFavicon } from '../utils/brand';
import { configureFormatting } from '../utils/format';

interface ConfigContextValue {
  config: PublicConfig;
  moduleEnabled: (module: ModuleKey) => boolean;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

/**
 * Loads the client's public configuration before anything else renders, then brands the
 * app with it: name, logo, colours, currency and timezone. Switching client is a matter of
 * configuration on the server - the frontend build stays the same.
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    configApi
      .publicConfig()
      .then((loaded) => {
        configureFormatting({
          currency: loaded.client.currency,
          locale: loaded.client.locale,
          timezone: loaded.client.timezone,
        });
        applyBrandColor(loaded.branding.primaryColor);
        applyFavicon(loaded.client.logo);
        document.title = loaded.client.name;
        setConfig(loaded);
      })
      .catch((failure) => setError(errorMessage(failure, 'The server is not reachable')));
  }, []);

  useEffect(load, [load]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold text-slate-800">Unable to start the application</p>
        <p className="text-sm text-slate-500">{error}</p>
        <button type="button" className="btn-secondary mt-2" onClick={load}>
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  const moduleEnabled = (module: ModuleKey) => Boolean(config.modules[module]);
  return <ConfigContext.Provider value={{ config, moduleEnabled }}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used inside ConfigProvider');
  }
  return context;
}

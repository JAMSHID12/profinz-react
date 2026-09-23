import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';
import { errorMessage, fieldErrors } from '../api/client';
import { useToast } from '../context/ToastContext';

/**
 * Loads data and reloads it whenever a dependency changes. Pass `enabled = false` to wait
 * for a required filter (for example a selected batch).
 */
export function useQuery<T>(loader: () => Promise<T>, deps: DependencyList, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((failure) => {
        if (!cancelled) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [...deps, version, enabled]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { data, loading, error, reload, setData };
}

/**
 * Runs a change (save, publish, ...) with a busy flag, a success toast and friendly errors.
 * Returns undefined when the call failed; field errors are exposed for forms.
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = useCallback(
    async <T>(action: () => Promise<T>, successMessage?: string): Promise<T | undefined> => {
      setBusy(true);
      setErrors({});
      try {
        const result = await action();
        if (successMessage) toast.success(successMessage);
        return result;
      } catch (failure) {
        setErrors(fieldErrors(failure));
        toast.error(errorMessage(failure));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  return { run, busy, errors, setErrors };
}

/** Small form state helper: values plus a typed setter per field. */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const set = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  }, []);
  return { values, set, setValues, reset: () => setValues(initial) };
}

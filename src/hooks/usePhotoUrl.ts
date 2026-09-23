import { useEffect, useState } from 'react';
import { http } from '../api/client';

/** Fetch private student images with the same bearer authentication as student records. */
export function usePhotoUrl(url?: string) {
  const [loaded, setLoaded] = useState<{ source: string; blob: string }>();
  const privatePhoto = Boolean(url?.startsWith('/api/students/'));
  useEffect(() => {
    if (!url || !privatePhoto) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    http.get<Blob>(url.slice(4), { responseType: 'blob' }).then(response => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(response.data);
      setLoaded({ source: url, blob: objectUrl });
    }).catch(() => { /* Fall back to initials if access is denied or photo is missing. */ });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, privatePhoto]);
  return privatePhoto ? (loaded?.source === url ? loaded?.blob : undefined) : url;
}

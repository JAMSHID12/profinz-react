import type { PublicationStatus } from '../../types';

/**
 * Buttons for the result workflow: DRAFT -> REVIEW -> PUBLISHED. Students see results only
 * once published; publishing can be withdrawn back to review to correct a mistake.
 */
export function PublicationActions({
  status,
  onChange,
  busy,
  size = 'sm',
}: {
  status: PublicationStatus;
  onChange: (next: PublicationStatus) => void;
  busy?: boolean;
  size?: 'sm' | 'md';
}) {
  const cls = size === 'sm' ? 'btn-sm' : '';
  const confirmAndPublish = () => {
    if (window.confirm('Publish these results? Students will be able to see them and parents may be notified.')) {
      onChange('PUBLISHED');
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === 'DRAFT' && (
        <button type="button" className={`btn-secondary ${cls}`} disabled={busy} onClick={() => onChange('REVIEW')}>Send for review</button>
      )}
      {status === 'REVIEW' && (
        <button type="button" className={`btn-secondary ${cls}`} disabled={busy} onClick={() => onChange('DRAFT')}>Back to draft</button>
      )}
      {status !== 'PUBLISHED' && (
        <button type="button" className={`btn-primary ${cls}`} disabled={busy} onClick={confirmAndPublish}>Publish</button>
      )}
      {status === 'PUBLISHED' && (
        <button type="button" className={`btn-secondary ${cls}`} disabled={busy}
          onClick={() => window.confirm('Withdraw the published results so they can be corrected?') && onChange('REVIEW')}>
          Withdraw
        </button>
      )}
    </div>
  );
}

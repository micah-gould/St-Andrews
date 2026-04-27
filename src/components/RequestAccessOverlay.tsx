import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { SavedStateMeta } from '../types/saved-state.types';
import { savedStatesApi as defaultSavedStatesApi } from '../savedStatesApi';

type RequestAccessOverlayProps = {
  stateId: string;
  savedStatesApi: typeof defaultSavedStatesApi;
};

function RequestAccessOverlay({ stateId, savedStatesApi }: RequestAccessOverlayProps) {
  const [meta, setMeta] = useState<SavedStateMeta | null>(null);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;

    savedStatesApi.meta(stateId).then((nextMeta) => {
      if (!cancelled) {
        setMeta(nextMeta);
      }
    }).catch((err) => {
      if (cancelled) {
        return;
      }

      if (err.status === 404) {
        setLoadError('This plan no longer exists.');
      } else if (err.status === 401) {
        setLoadError('Please sign in to request access.');
      } else {
        setLoadError(`Could not load plan: ${err.message}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [savedStatesApi, stateId]);

  return (
    <div className="request-access" id="request-access-overlay">
      <div className="request-access__card">
        <h1>Request access</h1>
        {!meta && !loadError ? <div className="request-access__summary">Checking plan details...</div> : null}
        {loadError === 'Please sign in to request access.' ? (
          <div className="request-access__summary">Please <a href="/login">sign in</a> to request access.</div>
        ) : null}
        {loadError && loadError !== 'Please sign in to request access.' ? <div className="request-access__summary">{loadError}</div> : null}
        {meta ? (
          <>
            <div className="request-access__summary">
              You don't have access to <strong>{meta.name}</strong>, shared by <strong>{meta.owner?.email || 'the owner'}</strong>. You can request access below.
            </div>
            <form className="request-access__form" onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const requestedRole = (formData.get('role') || 'view').toString();
              const message = (formData.get('message') || '').toString().trim();
              setSubmitting(true);
              setStatus('Sending...');
              try {
                await savedStatesApi.requestAccess(stateId, { requestedRole, message });
                setStatus(`Request sent. You'll get access once ${meta.owner?.email || 'the owner'} approves it.`);
              } catch (err) {
                setSubmitting(false);
                setStatus(err.message || 'Could not send request.');
                return;
              }

              event.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input, textarea, select, button').forEach((element) => {
                element.disabled = true;
              });
            }}>
              <label>
                Role requested
                <select name="role" defaultValue="view">
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                </select>
              </label>
              <label>
                Message (optional)
                <textarea name="message" rows={3} maxLength={500} placeholder="Why you need access" />
              </label>
              <div className="request-access__actions">
                <button type="submit" disabled={submitting}>Send request</button>
                <a href="/" className="request-access__home">Go to my plans</a>
              </div>
            </form>
          </>
        ) : null}
        <p className="request-access__status" role="status" aria-live="polite">{status}</p>
      </div>
    </div>
  );
}

export async function showRequestAccessOverlay(stateId: string, { savedStatesApi }: { savedStatesApi: typeof defaultSavedStatesApi }) {
  document.getElementById('app')?.setAttribute('hidden', '');
  document.getElementById('request-access-overlay-root')?.remove();

  const container = document.createElement('div');
  container.id = 'request-access-overlay-root';
  document.body.append(container);

  createRoot(container).render(<RequestAccessOverlay stateId={stateId} savedStatesApi={savedStatesApi} />);
}

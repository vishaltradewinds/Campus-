import React, { useState } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const AssessmentEvidencePanel: React.FC<{ submissionId: string; key?: string }> = ({ submissionId }) => {
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setResponse(null);
    setStatus('');
    try {
      const snapshot = await getDocFromServer(doc(db, 'assessmentSubmissions', submissionId));
      const data = snapshot.data();
      if (!snapshot.exists() || typeof data?.response !== 'string') {
        setStatus('No readable assessment response is available.');
        return;
      }
      setResponse(data.response);
      setStatus('Candidate-submitted evidence only. No verified score is provided.');
    } catch {
      setStatus('Response unavailable. Current student sharing consent and access are required.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mt-3 border border-slate-200 p-3 text-xs" onToggle={e => {
      if (!e.currentTarget.open) { setResponse(null); setStatus(''); }
    }}>
      <summary className="cursor-pointer font-semibold">Assessment evidence — human review</summary>
      <button type="button" onClick={load} disabled={busy} className="mt-2 border border-slate-300 px-3 py-2 disabled:opacity-50">
        {busy ? 'Checking access…' : 'Load current authorized response'}
      </button>
      {status && <p role="status" className="mt-2 text-slate-600">{status}</p>}
      {response !== null && <pre className="mt-2 whitespace-pre-wrap break-words max-h-64 overflow-auto text-slate-900">{response}</pre>}
    </details>
  );
};

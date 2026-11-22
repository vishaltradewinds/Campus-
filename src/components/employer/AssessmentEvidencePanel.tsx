import {useAuth} from '../../context/AuthContext';
import React, { useState, useRef, useEffect } from 'react';


export const AssessmentEvidencePanel: React.FC<{ submissionId: string; key?: string }> = ({ submissionId }) => {
  const {request,currentPrincipal}=useAuth();
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const generation=useRef(0);
  useEffect(()=>()=>{generation.current++;},[submissionId]);
  async function load() {
    const principal=currentPrincipal();
    const run=++generation.current;
    setBusy(true);
    setResponse(null);
    setStatus('');
    try {
      if(!principal)throw new Error('Authentication required');
      const result=await request('/api/assessment-evidence/'+encodeURIComponent(submissionId),{cache:'no-store',signal:AbortSignal.timeout(25000)});
      if(!result.ok)throw new Error('Assessment unavailable');
      const data=await result.json();
      if(run!==generation.current||currentPrincipal()?.uid!==principal.uid)return;
      if(data.submissionId!==submissionId||typeof data.response!=='string')throw new Error('Invalid assessment');
      setResponse(data.response);
      setStatus('Candidate-submitted evidence only. No verified score is provided.');
    } catch {
      if(run===generation.current)setStatus('Response unavailable. Current student sharing consent and access are required.');
    } finally {
      if(run===generation.current)setBusy(false);
    }
  }
  return (
    <details className="mt-3 border border-slate-200 p-3 text-xs" onToggle={e => {
      if (!e.currentTarget.open) { generation.current++;setBusy(false);setResponse(null); setStatus(''); }
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

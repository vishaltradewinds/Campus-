import React, { useEffect, useState } from 'react';
import { AlertCircle, FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { executeTrustedProfileMutation } from '../../lib/trustedRecruitmentClient';
import type { CareerPassportEvidence } from '../../types';

export function CareerPassportEvidencePanel({ studentId }: { studentId: string }) {
  const [evidence, setEvidence] = useState<CareerPassportEvidence[]>([]);
  const [claimValue, setClaimValue] = useState('');
  const [claimKey, setClaimKey] = useState('education');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!studentId) return;
    return onSnapshot(
      query(collection(db, 'careerEvidence'), where('studentId', '==', studentId)),
      snap => setEvidence(snap.docs.map(d => ({ id: d.id, ...d.data() } as CareerPassportEvidence))),
      () => setMessage('Evidence records could not be loaded.')
    );
  }, [studentId]);

  const submit = async () => {
    if (!auth.currentUser || !claimValue.trim()) return;
    setBusy(true); setMessage('');
    try {
      const token = await auth.currentUser.getIdToken();
      const evidenceId = crypto.randomUUID();
      const requestId = crypto.randomUUID();
      const response = await fetch('/api/career-evidence', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, evidenceId, studentId, claimType: claimKey, claimKey, claimValue: claimValue.trim(), sourceType: 'student_submission' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Submission failed');
      setClaimValue(''); setMessage('Evidence submitted for review. It is not treated as verified until an authorized reviewer approves it.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Submission failed'); }
    finally { setBusy(false); }
  };

  const dispute = async (id: string) => {
    const reason = window.prompt('Reason for disputing this evidence:');
    if (!reason?.trim()) return;
    setBusy(true); setMessage('');
    try {
      await executeTrustedProfileMutation('DISPUTE_CAREER_EVIDENCE', { evidenceId: id, reason: reason.trim() });
      setMessage('Dispute submitted for authorized review.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Dispute failed'); }
    finally { setBusy(false); }
  };

  return (
    <section className="bg-white border border-slate-300 p-4 sm:p-6 space-y-4" aria-label="Career Passport evidence">
      <div className="flex items-start gap-3">
        <FileCheck2 className="w-5 h-5 text-indigo-600 mt-0.5" />
        <div>
          <h2 className="text-base sm:text-lg font-black uppercase">Career Passport Evidence</h2>
          <p className="text-xs text-slate-600 mt-1">Evidence is submitted first, then independently reviewed. A submission never becomes verified merely because you uploaded it.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_auto] gap-2">
        <select value={claimKey} onChange={e => setClaimKey(e.target.value)} className="border border-slate-300 p-2 text-sm" aria-label="Evidence claim type">
          <option value="education">Education</option>
          <option value="institution">Institution</option>
          <option value="skill">Skill</option>
          <option value="project">Project</option>
          <option value="internship">Internship</option>
          <option value="assessment">Assessment</option>
          <option value="employment_outcome">Employment outcome</option>
          <option value="identity">Identity</option>
        </select>
        <input value={claimValue} onChange={e => setClaimValue(e.target.value)} maxLength={4000} className="border border-slate-300 p-2 text-sm" placeholder="Describe the evidence claim" aria-label="Evidence claim" />
        <button disabled={busy || !claimValue.trim()} onClick={submit} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase disabled:opacity-50">Submit</button>
      </div>
      {message && <div className="text-xs p-2 bg-slate-50 border border-slate-200" role="status">{message}</div>}
      <div className="space-y-2">
        {evidence.length === 0 ? <div className="text-xs text-slate-500">No evidence submitted yet.</div> : evidence.map(item => {
          const expired = !!item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now();
          const effectiveStatus = expired && item.status === 'verified' ? 'expired' : item.status;
          return (
            <div key={item.id} className="border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="w-4 h-4" />{item.claimType}: {item.claimValue}</div>
                <div className="text-[11px] text-slate-500 mt-1 uppercase">Status: {effectiveStatus.replace('_',' ')}</div>
                {item.rejectionReason && <div className="text-[11px] text-rose-700 mt-1">Reason: {item.rejectionReason}</div>}
                {item.disputeStatus === 'open' && <div className="text-[11px] text-amber-700 mt-1">Dispute open</div>}
              </div>
              <div className="flex items-center gap-2">
                {effectiveStatus === 'verified' && item.disputeStatus !== 'open' && <button disabled={busy} onClick={() => dispute(item.id)} className="px-3 py-2 border border-slate-300 text-[11px] font-bold uppercase">Dispute</button>}
                {effectiveStatus === 'expired' && <span className="inline-flex items-center gap-1 text-[11px] text-amber-700"><AlertCircle className="w-3 h-3" />Expired</span>}
                {effectiveStatus === 'submitted' && <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><LockKeyhole className="w-3 h-3" />Awaiting review</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

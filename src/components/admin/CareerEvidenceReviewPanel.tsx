import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, FileCheck2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { executeTrustedProfileMutation } from '../../lib/trustedRecruitmentClient';
import type { CareerPassportEvidence } from '../../types';

export function CareerEvidenceReviewPanel() {
  const [items, setItems] = useState<CareerPassportEvidence[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => onSnapshot(
    query(collection(db, 'careerEvidence'), where('status', 'in', ['submitted', 'under_review']), limit(100)),
    snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as CareerPassportEvidence)).sort((a,b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))),
    () => setMessage('Evidence review queue could not be loaded.')
  ), []);

  const review = async (item: CareerPassportEvidence, status: 'under_review' | 'verified' | 'rejected') => {
    let rejectionReason = '';
    if (status === 'rejected') {
      rejectionReason = window.prompt('Mandatory rejection reason:')?.trim() || '';
      if (rejectionReason.length < 10) { setMessage('A meaningful rejection reason is required.'); return; }
    }
    setBusy(item.id); setMessage('');
    try {
      await executeTrustedProfileMutation('REVIEW_CAREER_EVIDENCE', { evidenceId: item.id, status, rejectionReason });
      setMessage(`Evidence ${item.id} moved to ${status.replace('_', ' ')}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Review failed'); }
    finally { setBusy(null); }
  };

  return (
    <section className="bg-white border border-slate-200 p-4 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="w-5 h-5 text-indigo-600 mt-0.5" />
        <div><h2 className="font-black uppercase text-base">Career Passport Verification Queue</h2><p className="text-xs text-slate-500 mt-1">Only authorized reviewers can change evidence state. Verified evidence requires authoritative provenance.</p></div>
      </div>
      {message && <div className="p-2 border border-slate-200 bg-slate-50 text-xs" role="status">{message}</div>}
      {items.length === 0 ? <div className="text-xs text-slate-500">No submitted evidence is awaiting review.</div> : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="border border-slate-200 p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="min-w-0"><div className="font-bold text-sm">{item.claimType} / {item.claimKey}</div><div className="text-xs text-slate-600 break-words">{item.claimValue}</div><div className="text-[10px] uppercase text-slate-500 mt-1">Source: {item.sourceType}{item.sourceId ? ` • ${item.sourceId}` : ''}</div></div>
              <div className="flex flex-wrap gap-2">
                {item.status === 'submitted' && <button disabled={busy===item.id} onClick={() => review(item,'under_review')} className="px-3 py-2 border border-slate-300 text-[11px] font-bold uppercase">Start review</button>}
                {item.status === 'under_review' && <button disabled={busy===item.id} onClick={() => review(item,'verified')} className="px-3 py-2 bg-emerald-700 text-white text-[11px] font-bold uppercase flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Verify</button>}
                {item.status === 'under_review' && <button disabled={busy===item.id} onClick={() => review(item,'rejected')} className="px-3 py-2 bg-rose-700 text-white text-[11px] font-bold uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Reject</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

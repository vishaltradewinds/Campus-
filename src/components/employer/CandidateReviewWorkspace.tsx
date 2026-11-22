import {useAuth} from '../../context/AuthContext';
import React, { useEffect, useRef, useState } from 'react';

import {requestCandidateProjection} from '../../lib/candidateProjectionTransport';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import { StudentConsentOpportunity } from '../../types';
import { AssessmentEvidencePanel } from './AssessmentEvidencePanel';
import { StageBadge } from '../common/StatusBadge';

function CandidateReviewRow({ opportunity }: { opportunity: StudentConsentOpportunity; key?: string }) {
  const {request,currentPrincipal}=useAuth();
  const { advanceCandidateStage } = useTalentNetwork();
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [salary, setSalary] = useState('');
  const [terms, setTerms] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    return () => { generation.current++; };
  }, [opportunity.id]);
  useEffect(() => {
    if (!profile) return;
    const timer = setTimeout(() => { setProfile(null); setMessage('Profile view expired; check current consent again.'); }, 30000);
    return () => clearTimeout(timer);
  }, [profile]);
  async function load() {
    const uid = currentPrincipal()?.uid;
    const run = ++generation.current;
    setProfile(null); setMessage(''); setBusy(true);
    try {
      if (!uid || uid !== opportunity.employerId) throw new Error('Employer authorization required');
      const result = await requestCandidateProjection(request,{ campaignId: opportunity.campaignId, studentId: opportunity.studentId, requestId: crypto.randomUUID() });
      const value = result.profile;
      if (!value || value.employerId !== uid || value.studentId !== opportunity.studentId || value.campaignId !== opportunity.campaignId || value.projectionVersion !== 3) throw new Error('No current authorized profile');
      if (run === generation.current && currentPrincipal()?.uid === uid) setProfile(value);
    } catch { if (run === generation.current) setMessage('Profile unavailable: student consent or server authorization is required.'); }
    finally { if (run === generation.current) setBusy(false); }
  }
  async function advance(next: 'shortlisted' | 'interviewing' | 'offered' | 'joined') {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      let meta;
      if (next === 'offered') {
        const amount = Number(salary);
        if (!salary.trim() || !Number.isFinite(amount) || amount <= 0 || !terms.trim()) throw new Error('Enter the actual salary and offer terms.');
        meta = { offer: { salaryLPA: amount, terms: terms.trim() } };
      }
      await advanceCandidateStage(opportunity.id, next, meta);
      setProfile(null);
      setMessage('Server confirmed recruitment update.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Recruitment update failed.'); }
    finally { setBusy(false); }
  }
  return (
    <article className="border border-slate-300 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{opportunity.role}</strong><StageBadge stage={opportunity.stage}/></div>
      <p className="text-xs text-slate-600">Application reference: {opportunity.id.slice(0,12)}</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={load} className="px-3 py-2 border text-sm bg-indigo-600 text-white disabled:opacity-50">Check consent &amp; view profile</button>
        {profile && <button onClick={() => { generation.current++; setProfile(null); setBusy(false); }} className="px-3 py-2 border text-sm">Hide profile</button>}
      </div>
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      {profile && <div className="border border-slate-200 p-3 space-y-2 break-words text-sm">
        <p className="font-semibold">{profile.name || 'Candidate'}</p>
        {profile.institutionName && <p>{profile.institutionName}</p>}
        {profile.consentScope?.academicDataShared === true && <p>Reported academics: {profile.program} {profile.branch} • {profile.graduationYear || 'Not recorded'} • CGPA {profile.cgpa ?? 'Not recorded'}</p>}
        {profile.consentScope?.skillBenchmarksShared === true && <div><strong>Verified evidence records</strong><ul className="list-disc pl-4">{(Array.isArray(profile.verifiedSkills) ? profile.verifiedSkills : []).map((skill: any, i: number) => <li key={i}>{String(skill.claimKey || '')}: {String(skill.claimValue || '')} (evidence {String(skill.evidenceId || '')})</li>)}</ul></div>}
        {profile.consentScope?.projectReposShared === true && <div><strong>Student-reported projects</strong>{(Array.isArray(profile.projects) ? profile.projects : []).map((project: any, i: number) => <p key={i}>{String(project.title || '')} — {String(project.description || '')}</p>)}</div>}
        {profile.consentScope?.contactInfoShared === true && profile.email && <p>Shared contact: {profile.email}</p>}
        <p className="text-xs text-slate-500">Consent checked at retrieval. No automatic match score. View expires after 30 seconds; a previous disclosure cannot be recalled.</p>
      </div>}
      {profile && opportunity.assessmentSubmissionId && <AssessmentEvidencePanel submissionId={opportunity.assessmentSubmissionId}/>}
      <div className="flex flex-wrap gap-2">
        {profile && opportunity.stage === 'assessment_completed' && <button disabled={busy} onClick={() => advance('shortlisted')} className="border px-3 py-2 text-sm">Human-reviewed shortlist</button>}
        {profile && opportunity.stage === 'shortlisted' && <button disabled={busy} onClick={() => advance('interviewing')} className="border px-3 py-2 text-sm">Start interview stage</button>}
      </div>
      {profile && opportunity.stage === 'interviewing' && <div className="space-y-2">
        <label className="block text-sm">Annual salary (LPA)<input type="number" min="0" step="0.01" value={salary} onChange={e=>setSalary(e.target.value)} className="block w-full border p-2"/></label>
        <label className="block text-sm">Actual offer terms<textarea value={terms} onChange={e=>setTerms(e.target.value)} className="block w-full border p-2" rows={3}/></label>
        <button disabled={busy} onClick={() => advance('offered')} className="border px-3 py-2 text-sm bg-indigo-600 text-white">Issue offer</button>
      </div>}
      {opportunity.stage === 'accepted' && <button disabled={busy} onClick={() => { if (window.confirm('Confirm actual joining, not merely offer acceptance?')) void advance('joined'); }} className="border px-3 py-2 text-sm">Record actual joining</button>}
    </article>
  );
}

export const CandidateReviewWorkspace: React.FC<{ campaignId: string; key?: string }> = ({campaignId}) => {
  const {studentOpportunities, currentEmployer} = useTalentNetwork();
  const rows = studentOpportunities.filter(o => o.campaignId === campaignId && o.employerId === currentEmployer.id);
  return <section className="space-y-4">
    <div className="border bg-white p-4"><h2 className="font-bold text-lg">Candidate review</h2><p className="text-sm text-slate-600">Campaign applications only. Retrieve permitted information separately for each candidate; all hiring decisions require human review. Records are limited to the loaded opportunity list.</p><p className="text-sm mt-2">{rows.length} available applications / invitations</p></div>
    {rows.length === 0 ? <div className="border bg-white p-4 text-sm">No campaign applications or invitations available.</div> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{rows.map(o => <CandidateReviewRow key={o.id} opportunity={o}/>)}</div>}
  </section>;
};

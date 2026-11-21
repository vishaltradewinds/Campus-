import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import { Sparkles, X, Check, ArrowRight, Loader2, Briefcase, MapPin, IndianRupee, Calendar } from 'lucide-react';
import { HiringRequirement } from '../../types';

interface DemandCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (req: HiringRequirement) => void;
}

export const DemandCreatorModal: React.FC<DemandCreatorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { createRequirementAndCampaign } = useTalentNetwork();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [role, setRole] = useState('');
  const [vacancies, setVacancies] = useState<number>(0);
  const [education, setEducation] = useState('');
  const [graduationYears, setGraduationYears] = useState('');
  const [branches, setBranches] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [locations, setLocations] = useState('');
  const [salaryMinLPA, setSalaryMinLPA] = useState<number>(0);
  const [salaryMaxLPA, setSalaryMaxLPA] = useState<number>(0);
  const [joiningWindow, setJoiningWindow] = useState('');
  const [candidateProfileSummary, setCandidateProfileSummary] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError('');
    if (!role.trim() || !Number.isSafeInteger(vacancies) || vacancies < 1 || !Number.isFinite(salaryMinLPA) || !Number.isFinite(salaryMaxLPA) || salaryMinLPA < 0 || salaryMaxLPA < salaryMinLPA) { setFormError('Enter a role, positive vacancy count and valid salary range.'); return; }
    const years=graduationYears.split(',').map(s=>s.trim()).filter(Boolean).map(Number);
    if(years.some(y=>!Number.isInteger(y)||y<1950||y>2100)){setFormError('Enter valid four-digit graduation years, separated by commas.');return;}
    setIsSubmitting(true);
    try {
    const branchList = branches.split(',').map((b) => b.trim()).filter(Boolean);
    const skillList = requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);
    const locList = locations.split(',').map((l) => l.trim()).filter(Boolean);

    const { requirement } = await createRequirementAndCampaign({
      role,
      vacancies: Number(vacancies),
      education: education.split(',').map(s=>s.trim()).filter(Boolean),
      graduationYears: Array.from(new Set(years)),
      branches: branchList,
      requiredSkills: skillList,
      experienceLevel: 'Campus Freshers / 0-1 Years',
      locations: locList,
      salaryMinLPA: Number(salaryMinLPA),
      salaryMaxLPA: Number(salaryMaxLPA),
      joiningWindow,
      assessmentRequirements: [
        'Domain & Analytical Problem Solving Benchmark',
        'Case Study & Business Scenario Evaluation',
        'Professional Communication & Leadership Diagnostic',
      ],
      selectionProcess: [
        'Campus Call for Talent to Partner Institutions',
        'College Eligibility Verification & Student Opt-In',
        'Domain Skill & Case Evaluation Benchmark',
        'Panel Interviews & Case Presentation',
        'Digital Offer Letter & Campus Joining Sync',
      ],
      candidateProfileSummary,
      status: 'active',
    });

    onSuccess(requirement);
    onClose();
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Demand publication failed.'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-none shadow-2xl max-w-3xl w-full border border-slate-300 overflow-hidden text-slate-900">
        <div className="bg-white px-6 py-5 border-b border-slate-300 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 text-indigo-600 border border-slate-300"><Sparkles className="w-5 h-5" /></div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">NEW HIRING REQUIREMENT (ALL ACADEMIC DISCIPLINES)</div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">Post Job Requirements</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1 hover:bg-slate-100 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto font-sans">
          {formError && <p role="alert" className="text-sm text-rose-800">{formError}</p>}
          <div className="bg-slate-50 border border-slate-300 px-4 py-3 text-sm text-slate-700" role="status">
            <strong>Enter actual hiring criteria below.</strong> The AI job description assistant is on hold pending provider and privacy approval. Manual demand creation remains available.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label htmlFor="job-role-title-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Role Title</label><input id="job-role-title-input" type="text" value={role} onChange={(e) => setRole(e.target.value)} required className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none" /></div>
            <div><label htmlFor="vacancies-count-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Total Open Positions (Vacancies)</label><input id="vacancies-count-input" type="number" value={vacancies} onChange={(e) => setVacancies(Number(e.target.value))} min={1} required className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none" /></div>
            <div><label htmlFor="joining-window-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Expected Joining Period</label><input id="joining-window-input" type="text" value={joiningWindow} onChange={(e) => setJoiningWindow(e.target.value)} placeholder="e.g., June–August 2027" required className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none" /></div>
            <div><label htmlFor="education-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Accepted degree / programme names</label><input id="education-input" value={education} onChange={e=>setEducation(e.target.value)} placeholder="e.g. B.Tech, B.Sc (blank = any)" className="w-full text-xs p-2.5 border border-slate-300"/></div>
            <div><label htmlFor="graduation-years-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Graduation years</label><input id="graduation-years-input" value={graduationYears} onChange={e=>setGraduationYears(e.target.value)} placeholder="e.g. 2027, 2028 (blank = any)" className="w-full text-xs p-2.5 border border-slate-300"/></div>
            <p className="sm:col-span-2 text-xs text-slate-500">Academic filters use exact stored programme and discipline names (case-insensitive). Leave a filter blank to allow all.</p>
            <div className="sm:col-span-2"><label htmlFor="target-academic-branches-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Eligible Academic Courses & Disciplines (Comma separated)</label><input id="target-academic-branches-input" type="text" value={branches} onChange={(e) => setBranches(e.target.value)} placeholder="e.g., Commerce, Mechanical Engineering (blank = any)" className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none" /></div>
            <div className="sm:col-span-2"><label htmlFor="required-skills-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Required Subject & Domain Skills (Comma separated)</label><input id="required-skills-input" type="text" value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} placeholder="e.g., Operations Management, Financial Modeling, Communication, CAD Design" required className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none" /></div>
            <div className="sm:col-span-2"><label htmlFor="job-locations-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Job Locations (Comma separated)</label><input id="job-locations-input" type="text" value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="e.g., Bengaluru, Mumbai, Pune, Remote" required className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none" /></div>
            <div><label htmlFor="salary-min-lpa-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Min Salary (LPA)</label><input id="salary-min-lpa-input" type="number" step="0.5" value={salaryMinLPA} onChange={(e) => setSalaryMinLPA(Number(e.target.value))} min={0} required className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none" /></div>
            <div><label htmlFor="salary-max-lpa-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Max Salary (LPA)</label><input id="salary-max-lpa-input" type="number" step="0.5" value={salaryMaxLPA} onChange={(e) => setSalaryMaxLPA(Number(e.target.value))} min={0} required className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none" /></div>
            <div className="sm:col-span-2"><label htmlFor="ideal-candidate-profile-summary" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">Ideal Student Profile & Domain Readiness Summary</label><textarea id="ideal-candidate-profile-summary" rows={2} value={candidateProfileSummary} onChange={(e) => setCandidateProfileSummary(e.target.value)} required className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none" /></div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-mono text-slate-500 hover:text-slate-900 uppercase transition-colors cursor-pointer">Cancel</button>
            <button type="submit" id="submit-requirement-btn" disabled={isSubmitting || isParsing} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs tracking-wider transition-all flex items-center space-x-2 cursor-pointer shadow-lg"><span>Publish Demand & Match Colleges</span><ArrowRight className="w-4 h-4" /></button>
          </div>
        </form>
      </div>
    </div>
  );
};

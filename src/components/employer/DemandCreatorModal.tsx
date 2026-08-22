import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import { Sparkles, X, Check, ArrowRight, Loader2, Wand2, Briefcase, MapPin, IndianRupee, Calendar } from 'lucide-react';
import { HiringRequirement } from '../../types';

interface DemandCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (req: HiringRequirement) => void;
}

export const DemandCreatorModal: React.FC<DemandCreatorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { createRequirementAndCampaign } = useTalentNetwork();

  const [promptText, setPromptText] = useState<string>(
    'We need 200 Management Trainees & Financial Analysts (B.Com, BBA, MBA, B.Tech) with operations, financial analysis, and communication skills for Bengaluru & Mumbai at ₹8-12.5 LPA.'
  );
  const [isParsing, setIsParsing] = useState(false);

  // Form State
  const [role, setRole] = useState('Management Trainee - Business Operations & Strategy');
  const [vacancies, setVacancies] = useState<number>(200);
  const [branches, setBranches] = useState<string>('Commerce & Financial Studies, Business Administration, Economics, Engineering Disciplines');
  const [requiredSkills, setRequiredSkills] = useState<string>('Operations Management, Financial Modeling, Analytical Problem Solving, Business Communication');
  const [locations, setLocations] = useState<string>('Bengaluru, Mumbai, Pune');
  const [salaryMinLPA, setSalaryMinLPA] = useState<number>(8.0);
  const [salaryMaxLPA, setSalaryMaxLPA] = useState<number>(12.5);
  const [joiningWindow, setJoiningWindow] = useState('June–August 2027');
  const [candidateProfileSummary, setCandidateProfileSummary] = useState(
    'High-intent 2027 graduates across commerce, management, and technical streams with strong foundational analytical rigor, verified domain benchmarks, and collaborative communication.'
  );

  if (!isOpen) return null;

  const handleAIParsing = async () => {
    if (!promptText.trim()) return;
    setIsParsing(true);
    try {
      const response = await fetch('/api/gemini/parse-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        const d = result.data;
        if (d.role) setRole(d.role);
        if (d.vacancies) setVacancies(d.vacancies);
        if (d.branches) setBranches(Array.isArray(d.branches) ? d.branches.join(', ') : d.branches);
        if (d.requiredSkills) setRequiredSkills(Array.isArray(d.requiredSkills) ? d.requiredSkills.join(', ') : d.requiredSkills);
        if (d.locations) setLocations(Array.isArray(d.locations) ? d.locations.join(', ') : d.locations);
        if (d.salaryMinLPA) setSalaryMinLPA(d.salaryMinLPA);
        if (d.salaryMaxLPA) setSalaryMaxLPA(d.salaryMaxLPA);
        if (d.joiningWindow) setJoiningWindow(d.joiningWindow);
        if (d.candidateProfileSummary) setCandidateProfileSummary(d.candidateProfileSummary);
      }
    } catch (err) {
      console.warn('AI parsing failed, using heuristic parse', err);
    } finally {
      setIsParsing(false);
    }
  };

  const samplePrompts = [
    'We need 200 Management Trainees (MBA, BBA, B.Com, B.Tech) with operations, financial analysis, and communication skills for Bengaluru & Mumbai at ₹8-12.5 LPA.',
    'Looking for 150 Graduate Engineering Trainees (Mechanical, Civil, Mechatronics) with CAD, FEA, and structural design skills for Pune & Chennai at ₹7.5-11 LPA.',
    'Hiring 80 Biotechnology & Life Sciences graduates (B.Sc, M.Sc, B.Pharm) with HPLC chromatography and GLP lab protocols for Hyderabad at ₹8-13.5 LPA.',
    'Need 100 Corporate Communications & Brand Trainees (B.A. Journalism, Mass Comm, B.Des) with content strategy and PR skills for Delhi NCR at ₹7-10.5 LPA.',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const branchList = branches.split(',').map((b) => b.trim()).filter(Boolean);
    const skillList = requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);
    const locList = locations.split(',').map((l) => l.trim()).filter(Boolean);

    const { requirement } = createRequirementAndCampaign({
      role,
      vacancies: Number(vacancies),
      education: ['B.Tech', 'B.E.', 'B.Com', 'BBA', 'B.Sc', 'M.Sc', 'MBA', 'B.A.', 'B.Des'],
      graduationYears: [2027],
      branches: branchList.length > 0 ? branchList : ['Commerce & Financial Studies', 'Business Administration'],
      requiredSkills: skillList.length > 0 ? skillList : ['Operations Management', 'Communication', 'Problem Solving'],
      experienceLevel: 'Campus Freshers / 0-1 Years',
      locations: locList.length > 0 ? locList : ['Bengaluru', 'Mumbai'],
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
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-none shadow-2xl max-w-3xl w-full border border-slate-300 overflow-hidden text-slate-900">
        {/* Header */}
        <div className="bg-white px-6 py-5 border-b border-slate-300 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 text-indigo-600 border border-slate-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                NEW HIRING REQUIREMENT (ALL ACADEMIC DISCIPLINES)
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
                Post Job Requirements
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 p-1 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto font-sans">
          {/* AI Demand Prompt Box */}
          <div className="bg-white p-4 border border-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="ai-demand-prompt-input" className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Wand2 className="w-3.5 h-3.5" />
                <span>AI Job Description Assistant</span>
              </label>
              <button
                type="button"
                id="parse-demand-ai-btn"
                onClick={handleAIParsing}
                disabled={isParsing}
                className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white uppercase tracking-tight transition-all disabled:opacity-50 cursor-pointer"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Auto-filling Form...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    <span>Fill Form with AI</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              id="ai-demand-prompt-input"
              rows={2}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., We need 150 B.Com / MBA graduates for Financial Analyst roles in Mumbai at ₹8-12 LPA..."
              className="w-full bg-white text-xs font-mono text-slate-900 p-3 border border-slate-300 focus:border-indigo-600 focus:outline-none resize-none"
            />

            {/* Quick Samples */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">
                Sample Prompts for Different Academic Streams:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPromptText(p);
                    }}
                    className="text-[10px] font-mono bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 px-2.5 py-1 border border-slate-200 text-left transition-colors cursor-pointer"
                  >
                    {p.length > 70 ? `${p.slice(0, 70)}...` : p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="job-role-title-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                Role Title
              </label>
              <input
                id="job-role-title-input"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="vacancies-count-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                Total Open Positions (Vacancies)
              </label>
              <input
                id="vacancies-count-input"
                type="number"
                value={vacancies}
                onChange={(e) => setVacancies(Number(e.target.value))}
                min={1}
                required
                className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="joining-window-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                Expected Joining Period
              </label>
              <input
                id="joining-window-input"
                type="text"
                value={joiningWindow}
                onChange={(e) => setJoiningWindow(e.target.value)}
                placeholder="e.g., June–August 2027"
                required
                className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="target-academic-branches-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                Eligible Academic Courses & Disciplines (Comma separated)
              </label>
              <input
                id="target-academic-branches-input"
                type="text"
                value={branches}
                onChange={(e) => setBranches(e.target.value)}
                placeholder="e.g., Commerce & Financial Studies, Business Administration, Mechanical Engineering"
                required
                className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="required-skills-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                Required Subject & Domain Skills (Comma separated)
              </label>
              <input
                id="required-skills-input"
                type="text"
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                placeholder="e.g., Operations Management, Financial Modeling, Communication, CAD Design"
                required
                className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="job-locations-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                Job Locations (Comma separated)
              </label>
              <input
                id="job-locations-input"
                type="text"
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
                placeholder="e.g., Bengaluru, Mumbai, Pune, Remote"
                required
                className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="salary-min-lpa-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                Min Salary (LPA)
              </label>
              <input
                id="salary-min-lpa-input"
                type="number"
                step="0.5"
                value={salaryMinLPA}
                onChange={(e) => setSalaryMinLPA(Number(e.target.value))}
                required
                className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="salary-max-lpa-input" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                Max Salary (LPA)
              </label>
              <input
                id="salary-max-lpa-input"
                type="number"
                step="0.5"
                value={salaryMaxLPA}
                onChange={(e) => setSalaryMaxLPA(Number(e.target.value))}
                required
                className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="ideal-candidate-profile-summary" className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                Ideal Student Profile & Domain Readiness Summary
              </label>
              <textarea
                id="ideal-candidate-profile-summary"
                rows={2}
                value={candidateProfileSummary}
                onChange={(e) => setCandidateProfileSummary(e.target.value)}
                required
                className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-slate-500 hover:text-slate-900 uppercase transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-requirement-btn"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs tracking-wider transition-all flex items-center space-x-2 cursor-pointer shadow-lg"
            >
              <span>Publish Demand & Match Colleges</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

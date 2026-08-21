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
    'I need 300 B.Tech CSE graduates with Python, SQL and communication skills for Bengaluru, joining between June–August.'
  );
  const [isParsing, setIsParsing] = useState(false);

  // Form State
  const [role, setRole] = useState('Graduate Software Engineer - Core Engineering');
  const [vacancies, setVacancies] = useState<number>(300);
  const [branches, setBranches] = useState<string>('Computer Science & Engineering, Information Technology, AI & Data Science');
  const [requiredSkills, setRequiredSkills] = useState<string>('Python, SQL, Communication, Data Structures');
  const [locations, setLocations] = useState<string>('Bengaluru, Hyderabad');
  const [salaryMinLPA, setSalaryMinLPA] = useState<number>(8.0);
  const [salaryMaxLPA, setSalaryMaxLPA] = useState<number>(12.5);
  const [joiningWindow, setJoiningWindow] = useState('June–August 2027');
  const [candidateProfileSummary, setCandidateProfileSummary] = useState(
    'High-intent 2027 engineering graduates with verified programming rigor in Python, relational query capability in SQL, and clear engineering communication.'
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
    'I need 300 B.Tech CSE graduates with Python, SQL and communication skills for Bengaluru, joining between June–August.',
    'I want 500 candidates from engineering colleges in Madhya Pradesh with Java, DSA, and Database knowledge for Indore & Bhopal.',
    'Looking for 150 AI & Data Science engineering graduates with Python, PyTorch, and SQL for Hyderabad at ₹10-15 LPA.',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const branchList = branches.split(',').map((b) => b.trim()).filter(Boolean);
    const skillList = requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);
    const locList = locations.split(',').map((l) => l.trim()).filter(Boolean);

    const { requirement } = createRequirementAndCampaign({
      role,
      vacancies: Number(vacancies),
      education: ['B.Tech', 'B.E.'],
      graduationYears: [2027],
      branches: branchList.length > 0 ? branchList : ['Computer Science & Engineering'],
      requiredSkills: skillList.length > 0 ? skillList : ['Python', 'SQL', 'Communication'],
      experienceLevel: 'Campus Freshers / 0-1 Years',
      locations: locList.length > 0 ? locList : ['Bengaluru'],
      salaryMinLPA: Number(salaryMinLPA),
      salaryMaxLPA: Number(salaryMaxLPA),
      joiningWindow,
      assessmentRequirements: [
        'Core Coding Benchmark (DSA & Python)',
        'Database & SQL Diagnostic Assessment',
        'Engineering Communication & Problem Solving',
      ],
      selectionProcess: [
        'Call for Institutional Talent',
        'Student Consent & Opt-In',
        'Online Proctored Assessment',
        'Technical & Architectural Interview Rounds',
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
      <div className="bg-[#111111] rounded-none shadow-2xl max-w-3xl w-full border border-[#333333] overflow-hidden text-[#F5F5F5]">
        {/* Header */}
        <div className="bg-[#181818] px-6 py-5 border-b border-[#333333] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#222222] text-[#CCFF00] border border-[#333333]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                01 // DEMAND GENERATOR
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white">
                Create Structured Hiring Demand
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#888888] hover:text-white p-1 hover:bg-[#222222] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto font-sans">
          {/* AI Demand Prompt Box */}
          <div className="bg-[#181818] p-4 border border-[#333333] space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="ai-demand-prompt-input" className="text-xs font-mono font-bold text-[#CCFF00] uppercase tracking-wider flex items-center space-x-1.5">
                <Wand2 className="w-3.5 h-3.5" />
                <span>Natural Language Demand Parser (Gemini AI Powered)</span>
              </label>
              <button
                type="button"
                id="parse-demand-ai-btn"
                onClick={handleAIParsing}
                disabled={isParsing}
                className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold px-3 py-1.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black uppercase tracking-tight transition-all disabled:opacity-50 cursor-pointer"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Parsing Schema...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-black" />
                    <span>Auto-Structure Schema</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              id="ai-demand-prompt-input"
              rows={2}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., I need 300 B.Tech CSE graduates with Python, SQL and communication skills for Bengaluru, joining between June–August."
              className="w-full text-xs font-mono bg-[#0A0A0A] p-3 border border-[#333333] focus:outline-none focus:border-[#CCFF00] text-white placeholder-[#666666]"
            />

            {/* Quick Sample Prompts */}
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-[#888888]">Try sample demand:</span>
              <div className="flex flex-wrap gap-1.5">
                {samplePrompts.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPromptText(sample);
                    }}
                    className="text-[11px] font-mono text-left bg-[#222222] hover:bg-[#333333] text-[#CCCCCC] px-2.5 py-1 border border-[#333333] transition-colors"
                  >
                    "{sample.slice(0, 52)}..."
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Structured Schema Output Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#888888] mb-1">
                Target Role / Designation
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#181818] border border-[#333333] text-white focus:border-[#CCFF00] focus:outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#888888] mb-1">
                Hiring Vacancies Volume
              </label>
              <input
                type="number"
                required
                min={1}
                value={vacancies}
                onChange={(e) => setVacancies(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-[#181818] border border-[#333333] text-[#CCFF00] font-mono font-bold focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#888888] mb-1">
                Target Graduation Year & Degrees
              </label>
              <input
                type="text"
                value="2027 (B.Tech / B.E.)"
                readOnly
                className="w-full px-3 py-2 text-sm bg-[#0A0A0A] border border-[#222222] text-[#888888] font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#888888] mb-1">
                Eligible Engineering Branches
              </label>
              <input
                type="text"
                required
                value={branches}
                onChange={(e) => setBranches(e.target.value)}
                placeholder="Computer Science, IT, Data Science, etc."
                className="w-full px-3 py-2 text-sm bg-[#181818] border border-[#333333] text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#888888] mb-1">
                Required Verified Skills
              </label>
              <input
                type="text"
                required
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                placeholder="Python, SQL, Communication, Data Structures"
                className="w-full px-3 py-2 text-sm bg-[#181818] border border-[#333333] text-white focus:border-[#CCFF00] focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#888888] mb-1">
                Target Locations
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#181818] border border-[#333333] text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#888888] mb-1">
                Compensation Range (LPA)
              </label>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <IndianRupee className="w-3.5 h-3.5 text-[#666666] absolute left-2.5 top-3" />
                  <input
                    type="number"
                    step="0.5"
                    value={salaryMinLPA}
                    onChange={(e) => setSalaryMinLPA(Number(e.target.value))}
                    className="w-full pl-8 pr-2 py-2 text-sm bg-[#181818] border border-[#333333] text-white font-mono focus:border-[#CCFF00] focus:outline-none"
                    placeholder="Min LPA"
                  />
                </div>
                <span className="text-[#666666] text-xs font-mono">TO</span>
                <div className="relative flex-1">
                  <IndianRupee className="w-3.5 h-3.5 text-[#666666] absolute left-2.5 top-3" />
                  <input
                    type="number"
                    step="0.5"
                    value={salaryMaxLPA}
                    onChange={(e) => setSalaryMaxLPA(Number(e.target.value))}
                    className="w-full pl-8 pr-2 py-2 text-sm bg-[#181818] border border-[#333333] text-white font-mono focus:border-[#CCFF00] focus:outline-none"
                    placeholder="Max LPA"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#888888] mb-1">
                Joining Window & Availability
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
                <input
                  type="text"
                  value={joiningWindow}
                  onChange={(e) => setJoiningWindow(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#181818] border border-[#333333] text-white focus:border-[#CCFF00] focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#888888] mb-1">
                Ideal Talent Supply Profile
              </label>
              <textarea
                rows={2}
                value={candidateProfileSummary}
                onChange={(e) => setCandidateProfileSummary(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#181818] border border-[#333333] text-white focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-[#333333] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono font-bold uppercase text-[#888888] hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-demand-btn"
              className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-mono font-black uppercase tracking-wider text-black bg-[#CCFF00] hover:bg-[#b8e600] transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Launch Hiring Campaign & Discover Supply</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

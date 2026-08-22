import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import {
  Briefcase,
  Building2,
  Users,
  Plus,
  Send,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  MapPin,
  IndianRupee,
  Layers,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import { DemandCreatorModal } from './DemandCreatorModal';
import { CallStatusBadge, StageBadge } from '../common/StatusBadge';
import { HiringRequirement, InstitutionSupplyMatch, StudentCandidateMatch } from '../../types';

export const EmployerPortal: React.FC = () => {
  const {
    currentEmployer,
    requirements,
    campaigns,
    callsForTalent,
    institutions,
    students,
    studentOpportunities,
    reputationMatrix,
    getInstitutionMatchesForRequirement,
    getStudentMatchesForRequirement,
    sendCallForTalent,
    advanceCandidateStage,
  } = useTalentNetwork();

  const [activeTab, setActiveTab] = useState<
    'campaigns' | 'level1_institutions' | 'level2_students' | 'reputation_matrix' | 'market_graph'
  >('campaigns');

  const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState<string>(
    requirements[0]?.id || ''
  );
  const [selectedInstIds, setSelectedInstIds] = useState<string[]>([]);
  const [callSuccessMessage, setCallSuccessMessage] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<StudentCandidateMatch | null>(null);

  const activeRequirement =
    requirements.find((r) => r.id === selectedReqId) || requirements[0] || null;
  const activeCampaign =
    campaigns.find((c) => c.requirementId === activeRequirement?.id) || campaigns[0] || null;

  // Compute matches
  const institutionMatches: InstitutionSupplyMatch[] = activeRequirement
    ? getInstitutionMatchesForRequirement(activeRequirement)
    : [];

  const studentMatches: StudentCandidateMatch[] = activeRequirement
    ? getStudentMatchesForRequirement(activeRequirement).filter((m) =>
        m.student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        m.student.institutionName.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        m.student.skills.some((s) => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
      )
    : [];

  const handleToggleInstitutionSelect = (id: string) => {
    setSelectedInstIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllInstitutions = () => {
    if (selectedInstIds.length === institutionMatches.length) {
      setSelectedInstIds([]);
    } else {
      setSelectedInstIds(institutionMatches.map((m) => m.institution.id));
    }
  };

  const handleDispatchCallForTalent = () => {
    if (!activeCampaign || selectedInstIds.length === 0) return;
    sendCallForTalent(activeCampaign.id, selectedInstIds);
    setCallSuccessMessage(
      `Sent hiring drive invitations to ${selectedInstIds.length} colleges for ${activeRequirement?.vacancies} openings!`
    );
    setSelectedInstIds([]);
    setTimeout(() => setCallSuccessMessage(null), 5000);
  };

  // Funnel calculations for active campaign
  const funnel = activeCampaign?.funnel || {
    requiredVacancies: 300,
    institutionsInvited: 25,
    institutionsAccepted: 22,
    studentsInvited: 14800,
    applicationsConsented: 9200,
    assessmentsCompleted: 7100,
    shortlisted: 2100,
    interviewed: 1400,
    offersMade: 620,
    offersAccepted: 560,
    joined: 510,
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900">
      {/* Employer Banner Header */}
      <div className="bg-white p-6 border border-slate-300 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white border border-slate-300 flex items-center justify-center text-3xl">
              {currentEmployer.logo}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">{currentEmployer.name}</h1>
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-100 text-indigo-600 border border-slate-300">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  VERIFIED EMPLOYER
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 mt-1 flex items-center space-x-3">
                <span className="uppercase">{currentEmployer.industry}</span>
                <span>//</span>
                <span className="flex items-center">
                  <MapPin className="w-3 h-3 mr-1 text-slate-500" />
                  {currentEmployer.headquarters}
                </span>
                <span>//</span>
                <span>TOTAL HIRES: <strong className="text-indigo-600">{currentEmployer.totalHiresCount}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              id="create-demand-btn"
              onClick={() => setIsDemandModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs tracking-wider transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>POST NEW JOB OPENING</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Bar for Employer Views */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap gap-2">
          <button
            id="tab-campaigns"
            onClick={() => setActiveTab('campaigns')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'campaigns'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Hiring Pipeline
          </button>
          <button
            id="tab-level1"
            onClick={() => setActiveTab('level1_institutions')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'level1_institutions'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Colleges & Universities</span>
          </button>
          <button
            id="tab-level2"
            onClick={() => setActiveTab('level2_students')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'level2_students'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Matched Candidates</span>
          </button>
          <button
            id="tab-reputation"
            onClick={() => setActiveTab('reputation_matrix')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'reputation_matrix'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>College Track Record</span>
          </button>
          <button
            id="tab-market-graph"
            onClick={() => setActiveTab('market_graph')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'market_graph'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Student Pool Overview</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {callSuccessMessage && (
        <div className="bg-white border-l-4 border-indigo-600 border-y border-r border-slate-300 text-slate-900 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>{callSuccessMessage}</span>
          </div>
          <button
            onClick={() => setCallSuccessMessage(null)}
            className="text-[10px] font-mono uppercase text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Requirement Selector if multiple exist */}
      {requirements.length > 1 && (
        <div className="bg-white p-4 border border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
              SELECT JOB OPENING:
            </span>
            <select
              value={selectedReqId}
              onChange={(e) => setSelectedReqId(e.target.value)}
              aria-label="Select Active Hiring Campaign"
              className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 px-3 py-1.5 focus:border-indigo-600 focus:outline-none"
            >
              {requirements.map((req) => (
                <option key={req.id} value={req.id}>
                  {req.role} ({req.vacancies} Openings) - {req.joiningWindow}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs font-mono text-slate-500">
            LOCATIONS: <strong className="text-slate-900">{activeRequirement?.locations.join(', ')}</strong> // SALARY: <strong className="text-indigo-600">₹{activeRequirement?.salaryMinLPA} - {activeRequirement?.salaryMaxLPA} LPA</strong>
          </div>
        </div>
      )}

      {/* TAB 1: CAMPAIGNS & HIRING PIPELINE */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Active Requirement Card */}
          {activeRequirement && (
            <div className="bg-white p-6 border border-slate-300">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-white text-indigo-600 border border-slate-300">
                      JOB OPENING #{activeRequirement.id.slice(-4)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">POSTED ON {new Date(activeRequirement.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mt-1">{activeRequirement.role}</h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-3xl font-sans">
                    {activeRequirement.candidateProfileSummary}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="bg-white p-3 border border-slate-300 min-w-[120px]">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">Openings</span>
                    <span className="text-xl font-mono font-black text-indigo-600">{activeRequirement.vacancies}</span>
                  </div>
                  <div className="bg-white p-3 border border-slate-300 min-w-[140px]">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">Salary Package</span>
                    <span className="text-sm font-mono font-bold text-slate-900">₹{activeRequirement.salaryMinLPA} - {activeRequirement.salaryMaxLPA} LPA</span>
                  </div>
                  <div className="bg-white p-3 border border-slate-300 min-w-[130px]">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">Joining Date</span>
                    <span className="text-xs font-mono font-bold text-slate-900">{activeRequirement.joiningWindow}</span>
                  </div>
                </div>
              </div>

              {/* Skills & Branches Required */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase text-slate-500 mr-1">Required Skills:</span>
                  {activeRequirement.requiredSkills.map((sk, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-white font-mono text-[10px] text-slate-900 border border-slate-300">
                      {sk}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase text-slate-500 mr-1">Target Degrees / Branches:</span>
                  {activeRequirement.branches.map((br, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-white font-mono text-[10px] text-indigo-600 border border-slate-300">
                      {br}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Unified Recruitment Funnel */}
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                  HIRING STAGES & PROGRESS
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <span>Candidate Hiring Funnel</span>
                </h3>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-white text-indigo-600 border border-slate-300">
                TARGET: {funnel.requiredVacancies} HIRES ({Math.round((funnel.joined / funnel.requiredVacancies) * 100)}% COMPLETED)
              </span>
            </div>

            {/* Funnel Stage Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              <div className="bg-white p-3 border border-slate-200 text-center">
                <span className="text-[9px] font-mono uppercase text-slate-500 block">Colleges</span>
                <span className="text-lg font-mono font-black text-slate-900">{funnel.institutionsInvited}</span>
                <span className="text-[9px] font-mono text-indigo-600 block mt-0.5">
                  {funnel.institutionsAccepted} Accepted
                </span>
              </div>

              <div className="bg-white p-3 border border-slate-200 text-center">
                <span className="text-[9px] font-mono uppercase text-slate-500 block">Eligible Pool</span>
                <span className="text-lg font-mono font-black text-slate-900">{funnel.studentsInvited.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-slate-500 block mt-0.5">Total Students</span>
              </div>

              <div className="bg-white p-3 border border-slate-200 text-center">
                <span className="text-[9px] font-mono uppercase text-slate-500 block">Applied</span>
                <span className="text-lg font-mono font-black text-slate-900">{funnel.applicationsConsented.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-indigo-600 block mt-0.5">
                  {Math.round((funnel.applicationsConsented / funnel.studentsInvited) * 100)}% Opted In
                </span>
              </div>

              <div className="bg-white p-3 border border-slate-200 text-center">
                <span className="text-[9px] font-mono uppercase text-slate-500 block">Tests Taken</span>
                <span className="text-lg font-mono font-black text-slate-900">{funnel.assessmentsCompleted.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-slate-500 block mt-0.5">Coding Tests</span>
              </div>

              <div className="bg-white p-3 border border-slate-200 text-center">
                <span className="text-[9px] font-mono uppercase text-slate-500 block">Shortlisted</span>
                <span className="text-lg font-mono font-black text-slate-900">{funnel.shortlisted.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-indigo-600 block mt-0.5">Top Scorers</span>
              </div>

              <div className="bg-white p-3 border border-slate-200 text-center">
                <span className="text-[9px] font-mono uppercase text-slate-500 block">Interviewed</span>
                <span className="text-lg font-mono font-black text-slate-900">{funnel.interviewed.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-slate-500 block mt-0.5">Technical & HR</span>
              </div>

              <div className="bg-white p-3 border border-slate-200 text-center">
                <span className="text-[9px] font-mono uppercase text-slate-500 block">Offers Made</span>
                <span className="text-lg font-mono font-black text-slate-900">{funnel.offersMade}</span>
                <span className="text-[9px] font-mono text-indigo-600 block mt-0.5">{funnel.offersAccepted} Accepted</span>
              </div>

              <div className="bg-slate-100 p-3 border border-indigo-600 text-center">
                <span className="text-[9px] font-mono uppercase font-black text-indigo-600 block">Joined</span>
                <span className="text-2xl font-mono font-black text-indigo-600">{funnel.joined}</span>
                <span className="text-[9px] font-mono uppercase text-slate-900 block mt-0.5">Hired</span>
              </div>
            </div>

            {/* Visual Funnel Conversion Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1.5">
                <span>RECRUITMENT CONVERSION FLOW</span>
                <span className="text-indigo-600">{funnel.joined} / {funnel.requiredVacancies} POSITIONS FILLED</span>
              </div>
              <div className="w-full h-3 bg-white border border-slate-300 flex overflow-hidden">
                <div className="bg-white/30 h-full" style={{ width: '30%' }} title="Invited pool" />
                <div className="bg-white/50 h-full" style={{ width: '25%' }} title="Applied & Consented" />
                <div className="bg-white/70 h-full" style={{ width: '20%' }} title="Assessed" />
                <div className="bg-white h-full" style={{ width: '15%' }} title="Interviewed" />
                <div className="bg-indigo-600 h-full" style={{ width: '10%' }} title="Joined" />
              </div>
            </div>
          </div>

          {/* Active Invitations Sent */}
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                  COLLEGE INVITATIONS
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <span>Invitations Sent to Colleges</span>
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('level1_institutions')}
                className="text-xs font-mono font-bold uppercase text-indigo-600 hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <span>INVITE MORE COLLEGES</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-300 bg-white text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-3">College Name</th>
                    <th className="py-3 px-3">Job Role</th>
                    <th className="py-3 px-3 text-center">Openings Requested</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3">Placement Officer Response & Notes</th>
                    <th className="py-3 px-3 text-right">Available Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {callsForTalent.map((call) => (
                    <tr key={call.id} className="hover:bg-white transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900 flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{call.institutionName}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{call.role}</td>
                      <td className="py-3 px-3 text-center font-bold text-indigo-600">{call.vacanciesRequested}</td>
                      <td className="py-3 px-3 text-center">
                        <CallStatusBadge status={call.status} />
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate font-sans">
                        {call.responseNotes || <span className="text-slate-500 italic">Waiting for Placement Officer review...</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {call.offeredCandidatesCount ? (
                          <span className="font-bold text-indigo-600 bg-slate-100 px-2 py-0.5 border border-slate-300">
                            {call.offeredCandidatesCount} students
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LEVEL 1 — COLLEGES & UNIVERSITIES */}
      {activeTab === 'level1_institutions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="max-w-3xl">
              <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                CAMPUS OUTREACH
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 mt-1">Discover Partner Colleges</h2>
              <p className="text-xs text-slate-500 mt-1 font-sans">
                Review colleges matching your criteria, see past hiring success rates, and send invitations directly to their placement offices.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="text-xs font-mono text-slate-500">
                JOB OPENING: <strong className="text-slate-900">{activeRequirement?.role}</strong> ({activeRequirement?.vacancies} openings)
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleSelectAllInstitutions}
                  className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white text-slate-600 hover:text-slate-900 border border-slate-300 transition-colors cursor-pointer"
                >
                  {selectedInstIds.length === institutionMatches.length ? 'DESELECT ALL' : 'SELECT ALL COLLEGES'}
                </button>
                <button
                  id="dispatch-call-btn"
                  onClick={handleDispatchCallForTalent}
                  disabled={selectedInstIds.length === 0}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-mono font-black uppercase tracking-tight transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SEND INVITATION ({selectedInstIds.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Institutional Match Table */}
          <div className="bg-white p-6 border border-slate-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-300 bg-white text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedInstIds.length === institutionMatches.length && institutionMatches.length > 0}
                        onChange={handleSelectAllInstitutions}
                        className="cursor-pointer accent-indigo-600"
                      />
                    </th>
                    <th className="py-3 px-3">College & Location</th>
                    <th className="py-3 px-3 text-center">Match Score</th>
                    <th className="py-3 px-3 text-center">Total Students</th>
                    <th className="py-3 px-3 text-center">Top Matches</th>
                    <th className="py-3 px-3 text-center">Looking for Jobs</th>
                    <th className="py-3 px-3 text-center">Past Offer Rate</th>
                    <th className="py-3 px-3 text-center">Joining Rate</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {institutionMatches.map(({ institution, fitScore, eligibleStudentsCount, strongMatchCount, availableSeekingCount, reasons, historicalPerformance }) => {
                    const isSelected = selectedInstIds.includes(institution.id);
                    const existingCall = callsForTalent.find(
                      (c) => c.institutionId === institution.id && c.campaignId === activeCampaign?.id
                    );

                    return (
                      <tr
                        key={institution.id}
                        className={`hover:bg-white transition-colors ${isSelected ? 'bg-white border-l-2 border-indigo-600' : ''}`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleInstitutionSelect(institution.id)}
                            className="cursor-pointer accent-indigo-600"
                          />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900 flex items-center space-x-2">
                            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>{institution.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {institution.city}, {institution.state} // {institution.type}
                          </div>
                          <div className="text-[10px] text-indigo-600 mt-1 font-sans">
                            {reasons[0]}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-black bg-slate-100 text-indigo-600 border border-slate-300">
                            {fitScore}%
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-slate-900">{eligibleStudentsCount.toLocaleString()}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-indigo-600">{strongMatchCount.toLocaleString()}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-slate-900">{availableSeekingCount.toLocaleString()}</td>
                        <td className="py-3.5 px-3 text-center font-semibold text-slate-600">
                          {historicalPerformance.offerRatePercent}%
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-indigo-600">
                          {historicalPerformance.joiningRatePercent}%
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {existingCall ? (
                            <CallStatusBadge status={existingCall.status} />
                          ) : (
                            <button
                              onClick={() => {
                                handleToggleInstitutionSelect(institution.id);
                                if (!isSelected) {
                                  sendCallForTalent(activeCampaign!.id, [institution.id]);
                                  setCallSuccessMessage(`Sent invitation to ${institution.name}`);
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                            >
                              INVITE
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LEVEL 2 — MATCHED CANDIDATES */}
      {activeTab === 'level2_students' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="max-w-3xl">
              <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                STUDENT CANDIDATES
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 mt-1">Search & Filter Matched Candidates</h2>
              <p className="text-xs text-slate-500 mt-1 font-sans">
                Browse verified student candidates across all partner campuses. Match scores are based on verified domain skills, subject test benchmarks, and academic records.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative w-full max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Filter by student name, domain skill, branch, or college..."
                  className="w-full pl-9 pr-4 py-2 bg-white text-slate-900 text-xs font-mono border border-slate-300 focus:border-indigo-600 focus:outline-none placeholder-slate-400"
                />
              </div>
              <span className="text-xs font-mono text-slate-500">
                FOUND <strong className="text-indigo-600">{studentMatches.length}</strong> MATCHING CANDIDATES
              </span>
            </div>
          </div>

          {/* Candidate Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentMatches.map(({ student, candidateFitScore, matchedSkills, alignmentPoints, aiRecommendation, visibilityDenied, visibilityStatus, redactedReason }) => {
              const activeOpp = studentOpportunities.find(
                (o) => o.studentId === student.id && o.campaignId === activeCampaign?.id
              );

              return (
                <div
                  key={student.id}
                  className={`p-5 border transition-all flex flex-col justify-between ${
                    visibilityDenied
                      ? 'bg-slate-50 border-rose-950/60 opacity-80'
                      : 'bg-white border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div>
                    {/* Header with Avatar & Fit Score */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className={`w-12 h-12 object-cover border ${
                            visibilityDenied ? 'border-rose-900 filter grayscale' : 'border-slate-300'
                          }`}
                        />
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                            <span>{student.name}</span>
                            {visibilityDenied ? (
                              <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950 px-1.5 py-0.2 border border-rose-800">
                                🔒 PRIVATE
                              </span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-indigo-600" title="Actively Seeking" />
                            )}
                          </h3>
                          <p className="text-[10px] font-mono text-slate-500">
                            {student.program} {student.branch.split(' ')[0]} ({student.graduationYear})
                          </p>
                          <p className="text-[10px] font-mono text-indigo-600 truncate max-w-[180px]">
                            {student.institutionName}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-mono font-black border ${
                            visibilityDenied
                              ? 'bg-rose-950/50 text-rose-400 border-rose-900'
                              : 'bg-slate-100 text-indigo-600 border-slate-300'
                          }`}
                        >
                          {visibilityDenied ? 'HIDDEN' : `${candidateFitScore}% MATCH`}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                          {visibilityDenied ? 'Marks Hidden' : `CGPA ${student.cgpa}`}
                        </span>
                      </div>
                    </div>

                    {/* Verified Skills */}
                    <div className="mt-3.5">
                      <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Verified Skills
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {student.skills.map((sk, idx) => (
                          <span
                            key={idx}
                            className={`px-1.5 py-0.5 text-[10px] font-mono border ${
                              visibilityDenied
                                ? 'bg-white text-slate-400 border-slate-200'
                                : sk.badge === 'Gold'
                                ? 'bg-slate-100 text-indigo-600 border-indigo-600/40'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {sk.badge === 'Gold' ? '🏆 ' : '✓ '}
                            {sk.name} ({sk.score}%)
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Rationale / Denial Note */}
                    <div
                      className={`mt-3 p-2.5 border text-[11px] ${
                        visibilityDenied
                          ? 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <span
                        className={`font-mono text-[9px] uppercase tracking-wider block mb-0.5 ${
                          visibilityDenied ? 'text-rose-400 font-bold' : 'text-indigo-600'
                        }`}
                      >
                        {visibilityDenied ? '🔒 Student Privacy Setting:' : '✨ Fit Summary:'}
                      </span>
                      <p className="line-clamp-2 font-sans">
                        {visibilityDenied
                          ? redactedReason || 'Student chose to keep their profile private for this company.'
                          : alignmentPoints[0]}
                      </p>
                    </div>
                  </div>

                  {/* Actions / Stage */}
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      {visibilityDenied ? (
                        <span className="text-[10px] font-mono text-rose-400 uppercase font-bold">
                          Hidden by Student
                        </span>
                      ) : activeOpp ? (
                        <StageBadge stage={activeOpp.stage} />
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          {student.availability === 'actively_seeking' ? 'Ready to Interview' : 'Open to offers'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          setSelectedCandidateDetail({
                            student,
                            candidateFitScore,
                            matchedSkills,
                            alignmentPoints,
                            aiRecommendation,
                            missingSkills: [],
                            visibilityDenied,
                            visibilityStatus,
                            redactedReason,
                          })
                        }
                        className="px-2.5 py-1 text-xs font-mono font-bold uppercase text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Profile
                      </button>

                      {!visibilityDenied && activeOpp && activeOpp.stage === 'assessment_completed' && (
                        <button
                          onClick={() => advanceCandidateStage(activeOpp.id, 'shortlisted')}
                          className="px-2.5 py-1 text-xs font-mono font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                        >
                          Shortlist
                        </button>
                      )}

                      {!visibilityDenied && activeOpp && activeOpp.stage === 'shortlisted' && (
                        <button
                          onClick={() => advanceCandidateStage(activeOpp.id, 'interviewing')}
                          className="px-2.5 py-1 text-xs font-mono font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                        >
                          Schedule Interview
                        </button>
                      )}

                      {!visibilityDenied && activeOpp && activeOpp.stage === 'interviewing' && (
                        <button
                          onClick={() => advanceCandidateStage(activeOpp.id, 'offered', { offerLetterUrl: null })}
                          className="px-2.5 py-1 text-xs font-mono font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                        >
                          Make Offer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: COLLEGE TRACK RECORD */}
      {activeTab === 'reputation_matrix' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
              COLLEGE PERFORMANCE DATA
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 mt-1">Past Hiring Success by College & Role</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl font-sans">
              See which colleges consistently produce top talent for specific job roles, including historical offer acceptance and joining rates.
            </p>
          </div>

          <div className="bg-white p-6 border border-slate-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-300 bg-white text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-3">College</th>
                    <th className="py-3 px-3">Job Domain</th>
                    <th className="py-3 px-3 text-center">Batch Size</th>
                    <th className="py-3 px-3 text-center">Applicants</th>
                    <th className="py-3 px-3 text-center">Offer Rate</th>
                    <th className="py-3 px-3 text-center">Joining Rate</th>
                    <th className="py-3 px-3 text-center">Skill Accuracy</th>
                    <th className="py-3 px-3">Key Strengths</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {reputationMatrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white transition-colors">
                      <td className="py-3.5 px-3 font-bold text-slate-900 flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{row.institutionName}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">{row.roleCategory}</td>
                      <td className="py-3.5 px-3 text-center text-slate-500">{row.eligibleSample}</td>
                      <td className="py-3.5 px-3 text-center text-slate-900">{row.applicants}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 text-indigo-600 border border-slate-300">
                          {row.offerRatePercent}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-900 border border-slate-300">
                          {row.joiningRatePercent}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-indigo-600">
                        {row.skillAccuracyPercent}%
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 text-[11px] max-w-sm font-sans">
                        {row.notableStrength}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: STUDENT POOL OVERVIEW */}
      {activeTab === 'market_graph' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                  STUDENT POOL DIRECTORY
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <span>Student Pool by College & Graduation Batch</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Overview of available graduating students across colleges and regions.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 text-indigo-600 p-6 font-mono text-xs overflow-x-auto border border-slate-200 leading-relaxed">
              <div className="text-slate-900 font-bold text-sm mb-2 uppercase">Candidate Pool (Role: Software Engineer)</div>
              <div className="text-slate-500">All Partner Colleges</div>
              <div className="pl-4 text-slate-400">│</div>
              {institutions.map((inst, idx) => {
                const totalHighMatch = inst.batches.reduce(
                  (acc, b) => acc + b.branches.reduce((bacc, br) => bacc + br.highMatchCount, 0),
                  0
                );
                const isLast = idx === institutions.length - 1;
                return (
                  <div key={inst.id} className="pl-4">
                    <div>{isLast ? '└── ' : '├── '} <strong className="text-slate-900">{inst.name}</strong> <span className="text-slate-500">({inst.city}, {inst.state})</span></div>
                    <div className="pl-8 text-slate-500">
                      ├── Total Graduating Students: <span className="text-slate-900 font-semibold">{inst.totalStudentSupply}</span>
                    </div>
                    <div className="pl-8 text-slate-500">
                      ├── Test-Ready Candidates: <span className="text-slate-600 font-semibold">{Math.round(inst.totalStudentSupply * 0.6)}</span>
                    </div>
                    <div className="pl-8 text-slate-500">
                      └── Top Matching Profiles: <span className="text-indigo-600 font-bold">{totalHighMatch} matches</span>
                    </div>
                    {!isLast && <div className="text-slate-400">│</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Candidate Detail Modal */}
      {selectedCandidateDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full border border-slate-300 overflow-hidden text-slate-900">
            <div className="bg-white p-6 border-b border-slate-300 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={selectedCandidateDetail.student.avatar}
                  alt={selectedCandidateDetail.student.name}
                  className="w-12 h-12 object-cover border border-slate-300"
                />
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{selectedCandidateDetail.student.name}</h3>
                  <p className="text-xs font-mono text-slate-500">
                    {selectedCandidateDetail.student.program} {selectedCandidateDetail.student.branch} // {selectedCandidateDetail.student.institutionName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCandidateDetail(null)}
                className="text-slate-500 hover:text-slate-900 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="flex items-center justify-between bg-white p-3 border border-slate-300">
                <span className="font-mono font-bold uppercase text-slate-500">Job Match Score</span>
                <span className="text-xl font-mono font-black text-indigo-600">{selectedCandidateDetail.candidateFitScore}%</span>
              </div>

              <div>
                <h4 className="font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">Verified Skills</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedCandidateDetail.student.skills.map((sk, idx) => (
                    <div key={idx} className="p-2.5 border border-slate-300 bg-white">
                      <div className="flex justify-between font-mono font-bold text-slate-900">
                        <span>{sk.name}</span>
                        <span className="text-indigo-600">{sk.score}%</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        Tested by: {sk.verifiedBy} ({sk.badge} Badge)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-mono font-bold text-slate-500 uppercase tracking-wider mb-2">Student Projects</h4>
                {selectedCandidateDetail.student.projects.map((proj) => (
                  <div key={proj.id} className="p-3 border border-slate-300 bg-white mb-2">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>{proj.title}</span>
                      {proj.verifiedScore && <span className="font-mono text-indigo-600">Score: {proj.verifiedScore}%</span>}
                    </div>
                    <p className="text-slate-500 mt-1 font-sans">{proj.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {proj.technologies.map((t, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-slate-100 font-mono text-slate-900 text-[10px] border border-slate-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-300 flex justify-end">
              <button
                onClick={() => setSelectedCandidateDetail(null)}
                className="px-4 py-2 bg-indigo-600 text-white font-mono font-bold uppercase text-xs cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demand Creator Modal */}
      <DemandCreatorModal
        isOpen={isDemandModalOpen}
        onClose={() => setIsDemandModalOpen(false)}
        onSuccess={(newReq) => {
          setSelectedReqId(newReq.id);
          setActiveTab('level1_institutions');
        }}
      />
    </div>
  );
};

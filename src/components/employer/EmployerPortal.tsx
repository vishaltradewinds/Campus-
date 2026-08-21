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
      `Dispatched CALL FOR TALENT to ${selectedInstIds.length} institutions for ${activeRequirement?.vacancies} vacancies!`
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
    <div className="space-y-6 pb-12 font-sans text-[#F5F5F5]">
      {/* Employer Banner & Demand Anchor Header */}
      <div className="bg-[#111111] p-6 border border-[#333333] shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-[#181818] border border-[#333333] flex items-center justify-center text-3xl">
              {currentEmployer.logo}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black uppercase italic tracking-tight text-white">{currentEmployer.name}</h1>
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#222222] text-[#CCFF00] border border-[#333333]">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  DEMAND ANCHOR
                </span>
              </div>
              <p className="text-xs font-mono text-[#888888] mt-1 flex items-center space-x-3">
                <span className="uppercase">{currentEmployer.industry}</span>
                <span>//</span>
                <span className="flex items-center">
                  <MapPin className="w-3 h-3 mr-1 text-[#666666]" />
                  {currentEmployer.headquarters}
                </span>
                <span>//</span>
                <span>HISTORICAL HIRES: <strong className="text-[#CCFF00]">{currentEmployer.totalHiresCount}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              id="create-demand-btn"
              onClick={() => setIsDemandModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs tracking-wider transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>CREATE HIRING DEMAND</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Bar for Employer Views */}
        <div className="mt-6 pt-4 border-t border-[#222222] flex flex-wrap gap-2">
          <button
            id="tab-campaigns"
            onClick={() => setActiveTab('campaigns')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'campaigns'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            01 // RECRUITMENT PIPELINE
          </button>
          <button
            id="tab-level1"
            onClick={() => setActiveTab('level1_institutions')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'level1_institutions'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>02 // LEVEL 1: INSTITUTION-FIRST</span>
          </button>
          <button
            id="tab-level2"
            onClick={() => setActiveTab('level2_students')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'level2_students'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>03 // LEVEL 2: VERIFIED TALENT</span>
          </button>
          <button
            id="tab-reputation"
            onClick={() => setActiveTab('reputation_matrix')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'reputation_matrix'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>04 // REPUTATION MATRIX</span>
          </button>
          <button
            id="tab-market-graph"
            onClick={() => setActiveTab('market_graph')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'market_graph'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>05 // SUPPLY GRAPH</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {callSuccessMessage && (
        <div className="bg-[#181818] border-l-4 border-[#CCFF00] border-y border-r border-[#333333] text-white px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#CCFF00]" />
            <span>{callSuccessMessage}</span>
          </div>
          <button
            onClick={() => setCallSuccessMessage(null)}
            className="text-[10px] font-mono uppercase text-[#888888] hover:text-white hover:underline cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Requirement Selector if multiple exist */}
      {requirements.length > 1 && (
        <div className="bg-[#111111] p-4 border border-[#333333] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-[10px] font-mono font-bold text-[#CCFF00] uppercase tracking-widest">
              SELECT DEMAND:
            </span>
            <select
              value={selectedReqId}
              onChange={(e) => setSelectedReqId(e.target.value)}
              aria-label="Select Active Hiring Campaign"
              className="text-xs font-mono font-bold text-white bg-[#181818] border border-[#333333] px-3 py-1.5 focus:border-[#CCFF00] focus:outline-none"
            >
              {requirements.map((req) => (
                <option key={req.id} value={req.id}>
                  {req.role} ({req.vacancies} Vacancies) - {req.joiningWindow}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs font-mono text-[#888888]">
            LOCATIONS: <strong className="text-white">{activeRequirement?.locations.join(', ')}</strong> // PACKAGE: <strong className="text-[#CCFF00]">₹{activeRequirement?.salaryMinLPA} - {activeRequirement?.salaryMaxLPA} LPA</strong>
          </div>
        </div>
      )}

      {/* TAB 1: CAMPAIGNS & SINGLE-TRUTH RECRUITMENT PIPELINE */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Active Requirement Card */}
          {activeRequirement && (
            <div className="bg-[#111111] p-6 border border-[#333333]">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#222222]">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#181818] text-[#CCFF00] border border-[#333333]">
                      DEMAND SPEC #{activeRequirement.id.slice(-4)}
                    </span>
                    <span className="text-[10px] font-mono text-[#666666]">ESTABLISHED {new Date(activeRequirement.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white mt-1">{activeRequirement.role}</h2>
                  <p className="text-xs text-[#888888] mt-1 max-w-3xl font-sans">
                    {activeRequirement.candidateProfileSummary}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="bg-[#181818] p-3 border border-[#333333] min-w-[120px]">
                    <span className="text-[10px] font-mono uppercase text-[#888888] block">Vacancies</span>
                    <span className="text-xl font-mono font-black text-[#CCFF00]">{activeRequirement.vacancies}</span>
                  </div>
                  <div className="bg-[#181818] p-3 border border-[#333333] min-w-[140px]">
                    <span className="text-[10px] font-mono uppercase text-[#888888] block">Compensation</span>
                    <span className="text-sm font-mono font-bold text-white">₹{activeRequirement.salaryMinLPA} - {activeRequirement.salaryMaxLPA} LPA</span>
                  </div>
                  <div className="bg-[#181818] p-3 border border-[#333333] min-w-[130px]">
                    <span className="text-[10px] font-mono uppercase text-[#888888] block">Joining Window</span>
                    <span className="text-xs font-mono font-bold text-white">{activeRequirement.joiningWindow}</span>
                  </div>
                </div>
              </div>

              {/* Skills & Branches Required */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase text-[#888888] mr-1">Required Skills:</span>
                  {activeRequirement.requiredSkills.map((sk, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-[#181818] font-mono text-[10px] text-white border border-[#333333]">
                      {sk}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase text-[#888888] mr-1">Target Branches:</span>
                  {activeRequirement.branches.map((br, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-[#181818] font-mono text-[10px] text-[#CCFF00] border border-[#333333]">
                      {br}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Unified Recruitment Funnel: Single Common Recruitment Truth */}
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                  02 // RECRUITMENT FLOW
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>Single-Truth Campaign Recruitment Pipeline</span>
                </h3>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-[#181818] text-[#CCFF00] border border-[#333333]">
                GOAL: {funnel.requiredVacancies} JOINED ({Math.round((funnel.joined / funnel.requiredVacancies) * 100)}% FULFILLED)
              </span>
            </div>

            {/* Funnel Stage Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              <div className="bg-[#181818] p-3 border border-[#282828] text-center">
                <span className="text-[9px] font-mono uppercase text-[#888888] block">Institutions</span>
                <span className="text-lg font-mono font-black text-white">{funnel.institutionsInvited}</span>
                <span className="text-[9px] font-mono text-[#CCFF00] block mt-0.5">
                  {funnel.institutionsAccepted} Accepted
                </span>
              </div>

              <div className="bg-[#181818] p-3 border border-[#282828] text-center">
                <span className="text-[9px] font-mono uppercase text-[#888888] block">Invited Pool</span>
                <span className="text-lg font-mono font-black text-white">{funnel.studentsInvited.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-[#888888] block mt-0.5">Campus Gateways</span>
              </div>

              <div className="bg-[#181818] p-3 border border-[#282828] text-center">
                <span className="text-[9px] font-mono uppercase text-[#888888] block">Consented</span>
                <span className="text-lg font-mono font-black text-white">{funnel.applicationsConsented.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-[#CCFF00] block mt-0.5">
                  {Math.round((funnel.applicationsConsented / funnel.studentsInvited) * 100)}% Opt-in
                </span>
              </div>

              <div className="bg-[#181818] p-3 border border-[#282828] text-center">
                <span className="text-[9px] font-mono uppercase text-[#888888] block">Assessed</span>
                <span className="text-lg font-mono font-black text-white">{funnel.assessmentsCompleted.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-[#888888] block mt-0.5">Verified Labs</span>
              </div>

              <div className="bg-[#181818] p-3 border border-[#282828] text-center">
                <span className="text-[9px] font-mono uppercase text-[#888888] block">Shortlisted</span>
                <span className="text-lg font-mono font-black text-white">{funnel.shortlisted.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-[#CCFF00] block mt-0.5">Top Percentile</span>
              </div>

              <div className="bg-[#181818] p-3 border border-[#282828] text-center">
                <span className="text-[9px] font-mono uppercase text-[#888888] block">Interviewed</span>
                <span className="text-lg font-mono font-black text-white">{funnel.interviewed.toLocaleString()}</span>
                <span className="text-[9px] font-mono text-[#888888] block mt-0.5">Tech & System</span>
              </div>

              <div className="bg-[#181818] p-3 border border-[#282828] text-center">
                <span className="text-[9px] font-mono uppercase text-[#888888] block">Offers Made</span>
                <span className="text-lg font-mono font-black text-white">{funnel.offersMade}</span>
                <span className="text-[9px] font-mono text-[#CCFF00] block mt-0.5">{funnel.offersAccepted} Accepted</span>
              </div>

              <div className="bg-[#222222] p-3 border border-[#CCFF00] text-center">
                <span className="text-[9px] font-mono uppercase font-black text-[#CCFF00] block">Joined</span>
                <span className="text-2xl font-mono font-black text-[#CCFF00]">{funnel.joined}</span>
                <span className="text-[9px] font-mono uppercase text-white block mt-0.5">Deployed</span>
              </div>
            </div>

            {/* Visual Funnel Conversion Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-[11px] font-mono text-[#888888] mb-1.5">
                <span>RECRUITMENT CONVERSION FLOW</span>
                <span className="text-[#CCFF00]">{funnel.joined} / {funnel.requiredVacancies} VACANCIES FILLED</span>
              </div>
              <div className="w-full h-3 bg-[#181818] border border-[#333333] flex overflow-hidden">
                <div className="bg-white/30 h-full" style={{ width: '30%' }} title="Invited pool" />
                <div className="bg-white/50 h-full" style={{ width: '25%' }} title="Applied & Consented" />
                <div className="bg-white/70 h-full" style={{ width: '20%' }} title="Assessed" />
                <div className="bg-white h-full" style={{ width: '15%' }} title="Interviewed" />
                <div className="bg-[#CCFF00] h-full" style={{ width: '10%' }} title="Joined" />
              </div>
            </div>
          </div>

          {/* Active Calls for Talent Sent */}
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                  03 // DISPATCHED TALENT CALLS
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>Dispatched "Calls for Talent" to Institutional Gateways</span>
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('level1_institutions')}
                className="text-xs font-mono font-bold uppercase text-[#CCFF00] hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <span>CALL MORE GATEWAYS</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#333333] bg-[#181818] text-[#888888] uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-3">Institution Name</th>
                    <th className="py-3 px-3">Role Requested</th>
                    <th className="py-3 px-3 text-center">Vacancies Asked</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3">Institution Response & Counter Notes</th>
                    <th className="py-3 px-3 text-right">Offered Supply</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222] text-[#F5F5F5]">
                  {callsForTalent.map((call) => (
                    <tr key={call.id} className="hover:bg-[#181818] transition-colors">
                      <td className="py-3 px-3 font-bold text-white flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
                        <span>{call.institutionName}</span>
                      </td>
                      <td className="py-3 px-3 text-[#CCCCCC]">{call.role}</td>
                      <td className="py-3 px-3 text-center font-bold text-[#CCFF00]">{call.vacanciesRequested}</td>
                      <td className="py-3 px-3 text-center">
                        <CallStatusBadge status={call.status} />
                      </td>
                      <td className="py-3 px-3 text-[#888888] max-w-xs truncate font-sans">
                        {call.responseNotes || <span className="text-[#555555] italic">Waiting for TPO review...</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {call.offeredCandidatesCount ? (
                          <span className="font-bold text-[#CCFF00] bg-[#222222] px-2 py-0.5 border border-[#333333]">
                            {call.offeredCandidatesCount} students
                          </span>
                        ) : (
                          <span className="text-[#555555]">-</span>
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

      {/* TAB 2: LEVEL 1 — INSTITUTION-FIRST DISCOVERY & "CALL FOR TALENT" */}
      {activeTab === 'level1_institutions' && (
        <div className="space-y-6">
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="max-w-3xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                04 // LEVEL 1 RECRUITMENT
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight text-white mt-1">Discover Institutional Supply Gateways</h2>
              <p className="text-xs text-[#888888] mt-1 font-sans">
                Employer says: <em className="text-[#CCFF00]">"I want 500 candidates from top engineering colleges in Karnataka & Madhya Pradesh."</em>
                {' '}The Matchmaking Engine aggregates institutional supply, historical conversion rates, and verified capacity.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#222222]">
              <div className="text-xs font-mono text-[#888888]">
                MATCHED FOR DEMAND: <strong className="text-white">{activeRequirement?.role}</strong> ({activeRequirement?.vacancies} vacancies)
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleSelectAllInstitutions}
                  className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-[#181818] text-[#CCCCCC] hover:text-white border border-[#333333] transition-colors cursor-pointer"
                >
                  {selectedInstIds.length === institutionMatches.length ? 'DESELECT ALL' : 'SELECT ALL GATEWAYS'}
                </button>
                <button
                  id="dispatch-call-btn"
                  onClick={handleDispatchCallForTalent}
                  disabled={selectedInstIds.length === 0}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-[#CCFF00] hover:bg-[#b8e600] disabled:opacity-50 text-black text-xs font-mono font-black uppercase tracking-tight transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SEND "CALL FOR TALENT" ({selectedInstIds.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Institutional Match Table */}
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#333333] bg-[#181818] text-[#888888] uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedInstIds.length === institutionMatches.length && institutionMatches.length > 0}
                        onChange={handleSelectAllInstitutions}
                        className="cursor-pointer accent-[#CCFF00]"
                      />
                    </th>
                    <th className="py-3 px-3">Institution & Region</th>
                    <th className="py-3 px-3 text-center">Fit Score</th>
                    <th className="py-3 px-3 text-center">Eligible Volume</th>
                    <th className="py-3 px-3 text-center">Strong Match</th>
                    <th className="py-3 px-3 text-center">Available Seeking</th>
                    <th className="py-3 px-3 text-center">Historical Offer Rate</th>
                    <th className="py-3 px-3 text-center">Joining Rate</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222] text-[#F5F5F5]">
                  {institutionMatches.map(({ institution, fitScore, eligibleStudentsCount, strongMatchCount, availableSeekingCount, reasons, historicalPerformance }) => {
                    const isSelected = selectedInstIds.includes(institution.id);
                    const existingCall = callsForTalent.find(
                      (c) => c.institutionId === institution.id && c.campaignId === activeCampaign?.id
                    );

                    return (
                      <tr
                        key={institution.id}
                        className={`hover:bg-[#181818] transition-colors ${isSelected ? 'bg-[#181818] border-l-2 border-[#CCFF00]' : ''}`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleInstitutionSelect(institution.id)}
                            className="cursor-pointer accent-[#CCFF00]"
                          />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-white flex items-center space-x-2">
                            <Building2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
                            <span>{institution.name}</span>
                          </div>
                          <div className="text-[10px] text-[#888888] mt-0.5">
                            {institution.city}, {institution.state} // {institution.type}
                          </div>
                          <div className="text-[10px] text-[#CCFF00] mt-1 font-sans">
                            {reasons[0]}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-black bg-[#222222] text-[#CCFF00] border border-[#333333]">
                            {fitScore}%
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-white">{eligibleStudentsCount.toLocaleString()}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-[#CCFF00]">{strongMatchCount.toLocaleString()}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-white">{availableSeekingCount.toLocaleString()}</td>
                        <td className="py-3.5 px-3 text-center font-semibold text-[#CCCCCC]">
                          {historicalPerformance.offerRatePercent}%
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-[#CCFF00]">
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
                                  setCallSuccessMessage(`Sent Call for Talent to ${institution.name}`);
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-[#CCFF00] hover:bg-[#b8e600] text-black transition-all cursor-pointer"
                            >
                              CALL GATEWAY
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

      {/* TAB 3: LEVEL 2 — STUDENT-FIRST VERIFIED NETWORK SEARCH */}
      {activeTab === 'level2_students' && (
        <div className="space-y-6">
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="max-w-3xl">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                05 // LEVEL 2 DIRECT DISCOVERY
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight text-white mt-1">Direct Verified Talent Network Discovery</h2>
              <p className="text-xs text-[#888888] mt-1 font-sans">
                Employer says: <em className="text-[#CCFF00]">"Show me the best candidates across all campuses regardless of institution."</em>
                {' '}Candidate fit scores are calculated against verified skill badges, benchmark test scores, and academic track record.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-[#222222] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="relative w-full max-w-md">
                <Search className="w-4 h-4 text-[#666666] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Filter by student name, skill (Python, SQL), or campus..."
                  className="w-full pl-9 pr-4 py-2 bg-[#181818] text-white text-xs font-mono border border-[#333333] focus:border-[#CCFF00] focus:outline-none placeholder-[#666666]"
                />
              </div>
              <span className="text-xs font-mono text-[#888888]">
                FOUND <strong className="text-[#CCFF00]">{studentMatches.length}</strong> MATCHING CANDIDATES
              </span>
            </div>
          </div>

          {/* Candidate Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentMatches.map(({ student, candidateFitScore, matchedSkills, alignmentPoints, aiRecommendation }) => {
              const activeOpp = studentOpportunities.find(
                (o) => o.studentId === student.id && o.campaignId === activeCampaign?.id
              );

              return (
                <div
                  key={student.id}
                  className="bg-[#111111] p-5 border border-[#333333] hover:border-[#555555] transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header with Avatar & Fit Score */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className="w-12 h-12 object-cover border border-[#333333]"
                        />
                        <div>
                          <h3 className="font-bold text-white text-sm flex items-center space-x-1.5">
                            <span>{student.name}</span>
                            <span className="w-2 h-2 rounded-full bg-[#CCFF00]" title="Actively Seeking" />
                          </h3>
                          <p className="text-[10px] font-mono text-[#888888]">
                            {student.program} {student.branch.split(' ')[0]} ({student.graduationYear})
                          </p>
                          <p className="text-[10px] font-mono text-[#CCFF00] truncate max-w-[180px]">
                            {student.institutionName}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-black bg-[#222222] text-[#CCFF00] border border-[#333333]">
                          {candidateFitScore}% MATCH
                        </span>
                        <span className="text-[10px] font-mono text-[#888888] block mt-0.5">CGPA {student.cgpa}</span>
                      </div>
                    </div>

                    {/* Verified Skills */}
                    <div className="mt-3.5">
                      <span className="text-[9px] font-mono font-bold text-[#888888] uppercase tracking-wider block mb-1.5">
                        Verified Skill Benchmarks
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {student.skills.map((sk, idx) => (
                          <span
                            key={idx}
                            className={`px-1.5 py-0.5 text-[10px] font-mono border ${
                              sk.badge === 'Gold'
                                ? 'bg-[#222222] text-[#CCFF00] border-[#CCFF00]/40'
                                : 'bg-[#181818] text-[#CCCCCC] border-[#333333]'
                            }`}
                          >
                            {sk.badge === 'Gold' ? '🏆 ' : '✓ '}
                            {sk.name} ({sk.score}%)
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* AI Alignment Rationale */}
                    <div className="mt-3 bg-[#181818] p-2.5 border border-[#282828] text-[11px] text-[#AAAAAA]">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[#CCFF00] block mb-0.5">
                        ✨ Fit Breakdown:
                      </span>
                      <p className="line-clamp-2 font-sans">{alignmentPoints[0]}</p>
                    </div>
                  </div>

                  {/* Actions / Stage */}
                  <div className="mt-4 pt-3 border-t border-[#222222] flex items-center justify-between">
                    <div>
                      {activeOpp ? (
                        <StageBadge stage={activeOpp.stage} />
                      ) : (
                        <span className="text-[10px] font-mono text-[#888888] uppercase">
                          {student.availability === 'actively_seeking' ? 'Ready for Call' : 'Open to offers'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedCandidateDetail({ student, candidateFitScore, matchedSkills, alignmentPoints, aiRecommendation, missingSkills: [] })}
                        className="px-2.5 py-1 text-xs font-mono font-bold uppercase text-[#CCCCCC] hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                      >
                        Passport
                      </button>

                      {activeOpp && activeOpp.stage === 'assessment_completed' && (
                        <button
                          onClick={() => advanceCandidateStage(activeOpp.id, 'shortlisted')}
                          className="px-2.5 py-1 text-xs font-mono font-bold uppercase bg-[#CCFF00] hover:bg-[#b8e600] text-black transition-all cursor-pointer"
                        >
                          Shortlist
                        </button>
                      )}

                      {activeOpp && activeOpp.stage === 'shortlisted' && (
                        <button
                          onClick={() => advanceCandidateStage(activeOpp.id, 'interviewing')}
                          className="px-2.5 py-1 text-xs font-mono font-bold uppercase bg-[#CCFF00] hover:bg-[#b8e600] text-black transition-all cursor-pointer"
                        >
                          Schedule Round
                        </button>
                      )}

                      {activeOpp && activeOpp.stage === 'interviewing' && (
                        <button
                          onClick={() => advanceCandidateStage(activeOpp.id, 'offered', { offerLetterUrl: 'https://example.com/offers/release.pdf' })}
                          className="px-2.5 py-1 text-xs font-mono font-bold uppercase bg-[#CCFF00] hover:bg-[#b8e600] text-black transition-all cursor-pointer"
                        >
                          Release Offer
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

      {/* TAB 4: INSTITUTIONAL REPUTATION MATRIX (Employer × Role × Institution) */}
      {activeTab === 'reputation_matrix' && (
        <div className="space-y-6">
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
              06 // EMPIRICAL REPUTATION MATRIX
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-white mt-1">Employer × Role × Institution Supply Performance Matrix</h2>
            <p className="text-xs text-[#888888] mt-1 max-w-3xl font-sans">
              Instead of generic static college rankings, NexusTalent tracks empirical role performance:
              <em className="text-[#CCFF00]"> "Institute C historically supplies stronger software engineering talent (24% offer rate, 95% joining), whereas College B excels in sales."</em>
            </p>
          </div>

          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#333333] bg-[#181818] text-[#888888] uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-3">Institution</th>
                    <th className="py-3 px-3">Role Domain</th>
                    <th className="py-3 px-3 text-center">Sample</th>
                    <th className="py-3 px-3 text-center">Applicants</th>
                    <th className="py-3 px-3 text-center">Offer Rate</th>
                    <th className="py-3 px-3 text-center">Joining Rate</th>
                    <th className="py-3 px-3 text-center">Skill Accuracy</th>
                    <th className="py-3 px-3">Notable Domain Strength</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222] text-[#F5F5F5]">
                  {reputationMatrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#181818] transition-colors">
                      <td className="py-3.5 px-3 font-bold text-white flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
                        <span>{row.institutionName}</span>
                      </td>
                      <td className="py-3.5 px-3 text-[#CCCCCC]">{row.roleCategory}</td>
                      <td className="py-3.5 px-3 text-center text-[#888888]">{row.eligibleSample}</td>
                      <td className="py-3.5 px-3 text-center text-white">{row.applicants}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold bg-[#222222] text-[#CCFF00] border border-[#333333]">
                          {row.offerRatePercent}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold bg-[#222222] text-white border border-[#333333]">
                          {row.joiningRatePercent}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-[#CCFF00]">
                        {row.skillAccuracyPercent}%
                      </td>
                      <td className="py-3.5 px-3 text-[#888888] text-[11px] max-w-sm font-sans">
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

      {/* TAB 5: TALENT MARKET SUPPLY GRAPH */}
      {activeTab === 'market_graph' && (
        <div className="space-y-6">
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                  07 // SUPPLY TOPOLOGY
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>Talent Market Supply Graph (Role: Software Engineer)</span>
                </h3>
                <p className="text-xs text-[#888888] mt-0.5 font-sans">
                  Hierarchical structure of available institutional supply across regions and batches
                </p>
              </div>
            </div>

            <div className="bg-[#0A0A0A] text-[#CCFF00] p-6 font-mono text-xs overflow-x-auto border border-[#222222] leading-relaxed">
              <div className="text-white font-bold text-sm mb-2 uppercase">Talent Market (Role: Graduate Software Engineer 2027)</div>
              <div className="text-[#888888]">India (Pan-National Supply Graph)</div>
              <div className="pl-4 text-[#444444]">│</div>
              {institutions.map((inst, idx) => {
                const totalHighMatch = inst.batches.reduce(
                  (acc, b) => acc + b.branches.reduce((bacc, br) => bacc + br.highMatchCount, 0),
                  0
                );
                const isLast = idx === institutions.length - 1;
                return (
                  <div key={inst.id} className="pl-4">
                    <div>{isLast ? '└── ' : '├── '} <strong className="text-white">{inst.name}</strong> <span className="text-[#888888]">({inst.city}, {inst.state})</span></div>
                    <div className="pl-8 text-[#888888]">
                      ├── Total 2027 Student Supply: <span className="text-white font-semibold">{inst.totalStudentSupply}</span>
                    </div>
                    <div className="pl-8 text-[#888888]">
                      ├── Verified Skill Assessment Ready: <span className="text-[#CCCCCC] font-semibold">{Math.round(inst.totalStudentSupply * 0.6)}</span>
                    </div>
                    <div className="pl-8 text-[#888888]">
                      └── High-Match Candidates: <span className="text-[#CCFF00] font-bold">{totalHighMatch} matches</span>
                    </div>
                    {!isLast && <div className="text-[#444444]">│</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Candidate Career Passport Detail Modal */}
      {selectedCandidateDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] max-w-2xl w-full border border-[#333333] overflow-hidden text-[#F5F5F5]">
            <div className="bg-[#181818] p-6 border-b border-[#333333] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={selectedCandidateDetail.student.avatar}
                  alt={selectedCandidateDetail.student.name}
                  className="w-12 h-12 object-cover border border-[#333333]"
                />
                <div>
                  <h3 className="font-bold text-lg text-white">{selectedCandidateDetail.student.name}</h3>
                  <p className="text-xs font-mono text-[#888888]">
                    {selectedCandidateDetail.student.program} {selectedCandidateDetail.student.branch} // {selectedCandidateDetail.student.institutionName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCandidateDetail(null)}
                className="text-[#888888] hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="flex items-center justify-between bg-[#181818] p-3 border border-[#333333]">
                <span className="font-mono font-bold uppercase text-[#888888]">Overall Match Fit Score</span>
                <span className="text-xl font-mono font-black text-[#CCFF00]">{selectedCandidateDetail.candidateFitScore}%</span>
              </div>

              <div>
                <h4 className="font-mono font-bold text-[#888888] uppercase tracking-wider mb-2">Verified Skill Passport</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedCandidateDetail.student.skills.map((sk, idx) => (
                    <div key={idx} className="p-2.5 border border-[#333333] bg-[#181818]">
                      <div className="flex justify-between font-mono font-bold text-white">
                        <span>{sk.name}</span>
                        <span className="text-[#CCFF00]">{sk.score}%</span>
                      </div>
                      <div className="text-[10px] font-mono text-[#888888] mt-1">
                        Verified by: {sk.verifiedBy} ({sk.badge} Badge)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-mono font-bold text-[#888888] uppercase tracking-wider mb-2">Key Projects & Evidence</h4>
                {selectedCandidateDetail.student.projects.map((proj) => (
                  <div key={proj.id} className="p-3 border border-[#333333] bg-[#181818] mb-2">
                    <div className="flex justify-between font-bold text-white">
                      <span>{proj.title}</span>
                      {proj.verifiedScore && <span className="font-mono text-[#CCFF00]">Score: {proj.verifiedScore}%</span>}
                    </div>
                    <p className="text-[#888888] mt-1 font-sans">{proj.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {proj.technologies.map((t, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-[#222222] font-mono text-white text-[10px] border border-[#333333]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#181818] border-t border-[#333333] flex justify-end">
              <button
                onClick={() => setSelectedCandidateDetail(null)}
                className="px-4 py-2 bg-[#CCFF00] text-black font-mono font-bold uppercase text-xs cursor-pointer"
              >
                Close Passport
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

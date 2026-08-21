import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import {
  Building2,
  Users,
  Inbox,
  Layers,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Award,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Plus,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  Megaphone,
} from 'lucide-react';
import { CallStatusBadge } from '../common/StatusBadge';
import { CallForTalent, CallStatus } from '../../types';

export const InstitutionPortal: React.FC = () => {
  const {
    currentInstitution,
    callsForTalent,
    students,
    campaigns,
    studentOpportunities,
    respondToCallForTalent,
    activateInstitutionStudents,
    publishInstitutionAvailability,
  } = useTalentNetwork();

  const [activeTab, setActiveTab] = useState<
    'inbox' | 'inventory' | 'campaign_ops' | 'publish_talent'
  >('inbox');

  // Call Response Modal State
  const [selectedCallToRespond, setSelectedCallToRespond] = useState<CallForTalent | null>(null);
  const [responseAction, setResponseAction] = useState<CallStatus>('accepted');
  const [responseNotes, setResponseNotes] = useState('');
  const [offeredCount, setOfferedCount] = useState<number>(200);
  const [counterDays, setCounterDays] = useState<number>(7);

  // Student Activation State for Campaign Ops
  const [selectedCallForActivation, setSelectedCallForActivation] = useState<string>('');
  const [selectedStudentIdsToActivate, setSelectedStudentIdsToActivate] = useState<string[]>([]);
  const [activationSuccessMessage, setActivationSuccessMessage] = useState<string | null>(null);

  // Publish Availability State
  const [pubBatchYear, setPubBatchYear] = useState<number>(2027);
  const [pubBranch, setPubBranch] = useState('Computer Science & Engineering');
  const [pubCount, setPubCount] = useState<number>(350);
  const [pubDesc, setPubDesc] = useState(
    '350 Verified placement-seeking students with top-percentile coding benchmarks in Python, SQL, and DSA ready for campus drives.'
  );
  const [pubSuccess, setPubSuccess] = useState(false);

  // Calls targeted for this institution
  const myCalls = callsForTalent.filter((c) => c.institutionId === currentInstitution.id);
  const pendingCalls = myCalls.filter((c) => c.status === 'pending');

  // Students belonging to this institution
  const myStudents = students.filter((s) => s.institutionId === currentInstitution.id);

  // Open Response Modal
  const handleOpenResponseModal = (call: CallForTalent, defaultStatus: CallStatus = 'accepted') => {
    setSelectedCallToRespond(call);
    setResponseAction(defaultStatus);
    setOfferedCount(call.vacanciesRequested * 2);
    if (defaultStatus === 'accepted') {
      setResponseNotes(`We can supply ${call.vacanciesRequested * 2} verified candidates from our 2027 batch with verified Python & SQL skills.`);
    } else if (defaultStatus === 'partial') {
      setResponseNotes(`We can supply ${Math.round(call.vacanciesRequested * 0.8)} verified candidates matching the role criteria.`);
    } else if (defaultStatus === 'counter') {
      setResponseNotes(`We can supply ${call.vacanciesRequested * 1.5} candidates, but request a 7-day extension for semester lab exams.`);
    } else {
      setResponseNotes(`Cannot participate due to conflicting university examinations.`);
    }
  };

  const handleConfirmResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCallToRespond) return;
    respondToCallForTalent(
      selectedCallToRespond.id,
      responseAction,
      responseNotes,
      offeredCount,
      responseAction === 'counter' ? counterDays : undefined
    );
    setSelectedCallToRespond(null);
  };

  const handleActivateStudents = () => {
    if (!selectedCallForActivation || selectedStudentIdsToActivate.length === 0) return;
    activateInstitutionStudents(selectedCallForActivation, selectedStudentIdsToActivate);
    setActivationSuccessMessage(
      `Activated and notified ${selectedStudentIdsToActivate.length} students with Consent Gateway!`
    );
    setSelectedStudentIdsToActivate([]);
    setTimeout(() => setActivationSuccessMessage(null), 5000);
  };

  const handlePublishAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    publishInstitutionAvailability(
      currentInstitution.id,
      pubBatchYear,
      pubBranch,
      pubCount,
      pubDesc
    );
    setPubSuccess(true);
    setTimeout(() => setPubSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-[#F5F5F5]">
      {/* Institution Banner & Supply Gateway Header */}
      <div className="bg-[#111111] p-6 border border-[#333333] shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-[#181818] border border-[#333333] flex items-center justify-center text-3xl">
              🏛️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black uppercase italic tracking-tight text-white">{currentInstitution.name}</h1>
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#222222] text-[#CCFF00] border border-[#333333]">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  SUPPLY GATEWAY
                </span>
              </div>
              <p className="text-xs font-mono text-[#888888] mt-1 flex items-center space-x-3">
                <span className="uppercase">{currentInstitution.type}</span>
                <span>//</span>
                <span>{currentInstitution.city}, {currentInstitution.state}</span>
                <span>//</span>
                <span>TPO: <strong className="text-white">{currentInstitution.placementOfficerName}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('publish_talent')}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs tracking-wider transition-all cursor-pointer"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>PUBLISH TALENT SUPPLY</span>
            </button>
          </div>
        </div>

        {/* Gateway Performance Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-[#222222] text-xs">
          <div className="bg-[#181818] p-3 border border-[#333333]">
            <span className="text-[10px] font-mono uppercase text-[#888888] block">Total 2027 Supply</span>
            <span className="text-xl font-mono font-black text-white">{currentInstitution.totalStudentSupply}</span>
          </div>
          <div className="bg-[#181818] p-3 border border-[#333333]">
            <span className="text-[10px] font-mono uppercase text-[#888888] block">Response Rate on Calls</span>
            <span className="text-xl font-mono font-black text-[#CCFF00]">{currentInstitution.responseRatePercent}%</span>
          </div>
          <div className="bg-[#181818] p-3 border border-[#333333]">
            <span className="text-[10px] font-mono uppercase text-[#888888] block">Historical Offer Rate</span>
            <span className="text-xl font-mono font-black text-white">{currentInstitution.historicalOfferRatePercent}%</span>
          </div>
          <div className="bg-[#181818] p-3 border border-[#333333]">
            <span className="text-[10px] font-mono uppercase text-[#888888] block">Offer-to-Joining Rate</span>
            <span className="text-xl font-mono font-black text-[#CCFF00]">{currentInstitution.historicalJoiningRatePercent}%</span>
          </div>
        </div>

        {/* Institution Tab Navigation */}
        <div className="mt-6 pt-4 border-t border-[#222222] flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'inbox'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>01 // TALENT CALLS INBOX</span>
            {pendingCalls.length > 0 && (
              <span className="px-1.5 py-0.2 bg-black text-[#CCFF00] font-bold text-[10px] ml-1">
                {pendingCalls.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'inventory'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>02 // STRUCTURED INVENTORY</span>
          </button>

          <button
            onClick={() => setActiveTab('campaign_ops')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'campaign_ops'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>03 // CAMPAIGN OPERATIONS</span>
          </button>

          <button
            onClick={() => setActiveTab('publish_talent')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'publish_talent'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>04 // PUBLISH SUPPLY</span>
          </button>
        </div>
      </div>

      {/* Activation Success Toast */}
      {activationSuccessMessage && (
        <div className="bg-[#181818] border-l-4 border-[#CCFF00] border-y border-r border-[#333333] text-white px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#CCFF00]" />
            <span>{activationSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActivationSuccessMessage(null)}
            className="text-[10px] font-mono uppercase text-[#888888] hover:text-white cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* TAB 1: CALLS FOR TALENT INBOX */}
      {activeTab === 'inbox' && (
        <div className="space-y-6">
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                  01 // DISPATCHED DEMANDS
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>Employer "Calls for Talent" Inbox</span>
                </h3>
                <p className="text-xs text-[#888888] mt-0.5 font-sans">
                  Employers anchor demand and issue formal calls. The institution reviews capacity and responds:
                  <strong className="text-white"> Accept, Partial, Counter, or Decline</strong>.
                </p>
              </div>
            </div>

            {myCalls.length === 0 ? (
              <div className="p-8 text-center bg-[#181818] border border-[#333333] text-[#888888] text-xs font-mono">
                No active Calls for Talent received yet. Switch to the Employer Portal to issue calls to this institution.
              </div>
            ) : (
              <div className="space-y-4">
                {myCalls.map((call) => {
                  const isPending = call.status === 'pending';
                  return (
                    <div
                      key={call.id}
                      className={`p-5 border transition-all ${
                        isPending
                          ? 'bg-[#181818] border-l-4 border-l-[#CCFF00] border-[#333333]'
                          : 'bg-[#141414] border-[#222222]'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-white uppercase text-base">{call.employerName}</span>
                            <CallStatusBadge status={call.status} />
                            <span className="text-[10px] font-mono text-[#666666]">
                              ISSUED {new Date(call.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-xs font-mono font-bold text-[#CCFF00] uppercase mt-1">{call.role}</h4>
                          <p className="text-xs font-mono text-[#888888] mt-1 flex flex-wrap items-center gap-3">
                            <span>VACANCIES ASKED: <strong className="text-white">{call.vacanciesRequested}</strong></span>
                            <span>//</span>
                            <span>PACKAGE: <strong className="text-[#CCFF00]">{call.salaryLPA}</strong></span>
                            <span>//</span>
                            <span>LOCATIONS: <strong className="text-white">{call.locations.join(', ')}</strong></span>
                            <span>//</span>
                            <span>JOINING: <strong className="text-white">{call.joiningWindow}</strong></span>
                          </p>
                        </div>

                        {/* Action Buttons for TPO */}
                        <div className="flex flex-wrap items-center gap-2">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleOpenResponseModal(call, 'accepted')}
                                className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-[#CCFF00] hover:bg-[#b8e600] text-black transition-all cursor-pointer"
                              >
                                Accept Call
                              </button>
                              <button
                                onClick={() => handleOpenResponseModal(call, 'partial')}
                                className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-[#222222] hover:bg-[#333333] text-white border border-[#444444] transition-all cursor-pointer"
                              >
                                Partial Supply
                              </button>
                              <button
                                onClick={() => handleOpenResponseModal(call, 'counter')}
                                className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-[#222222] hover:bg-[#333333] text-white border border-[#444444] transition-all cursor-pointer"
                              >
                                Counter Proposal
                              </button>
                              <button
                                onClick={() => handleOpenResponseModal(call, 'declined')}
                                className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-[#181818] hover:bg-rose-950 text-rose-400 border border-rose-900 transition-all cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenResponseModal(call, call.status)}
                              className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-[#181818] hover:bg-[#222222] text-[#CCCCCC] border border-[#333333] transition-all cursor-pointer"
                            >
                              Edit Response
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Response details if already answered */}
                      {call.responseNotes && (
                        <div className="mt-3 pt-3 border-t border-[#222222] text-xs font-mono text-[#888888] bg-[#0A0A0A] p-2.5 border border-[#222222]">
                          <span className="font-bold text-white">TPO Response Note: </span>
                          <span>{call.responseNotes}</span>
                          {call.offeredCandidatesCount && (
                            <span className="ml-2 font-bold text-[#CCFF00]">
                              (Offered Supply: {call.offeredCandidatesCount} students)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STRUCTURED TALENT INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                  02 // TALENT INVENTORY
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>Structured Talent Inventory (Supply Gateway)</span>
                </h3>
                <p className="text-xs text-[#888888] mt-0.5 font-sans">
                  The institution maintains a granular inventory:
                  <strong className="text-white"> Programs → Branches → Batches → Verified Skills → Assessments → Availability</strong>
                </p>
              </div>
            </div>

            {/* Inventory Hierarchy Visualizer */}
            <div className="space-y-6">
              {currentInstitution.batches.map((batch) => (
                <div key={batch.batchYear} className="border border-[#333333] p-5 bg-[#181818]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#282828] gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#CCFF00] uppercase tracking-wider">
                        {batch.program} // CLASS OF {batch.batchYear}
                      </span>
                      <h4 className="text-lg font-mono font-black text-white">TOTAL BATCH CAPACITY: {batch.totalStudents} STUDENTS</h4>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-mono">
                      <span className="px-2.5 py-1 bg-[#222222] text-white border border-[#333333]">
                        {batch.placementSeeking} Seeking Placement
                      </span>
                      <span className="px-2.5 py-1 bg-[#222222] text-[#CCFF00] border border-[#333333]">
                        {batch.verifiedCount} Verified Skills
                      </span>
                      <span className="px-2.5 py-1 bg-[#222222] text-white border border-[#333333]">
                        {batch.assessmentReady} Assessment Ready
                      </span>
                    </div>
                  </div>

                  {/* Branches Table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="text-[#888888] uppercase tracking-wider font-bold text-[10px] border-b border-[#282828]">
                          <th className="py-2.5 px-3">Branch / Specialization</th>
                          <th className="py-2.5 px-3 text-center">Total Students</th>
                          <th className="py-2.5 px-3 text-center">Placement Seeking</th>
                          <th className="py-2.5 px-3 text-center">Verified Skills</th>
                          <th className="py-2.5 px-3 text-center">Assessment Ready</th>
                          <th className="py-2.5 px-3 text-center">High Match Tier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222222] text-[#F5F5F5]">
                        {batch.branches.map((br, idx) => (
                          <tr key={idx} className="hover:bg-[#222222] transition-colors">
                            <td className="py-3 px-3 font-bold text-white flex items-center space-x-2">
                              <span className="w-2 h-2 bg-[#CCFF00]" />
                              <span>{br.branchName}</span>
                            </td>
                            <td className="py-3 px-3 text-center text-[#CCCCCC]">{br.totalStudents}</td>
                            <td className="py-3 px-3 text-center font-bold text-white">{br.placementSeeking}</td>
                            <td className="py-3 px-3 text-center font-bold text-[#CCFF00]">{br.verifiedCount}</td>
                            <td className="py-3 px-3 text-center font-bold text-white">{br.assessmentReady}</td>
                            <td className="py-3 px-3 text-center font-bold text-[#CCFF00]">
                              <span className="px-2 py-0.5 bg-[#222222] border border-[#333333]">
                                {br.highMatchCount} students
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PLACEMENT CAMPAIGN OPERATIONS & STUDENT ACTIVATION */}
      {activeTab === 'campaign_ops' && (
        <div className="space-y-6">
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                  03 // CAMPAIGN OPERATIONS
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>Campus Placement Campaign Operations</span>
                </h3>
                <p className="text-xs text-[#888888] mt-0.5 font-sans">
                  The institution runs placement operations without Excel sheets:
                  <strong className="text-white"> Employer Requirement → Eligibility Engine → Student Invitation → Consent Layer → Applications</strong>
                </p>
              </div>
            </div>

            {/* Campaign Pipeline Breakdown for Institution */}
            <div className="bg-[#181818] p-5 border border-[#333333] mb-6">
              <span className="text-[10px] font-mono font-bold text-[#CCFF00] uppercase tracking-wider block mb-2">
                ACTIVE CAMPAIGN OPERATOR: ABC TECHNOLOGIES (CORE SOFTWARE ENGINEER 2027)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-center text-xs font-mono">
                <div className="bg-[#111111] p-3 border border-[#282828]">
                  <span className="text-[9px] uppercase text-[#888888] block">Required</span>
                  <span className="text-base font-black text-white">500</span>
                </div>
                <div className="bg-[#111111] p-3 border border-[#282828]">
                  <span className="text-[9px] uppercase text-[#888888] block">College Eligible</span>
                  <span className="text-base font-black text-white">720</span>
                </div>
                <div className="bg-[#111111] p-3 border border-[#282828]">
                  <span className="text-[9px] uppercase text-[#888888] block">Invited Pool</span>
                  <span className="text-base font-black text-white">720</span>
                </div>
                <div className="bg-[#111111] p-3 border border-[#282828]">
                  <span className="text-[9px] uppercase text-[#888888] block">Consented</span>
                  <span className="text-base font-black text-[#CCFF00]">580</span>
                </div>
                <div className="bg-[#111111] p-3 border border-[#282828]">
                  <span className="text-[9px] uppercase text-[#888888] block">Assessed & Shortlisted</span>
                  <span className="text-base font-black text-white">180</span>
                </div>
                <div className="bg-[#222222] p-3 border border-[#CCFF00]">
                  <span className="text-[9px] uppercase font-bold text-[#CCFF00] block">Offers & Joined</span>
                  <span className="text-base font-black text-[#CCFF00]">48 Joined</span>
                </div>
              </div>
            </div>

            {/* Student Activation & Eligibility Engine */}
            <div className="border border-[#333333] p-5 bg-[#181818]">
              <h4 className="font-mono font-bold text-sm uppercase text-white mb-2 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#CCFF00]" />
                <span>Eligibility Engine: Activate & Invite Students with Consent Layer</span>
              </h4>
              <p className="text-xs text-[#888888] mb-4 font-sans">
                Institutional eligibility ≠ Student consent. The institution filters eligible candidates and dispatches opportunities. Each student retains control and explicitly opts in.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <select
                  value={selectedCallForActivation}
                  onChange={(e) => setSelectedCallForActivation(e.target.value)}
                  aria-label="Select Target Employer Call for Activation"
                  className="text-xs font-mono font-bold px-3 py-2 border border-[#333333] bg-[#111111] text-white focus:border-[#CCFF00] focus:outline-none"
                >
                  <option value="">-- SELECT TARGET EMPLOYER CALL --</option>
                  {myCalls.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.employerName} - {c.role} ({c.salaryLPA})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setSelectedStudentIdsToActivate(myStudents.map((s) => s.id));
                  }}
                  className="px-3 py-2 text-xs font-mono font-bold uppercase bg-[#222222] hover:bg-[#333333] text-white border border-[#333333] transition-colors cursor-pointer"
                >
                  SELECT ALL ({myStudents.length})
                </button>

                <button
                  onClick={handleActivateStudents}
                  disabled={!selectedCallForActivation || selectedStudentIdsToActivate.length === 0}
                  className="px-4 py-2 text-xs font-mono font-black uppercase bg-[#CCFF00] hover:bg-[#b8e600] disabled:opacity-50 text-black transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>DISPATCH STUDENT INVITATIONS ({selectedStudentIdsToActivate.length})</span>
                </button>
              </div>

              {/* Students List for Activation */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#333333] bg-[#111111] text-[#888888] uppercase font-bold text-[10px]">
                      <th className="py-2 px-3 w-10 text-center">Select</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Branch & CGPA</th>
                      <th className="py-2 px-3">Verified Skills</th>
                      <th className="py-2 px-3 text-center">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222] text-[#F5F5F5]">
                    {myStudents.map((stu) => {
                      const isChecked = selectedStudentIdsToActivate.includes(stu.id);
                      return (
                        <tr key={stu.id} className="hover:bg-[#222222]">
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedStudentIdsToActivate((prev) =>
                                   prev.includes(stu.id) ? prev.filter((id) => id !== stu.id) : [...prev, stu.id]
                                );
                              }}
                              className="cursor-pointer accent-[#CCFF00]"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white flex items-center space-x-2">
                            <img src={stu.avatar} alt={stu.name} className="w-6 h-6 object-cover border border-[#333333]" />
                            <span>{stu.name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-[#CCCCCC]">
                            {stu.branch} // CGPA <strong className="text-[#CCFF00]">{stu.cgpa}</strong>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {stu.skills.slice(0, 3).map((sk, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-[#111111] text-[#CCCCCC] text-[10px] border border-[#333333]">
                                  {sk.name} ({sk.score}%)
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-[#CCFF00]">
                            {stu.availability === 'actively_seeking' ? 'SEEKING' : 'OPEN'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PUBLISH TALENT AVAILABILITY (Two-Way Discovery) */}
      {activeTab === 'publish_talent' && (
        <div className="space-y-6">
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                  04 // MARKETPLACE BROADCAST
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>Two-Way Marketplace Discovery: Publish Talent Availability</span>
                </h3>
                <p className="text-xs text-[#888888] mt-0.5 font-sans">
                  Don't make recruitment completely employer-controlled. The institution can publish readiness:
                  <em className="text-[#CCFF00]"> "Our 2027 CSE batch has 750 placement-ready students."</em>
                </p>
              </div>
            </div>

            {pubSuccess && (
              <div className="mb-4 bg-[#181818] border-l-4 border-[#CCFF00] border-y border-r border-[#333333] text-white px-4 py-3 flex items-center space-x-2 text-xs font-mono font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#CCFF00]" />
                <span>TALENT AVAILABILITY BROADCASTED TO PAN-NATIONAL SUPPLY GRAPH</span>
              </div>
            )}

            <form onSubmit={handlePublishAvailability} className="space-y-4 max-w-2xl bg-[#181818] p-5 border border-[#333333]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#888888] mb-1">Graduation Batch</label>
                  <select
                    value={pubBatchYear}
                    onChange={(e) => setPubBatchYear(Number(e.target.value))}
                    aria-label="Graduation Batch"
                    className="w-full text-xs font-mono font-bold px-3 py-2 border border-[#333333] bg-[#111111] text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    <option value={2027}>Class of 2027 (Current Final Year)</option>
                    <option value={2026}>Class of 2026 (Immediate Joining)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#888888] mb-1">Branch / Discipline</label>
                  <select
                    value={pubBranch}
                    onChange={(e) => setPubBranch(e.target.value)}
                    aria-label="Branch / Discipline"
                    className="w-full text-xs font-mono font-bold px-3 py-2 border border-[#333333] bg-[#111111] text-white focus:border-[#CCFF00] focus:outline-none"
                  >
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="AI & Data Science">AI & Data Science</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#888888] mb-1">Placement-Ready Verified Students Count</label>
                <input
                  type="number"
                  min={10}
                  value={pubCount}
                  onChange={(e) => setPubCount(Number(e.target.value))}
                  className="w-full text-xs font-mono font-bold text-[#CCFF00] px-3 py-2 border border-[#333333] bg-[#111111] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#888888] mb-1">Availability Statement for Employers</label>
                <textarea
                  rows={3}
                  value={pubDesc}
                  onChange={(e) => setPubDesc(e.target.value)}
                  className="w-full text-xs font-sans text-white px-3 py-2 border border-[#333333] bg-[#111111] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs transition-all cursor-pointer"
                >
                  Broadcast Availability
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Response Modal to Handle "Call for Talent" */}
      {selectedCallToRespond && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] max-w-xl w-full border border-[#333333] overflow-hidden text-[#F5F5F5]">
            <div className="bg-[#181818] p-5 border-b border-[#333333] flex items-center justify-between">
              <div>
                <h3 className="font-black uppercase text-base text-white">Respond to Call for Talent</h3>
                <p className="text-xs font-mono text-[#888888]">
                  {selectedCallToRespond.employerName} // {selectedCallToRespond.role}
                </p>
              </div>
              <button
                onClick={() => setSelectedCallToRespond(null)}
                className="text-[#888888] hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmResponse} className="p-6 space-y-4 text-xs font-mono">
              <div className="bg-[#181818] p-3 border border-[#333333]">
                <span className="font-bold text-[#CCFF00] uppercase block">DEMAND REQUIREMENT:</span>
                <p className="text-[#CCCCCC] mt-0.5 font-sans">
                  Requesting <strong className="text-white">{selectedCallToRespond.vacanciesRequested} candidates</strong> at {selectedCallToRespond.salaryLPA} for {selectedCallToRespond.locations.join(', ')} ({selectedCallToRespond.joiningWindow}).
                </p>
              </div>

              {/* Response Mode Selector */}
              <div>
                <label className="block text-[10px] uppercase text-[#888888] mb-1.5">CHOOSE RESPONSE ACTION:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResponseAction('accepted');
                      setResponseNotes(`We can supply ${selectedCallToRespond.vacanciesRequested * 2} verified candidates with strong Python/SQL proficiency.`);
                    }}
                    className={`p-3 border text-left cursor-pointer ${
                      responseAction === 'accepted'
                        ? 'bg-[#222222] border-[#CCFF00] text-white'
                        : 'bg-[#181818] border-[#333333] text-[#888888]'
                    }`}
                  >
                    <div className="text-[#CCFF00] font-bold">✓ ACCEPT FULL SUPPLY</div>
                    <div className="text-[9px] text-[#888888] font-sans mt-0.5">Confirm full talent capacity</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResponseAction('partial');
                      setResponseNotes(`We can supply ${Math.round(selectedCallToRespond.vacanciesRequested * 0.8)} verified candidates.`);
                    }}
                    className={`p-3 border text-left cursor-pointer ${
                      responseAction === 'partial'
                        ? 'bg-[#222222] border-[#CCFF00] text-white'
                        : 'bg-[#181818] border-[#333333] text-[#888888]'
                    }`}
                  >
                    <div className="text-white font-bold">⚖️ PARTIAL SUPPLY</div>
                    <div className="text-[9px] text-[#888888] font-sans mt-0.5">Offer subset of students</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResponseAction('counter');
                      setResponseNotes(`We can supply 150 candidates, but request 7-day extension for semester exams.`);
                    }}
                    className={`p-3 border text-left cursor-pointer ${
                      responseAction === 'counter'
                        ? 'bg-[#222222] border-[#CCFF00] text-white'
                        : 'bg-[#181818] border-[#333333] text-[#888888]'
                    }`}
                  >
                    <div className="text-white font-bold">⏳ COUNTER PROPOSAL</div>
                    <div className="text-[9px] text-[#888888] font-sans mt-0.5">Request schedule adjustment</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResponseAction('declined');
                      setResponseNotes(`Cannot participate due to university exam conflicts.`);
                    }}
                    className={`p-3 border text-left cursor-pointer ${
                      responseAction === 'declined'
                        ? 'bg-[#222222] border-rose-500 text-rose-400'
                        : 'bg-[#181818] border-[#333333] text-[#888888]'
                    }`}
                  >
                    <div className="text-rose-400 font-bold">✕ DECLINE CALL</div>
                    <div className="text-[9px] text-[#888888] font-sans mt-0.5">Cannot participate</div>
                  </button>
                </div>
              </div>

              {responseAction !== 'declined' && (
                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">TOTAL VERIFIED CANDIDATES OFFERED</label>
                  <input
                    type="number"
                    min={1}
                    value={offeredCount}
                    onChange={(e) => setOfferedCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#333333] bg-[#181818] font-bold text-white focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              )}

              {responseAction === 'counter' && (
                <div>
                  <label className="block text-[10px] uppercase text-[#888888] mb-1">DAYS EXTENSION REQUESTED</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={counterDays}
                    onChange={(e) => setCounterDays(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#333333] bg-[#181818] font-bold text-[#CCFF00] focus:border-[#CCFF00] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase text-[#888888] mb-1">TPO RESPONSE STATEMENT / NOTES</label>
                <textarea
                  rows={2}
                  required
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#333333] bg-[#181818] text-white focus:border-[#CCFF00] focus:outline-none font-sans"
                />
              </div>

              <div className="pt-3 border-t border-[#333333] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedCallToRespond(null)}
                  className="px-3 py-1.5 text-[#888888] hover:text-white uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs cursor-pointer"
                >
                  Submit Official Response
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

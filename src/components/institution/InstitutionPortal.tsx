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
  Download,
  Copy,
  FileSpreadsheet,
  Sliders,
  Lock,
  Unlock,
  BookOpen,
} from 'lucide-react';
import { CallStatusBadge } from '../common/StatusBadge';
import { CallForTalent, CallStatus, PlacementPolicyConfig } from '../../types';

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
    updateStudentInstitutionVerification,
  } = useTalentNetwork();

  const [activeTab, setActiveTab] = useState<
    'inbox' | 'student_verification' | 'inventory' | 'campaign_ops' | 'publish_talent' | 'placement_policy' | 'accreditation_report'
  >('inbox');

  // "One Student, One Job" Policy & Tier Configuration State
  const [placementPolicy, setPlacementPolicy] = useState<PlacementPolicyConfig>({
    oneStudentOneJobEnabled: true,
    regularTierMaxLPA: 8.0,
    dreamTierMinLPA: 8.0,
    superDreamTierMinLPA: 15.0,
    allowDreamUpgrades: true,
  });
  const [policySavedToast, setPolicySavedToast] = useState<string | null>(null);

  // NIRF / NAAC Accreditation Report State
  const [accreditationYear, setAccreditationYear] = useState('2025-2026');
  const [reportCopied, setReportCopied] = useState(false);

  // Student Verification State
  const [studentVerificationFilter, setStudentVerificationFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

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
  const [pubBranch, setPubBranch] = useState('Commerce & Financial Studies');
  const [pubCount, setPubCount] = useState<number>(350);
  const [pubDesc, setPubDesc] = useState(
    '350 Verified placement-seeking students with top-percentile domain benchmarks, certified projects, and high academic rigor ready for campus drives.'
  );
  const [pubSuccess, setPubSuccess] = useState(false);

  // Calls targeted for this institution
  const myCalls = callsForTalent.filter((c) => c.institutionId === currentInstitution.id);
  const pendingCalls = myCalls.filter((c) => c.status === 'pending');

  // Students belonging to this institution
  const myStudents = students.filter((s) => s.institutionId === currentInstitution.id);
  const pendingCampusStudents = myStudents.filter((s) => s.institutionVerificationStatus === 'pending');

  const filteredMyStudents = myStudents.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
      s.branch.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
      (s.rollNumber || '').toLowerCase().includes(studentSearchTerm.toLowerCase());

    if (studentVerificationFilter === 'pending') return matchesSearch && s.institutionVerificationStatus === 'pending';
    if (studentVerificationFilter === 'verified') return matchesSearch && s.institutionVerificationStatus === 'verified';
    if (studentVerificationFilter === 'rejected') return matchesSearch && s.institutionVerificationStatus === 'rejected';
    return matchesSearch;
  });

  const handleVerifyStudent = (studentId: string, status: 'verified' | 'rejected', notes?: string) => {
    const defaultNote = status === 'verified' 
      ? `Verified by TPO Office (${currentInstitution.placementOfficerName}) on ${new Date().toISOString().split('T')[0]}`
      : `Flagged for academic record correction by TPO Office on ${new Date().toISOString().split('T')[0]}`;
    
    updateStudentInstitutionVerification(studentId, status, notes || verificationRemarks || defaultNote);
    setVerificationFeedback(`Student verification updated to "${status.toUpperCase()}".`);
    setVerificationRemarks('');
    setTimeout(() => setVerificationFeedback(null), 4000);
  };

  const handleBatchVerifyAllPending = () => {
    if (pendingCampusStudents.length === 0) return;
    const note = `Batch verification certified by TPO Office (${currentInstitution.placementOfficerName}) on ${new Date().toISOString().split('T')[0]}`;
    pendingCampusStudents.forEach((stu) => {
      updateStudentInstitutionVerification(stu.id, 'verified', note);
    });
    setVerificationFeedback(`Successfully verified ${pendingCampusStudents.length} students in batch!`);
    setTimeout(() => setVerificationFeedback(null), 4000);
  };

  // Open Response Modal
  const handleOpenResponseModal = (call: CallForTalent, defaultStatus: CallStatus = 'accepted') => {
    setSelectedCallToRespond(call);
    setResponseAction(defaultStatus);
    setOfferedCount(call.vacanciesRequested * 2);
    if (defaultStatus === 'accepted') {
      setResponseNotes(`We can supply ${call.vacanciesRequested * 2} verified candidates from our 2027 batch with verified domain skill benchmarks.`);
    } else if (defaultStatus === 'partial') {
      setResponseNotes(`We can supply ${Math.round(call.vacanciesRequested * 0.8)} verified candidates matching the role criteria.`);
    } else if (defaultStatus === 'counter') {
      setResponseNotes(`We can supply ${call.vacanciesRequested * 1.5} candidates, but request a 7-day extension for semester examination schedules.`);
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
      `Invited ${selectedStudentIdsToActivate.length} students. They can now review and choose to apply!`
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
    <div className="space-y-6 pb-12 font-sans text-slate-900">
      {/* Institution Banner */}
      <div className="bg-white p-6 border border-slate-300 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white border border-slate-300 flex items-center justify-center text-3xl">
              🏛️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">{currentInstitution.name}</h1>
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-100 text-indigo-600 border border-slate-300">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  COLLEGE PLACEMENT CELL
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 mt-1 flex items-center space-x-3">
                <span className="uppercase">{currentInstitution.type}</span>
                <span>//</span>
                <span>{currentInstitution.city}, {currentInstitution.state}</span>
                <span>//</span>
                <span>Placement Officer: <strong className="text-slate-900">{currentInstitution.placementOfficerName}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('publish_talent')}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs tracking-wider transition-all cursor-pointer"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>POST AVAILABLE BATCH</span>
            </button>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-200 text-xs">
          <div className="bg-white p-3 border border-slate-300">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Total Graduating Class</span>
            <span className="text-xl font-mono font-black text-slate-900">{currentInstitution.totalStudentSupply}</span>
          </div>
          <div className="bg-white p-3 border border-slate-300">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Drive Response Rate</span>
            <span className="text-xl font-mono font-black text-indigo-600">{currentInstitution.responseRatePercent}%</span>
          </div>
          <div className="bg-white p-3 border border-slate-300">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Offer Rate</span>
            <span className="text-xl font-mono font-black text-slate-900">{currentInstitution.historicalOfferRatePercent}%</span>
          </div>
          <div className="bg-white p-3 border border-slate-300">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Offer-to-Join Rate</span>
            <span className="text-xl font-mono font-black text-indigo-600">{currentInstitution.historicalJoiningRatePercent}%</span>
          </div>
        </div>

        {/* Institution Tab Navigation */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'inbox'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>COMPANY INVITATIONS</span>
            {pendingCalls.length > 0 && (
              <span className="px-1.5 py-0.2 bg-black text-indigo-600 font-bold text-[10px] ml-1">
                {pendingCalls.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('student_verification')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'student_verification'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>STUDENT VERIFICATION</span>
            {pendingCampusStudents.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-400 text-white font-bold text-[10px] ml-1">
                {pendingCampusStudents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'inventory'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>STUDENT DIRECTORY</span>
          </button>

          <button
            onClick={() => setActiveTab('campaign_ops')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'campaign_ops'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>PLACEMENT DRIVES</span>
          </button>

          <button
            onClick={() => setActiveTab('publish_talent')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'publish_talent'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>POST AVAILABILITY</span>
          </button>

          <button
            onClick={() => setActiveTab('placement_policy')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'placement_policy'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>1-STUDENT-1-JOB POLICY</span>
          </button>

          <button
            onClick={() => setActiveTab('accreditation_report')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'accreditation_report'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>NIRF / NAAC ACCREDITATION REPORT</span>
          </button>
        </div>
      </div>

      {/* Verification Feedback Banner */}
      {verificationFeedback && (
        <div className="bg-white border-l-4 border-indigo-600 border-y border-r border-slate-300 text-slate-900 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>{verificationFeedback}</span>
          </div>
          <button
            onClick={() => setVerificationFeedback(null)}
            className="text-[10px] font-mono uppercase text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Activation Success Toast */}
      {activationSuccessMessage && (
        <div className="bg-white border-l-4 border-indigo-600 border-y border-r border-slate-300 text-slate-900 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>{activationSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActivationSuccessMessage(null)}
            className="text-[10px] font-mono uppercase text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* TAB 1: COMPANY INVITATIONS */}
      {activeTab === 'inbox' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                  INCOMING REQUESTS
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <span>Employer Hiring Invitations</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Companies send hiring drive invitations to your campus. Review requirements and choose to:
                  <strong className="text-slate-900"> Accept, Offer Partial Batch, Propose Dates, or Decline</strong>.
                </p>
              </div>
            </div>

            {myCalls.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-300 text-slate-500 text-xs font-mono">
                No active hiring invitations received yet. Switch to the Employer view to send an invitation to this college.
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
                          ? 'bg-white border-l-4 border-l-indigo-600 border-slate-300'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-slate-900 uppercase text-base">{call.employerName}</span>
                            <CallStatusBadge status={call.status} />
                            <span className="text-[10px] font-mono text-slate-500">
                              RECEIVED {new Date(call.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-xs font-mono font-bold text-indigo-600 uppercase mt-1">{call.role}</h4>
                          <p className="text-xs font-mono text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                            <span>OPENINGS: <strong className="text-slate-900">{call.vacanciesRequested}</strong></span>
                            <span>//</span>
                            <span>SALARY: <strong className="text-indigo-600">{call.salaryLPA}</strong></span>
                            <span>//</span>
                            <span>LOCATIONS: <strong className="text-slate-900">{call.locations.join(', ')}</strong></span>
                            <span>//</span>
                            <span>JOINING: <strong className="text-slate-900">{call.joiningWindow}</strong></span>
                          </p>
                        </div>

                        {/* Action Buttons for TPO */}
                        <div className="flex flex-wrap items-center gap-2">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleOpenResponseModal(call, 'accepted')}
                                className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleOpenResponseModal(call, 'partial')}
                                className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 transition-all cursor-pointer"
                              >
                                Partial Batch
                              </button>
                              <button
                                onClick={() => handleOpenResponseModal(call, 'counter')}
                                className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 transition-all cursor-pointer"
                              >
                                Request New Dates
                              </button>
                              <button
                                onClick={() => handleOpenResponseModal(call, 'declined')}
                                className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white hover:bg-rose-950 text-rose-400 border border-rose-900 transition-all cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenResponseModal(call, call.status)}
                              className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 transition-all cursor-pointer"
                            >
                              Update Response
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Response details if already answered */}
                      {call.responseNotes && (
                        <div className="mt-3 pt-3 border-t border-slate-200 text-xs font-mono text-slate-500 bg-slate-50 p-2.5 border border-slate-200">
                          <span className="font-bold text-slate-900">Placement Cell Note: </span>
                          <span>{call.responseNotes}</span>
                          {call.offeredCandidatesCount && (
                            <span className="ml-2 font-bold text-indigo-600">
                              (Offered: {call.offeredCandidatesCount} students)
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

      {/* TAB 2: CAMPUS STUDENT VERIFICATION QUEUE */}
      {activeTab === 'student_verification' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600 font-bold">
                  ACADEMIC AUTHENTICATION & ATTESTATION
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>Campus Student Verification & Validation Queue</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  The Placement Cell / TPO Office must formally verify student identity, semester transcripts, CGPA, and department credentials before releasing profiles to corporate campus drives.
                </p>
              </div>

              {pendingCampusStudents.length > 0 && (
                <button
                  onClick={handleBatchVerifyAllPending}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>BATCH VERIFY ALL PENDING ({pendingCampusStudents.length})</span>
                </button>
              )}
            </div>

            {/* Filter and Search Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-5 p-3 bg-white border border-slate-200">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  placeholder="Search students by name, roll number, or department..."
                  className="w-full bg-white text-xs font-mono text-slate-900 px-3 py-2 border border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-slate-500">Filter Status:</span>
                <select
                  value={studentVerificationFilter}
                  onChange={(e) => setStudentVerificationFilter(e.target.value as any)}
                  className="bg-white text-xs font-mono text-slate-900 px-3 py-2 border border-slate-300 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="all">All Campus Students ({myStudents.length})</option>
                  <option value="pending">Pending Verification ({pendingCampusStudents.length})</option>
                  <option value="verified">Campus Verified Only</option>
                  <option value="rejected">Flagged / Needs Review</option>
                </select>
              </div>
            </div>

            {/* Students Verification Table */}
            {filteredMyStudents.length === 0 ? (
              <div className="p-8 text-center bg-white border border-dashed border-slate-300 text-slate-500 text-xs font-mono">
                No students match the current filter query.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMyStudents.map((stu) => {
                  const isVerified = stu.institutionVerificationStatus === 'verified';
                  const isPending = stu.institutionVerificationStatus === 'pending' || !stu.institutionVerificationStatus;
                  const isRejected = stu.institutionVerificationStatus === 'rejected';

                  return (
                    <div
                      key={stu.id}
                      className={`p-4 border transition-all ${
                        isPending
                          ? 'bg-white border-l-4 border-l-amber-400 border-slate-300'
                          : isVerified
                          ? 'bg-slate-50 border-l-4 border-l-emerald-500 border-slate-200'
                          : 'bg-slate-50 border-l-4 border-l-rose-500 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 font-mono text-xs">
                        <div className="flex items-start gap-3">
                          <img
                            src={stu.avatar}
                            alt={stu.name}
                            className="w-12 h-12 object-cover border border-slate-300 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{stu.name}</span>
                              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                                isVerified
                                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                                  : isRejected
                                  ? 'bg-rose-950/80 border-rose-800 text-rose-400'
                                  : 'bg-amber-950/80 border-amber-800 text-amber-300'
                              }`}>
                                {isVerified ? '✓ CAMPUS VERIFIED' : isRejected ? '✗ FLAGGED' : '⏳ PENDING CAMPUS VERIFICATION'}
                              </span>
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              Roll No: <strong className="text-indigo-600">{stu.rollNumber || 'STU-REG-2027'}</strong> • {stu.program} ({stu.branch}) • Class of {stu.graduationYear}
                            </div>
                            <div className="text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                              <span>Academic CGPA: <strong className="text-slate-900">{stu.cgpa} / 10.0</strong></span>
                              <span>•</span>
                              <span>Proctored Skills: <strong className="text-slate-900">{stu.skills.map(s => s.name).join(', ') || 'Domain Fundamentals'}</strong></span>
                            </div>
                            {stu.verificationNotes && (
                              <div className="text-[11px] text-slate-500 mt-1 italic">
                                Verification Note: {stu.verificationNotes}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons for TPO */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleVerifyStudent(stu.id, 'verified')}
                                className="px-3.5 py-1.5 text-xs font-mono font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verify & Approve</span>
                              </button>
                              <button
                                onClick={() => handleVerifyStudent(stu.id, 'rejected')}
                                className="px-3.5 py-1.5 text-xs font-mono font-bold uppercase bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Flag / Reject</span>
                              </button>
                            </>
                          ) : isVerified ? (
                            <button
                              onClick={() => handleVerifyStudent(stu.id, 'rejected')}
                              className="px-3 py-1.5 text-xs font-mono uppercase bg-white hover:bg-slate-200 text-slate-500 border border-slate-300 transition-all cursor-pointer"
                            >
                              Re-evaluate Status
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVerifyStudent(stu.id, 'verified')}
                              className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                            >
                              Clear Flags & Verify
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT DIRECTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                  STUDENT OVERVIEW
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <span>Student Directory by Degree & Department</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Browse your college's student batches, verified test scores, and job readiness.
                </p>
              </div>
            </div>

            {/* Inventory Hierarchy Visualizer */}
            <div className="space-y-6">
              {currentInstitution.batches.map((batch) => (
                <div key={batch.batchYear} className="border border-slate-300 p-5 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
                        {batch.program} // CLASS OF {batch.batchYear}
                      </span>
                      <h4 className="text-lg font-mono font-black text-slate-900">TOTAL BATCH: {batch.totalStudents} STUDENTS</h4>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-mono">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-900 border border-slate-300">
                        {batch.placementSeeking} Looking for Jobs
                      </span>
                      <span className="px-2.5 py-1 bg-slate-100 text-indigo-600 border border-slate-300">
                        {batch.verifiedCount} Skills Verified
                      </span>
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-900 border border-slate-300">
                        {batch.assessmentReady} Test Ready
                      </span>
                    </div>
                  </div>

                  {/* Branches Table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-200">
                          <th className="py-2.5 px-3">Department / Branch</th>
                          <th className="py-2.5 px-3 text-center">Total Students</th>
                          <th className="py-2.5 px-3 text-center">Looking for Jobs</th>
                          <th className="py-2.5 px-3 text-center">Skills Verified</th>
                          <th className="py-2.5 px-3 text-center">Test Ready</th>
                          <th className="py-2.5 px-3 text-center">Top Candidates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-900">
                        {batch.branches.map((br, idx) => (
                          <tr key={idx} className="hover:bg-slate-100 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-900 flex items-center space-x-2">
                              <span className="w-2 h-2 bg-indigo-600" />
                              <span>{br.branchName}</span>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-600">{br.totalStudents}</td>
                            <td className="py-3 px-3 text-center font-bold text-slate-900">{br.placementSeeking}</td>
                            <td className="py-3 px-3 text-center font-bold text-indigo-600">{br.verifiedCount}</td>
                            <td className="py-3 px-3 text-center font-bold text-slate-900">{br.assessmentReady}</td>
                            <td className="py-3 px-3 text-center font-bold text-indigo-600">
                              <span className="px-2 py-0.5 bg-slate-100 border border-slate-300">
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

      {/* TAB 3: PLACEMENT DRIVES */}
      {activeTab === 'campaign_ops' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                  PLACEMENT DRIVE DASHBOARD
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <span>Manage Campus Placement Drives</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Manage the full drive lifecycle:
                  <strong className="text-slate-900"> Company Requirements → Select Students → Send Invitations → Student Consent → Applications & Offers</strong>
                </p>
              </div>
            </div>

            {/* Campaign Pipeline Breakdown for Institution */}
            <div className="bg-white p-5 border border-slate-300 mb-6">
              <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block mb-2">
                ACTIVE DRIVE: ABC TECHNOLOGIES (SOFTWARE ENGINEER 2027)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-center text-xs font-mono">
                <div className="bg-white p-3 border border-slate-200">
                  <span className="text-[9px] uppercase text-slate-500 block">Openings</span>
                  <span className="text-base font-black text-slate-900">500</span>
                </div>
                <div className="bg-white p-3 border border-slate-200">
                  <span className="text-[9px] uppercase text-slate-500 block">Eligible</span>
                  <span className="text-base font-black text-slate-900">720</span>
                </div>
                <div className="bg-white p-3 border border-slate-200">
                  <span className="text-[9px] uppercase text-slate-500 block">Invited</span>
                  <span className="text-base font-black text-slate-900">720</span>
                </div>
                <div className="bg-white p-3 border border-slate-200">
                  <span className="text-[9px] uppercase text-slate-500 block">Applied</span>
                  <span className="text-base font-black text-indigo-600">580</span>
                </div>
                <div className="bg-white p-3 border border-slate-200">
                  <span className="text-[9px] uppercase text-slate-500 block">Shortlisted</span>
                  <span className="text-base font-black text-slate-900">180</span>
                </div>
                <div className="bg-slate-100 p-3 border border-indigo-600">
                  <span className="text-[9px] uppercase font-bold text-indigo-600 block">Offers Accepted</span>
                  <span className="text-base font-black text-indigo-600">48 Joined</span>
                </div>
              </div>
            </div>

            {/* Student Activation & Eligibility Engine */}
            <div className="border border-slate-300 p-5 bg-white">
              <h4 className="font-mono font-bold text-sm uppercase text-slate-900 mb-2 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Invite Eligible Students to Apply</span>
              </h4>
              <p className="text-xs text-slate-500 mb-4 font-sans">
                Select eligible students to send them this job opportunity. Each student will receive an invitation in their portal to review and accept.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <select
                  value={selectedCallForActivation}
                  onChange={(e) => setSelectedCallForActivation(e.target.value)}
                  aria-label="Select Target Company Invitation"
                  className="text-xs font-mono font-bold px-3 py-2 border border-slate-300 bg-white text-slate-900 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">-- SELECT COMPANY INVITATION --</option>
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
                  className="px-3 py-2 text-xs font-mono font-bold uppercase bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 transition-colors cursor-pointer"
                >
                  SELECT ALL ({myStudents.length})
                </button>

                <button
                  onClick={handleActivateStudents}
                  disabled={!selectedCallForActivation || selectedStudentIdsToActivate.length === 0}
                  className="px-4 py-2 text-xs font-mono font-black uppercase bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>INVITE STUDENTS ({selectedStudentIdsToActivate.length})</span>
                </button>
              </div>

              {/* Students List for Activation */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-300 bg-white text-slate-500 uppercase font-bold text-[10px]">
                      <th className="py-2 px-3 w-10 text-center">Select</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Branch & CGPA</th>
                      <th className="py-2 px-3">Verified Skills</th>
                      <th className="py-2 px-3 text-center">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-900">
                    {myStudents.map((stu) => {
                      const isChecked = selectedStudentIdsToActivate.includes(stu.id);
                      return (
                        <tr key={stu.id} className="hover:bg-slate-100">
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedStudentIdsToActivate((prev) =>
                                   prev.includes(stu.id) ? prev.filter((id) => id !== stu.id) : [...prev, stu.id]
                                );
                              }}
                              className="cursor-pointer accent-indigo-600"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center space-x-2">
                            <img src={stu.avatar} alt={stu.name} className="w-6 h-6 object-cover border border-slate-300" />
                            <span>{stu.name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {stu.branch} // CGPA <strong className="text-indigo-600">{stu.cgpa}</strong>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {stu.skills.slice(0, 3).map((sk, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-white text-slate-600 text-[10px] border border-slate-300">
                                  {sk.name} ({sk.score}%)
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-indigo-600">
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

      {/* TAB 4: POST TALENT AVAILABILITY */}
      {activeTab === 'publish_talent' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600">
                  COLLEGE PROMOTION
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <span>Post Available Graduating Batches to Employers</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Let visiting companies know about upcoming graduating batches ready for placements and campus hiring.
                </p>
              </div>
            </div>

            {pubSuccess && (
              <div className="mb-4 bg-white border-l-4 border-indigo-600 border-y border-r border-slate-300 text-slate-900 px-4 py-3 flex items-center space-x-2 text-xs font-mono font-bold">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>BATCH AVAILABILITY POSTED TO EMPLOYERS SUCCESSFULLY</span>
              </div>
            )}

            <form onSubmit={handlePublishAvailability} className="space-y-4 max-w-2xl bg-white p-5 border border-slate-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Graduation Year</label>
                  <select
                    value={pubBatchYear}
                    onChange={(e) => setPubBatchYear(Number(e.target.value))}
                    aria-label="Graduation Batch"
                    className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 bg-white text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value={2027}>Class of 2027 (Final Year)</option>
                    <option value={2026}>Class of 2026 (Immediate Joining)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Department / Branch</label>
                  <select
                    value={pubBranch}
                    onChange={(e) => setPubBranch(e.target.value)}
                    aria-label="Branch / Discipline"
                    className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 bg-white text-slate-900 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="AI & Data Science">AI & Data Science</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Available Students Count</label>
                <input
                  type="number"
                  min={10}
                  value={pubCount}
                  onChange={(e) => setPubCount(Number(e.target.value))}
                  className="w-full text-xs font-mono font-bold text-indigo-600 px-3 py-2 border border-slate-300 bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Summary for Employers</label>
                <textarea
                  rows={3}
                  value={pubDesc}
                  onChange={(e) => setPubDesc(e.target.value)}
                  className="w-full text-xs font-sans text-slate-900 px-3 py-2 border border-slate-300 bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs transition-all cursor-pointer"
                >
                  Post to Employers
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: ONE STUDENT ONE JOB POLICY & TIER UPGRADE ENGINE */}
      {activeTab === 'placement_policy' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600 flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>INSTITUTIONAL PLACEMENT GOVERNANCE</span>
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 mt-1">
                  "One Student, One Job" Policy & Tier Rules
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-3xl font-sans">
                  Prevent offer hoarding and candidate reneges by locking student applications once an offer is accepted, while allowing upward mobility for Dream and Super Dream compensation tiers.
                </p>
              </div>

              {policySavedToast && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-mono font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{policySavedToast}</span>
                </div>
              )}
            </div>

            {/* Policy Configuration Controls */}
            <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Policy Toggle */}
              <div className="p-5 border border-slate-300 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 uppercase">Policy Enforcement</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPlacementPolicy((prev) => ({
                        ...prev,
                        oneStudentOneJobEnabled: !prev.oneStudentOneJobEnabled,
                      }));
                      setPolicySavedToast("Policy status updated!");
                      setTimeout(() => setPolicySavedToast(null), 3000);
                    }}
                    className={`px-3 py-1 font-mono text-xs font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                      placementPolicy.oneStudentOneJobEnabled
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    {placementPolicy.oneStudentOneJobEnabled ? 'ACTIVE (ENFORCED)' : 'DISABLED'}
                  </button>
                </div>
                <p className="text-xs text-slate-600 font-sans leading-relaxed">
                  When active, students holding a verified offer cannot apply for conflicting company drives within the same or lower salary tier.
                </p>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600">Dream Tier Upgrades:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPlacementPolicy((prev) => ({
                        ...prev,
                        allowDreamUpgrades: !prev.allowDreamUpgrades,
                      }))
                    }
                    className={`px-2.5 py-0.5 text-[10px] font-bold uppercase border cursor-pointer ${
                      placementPolicy.allowDreamUpgrades
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-200 text-slate-600 border-slate-300'
                    }`}
                  >
                    {placementPolicy.allowDreamUpgrades ? 'ALLOWED' : 'BLOCKED'}
                  </button>
                </div>
              </div>

              {/* Tier Threshold Inputs */}
              <div className="lg:col-span-2 p-5 border border-slate-300 bg-white space-y-4">
                <h4 className="font-mono text-xs font-bold uppercase text-slate-900">
                  Compensation Tier Thresholds (LPA)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">
                      1. Regular Placement Tier
                    </span>
                    <div className="text-base font-black text-slate-900 mb-1">
                      &lt; ₹{placementPolicy.regularTierMaxLPA} LPA
                    </div>
                    <p className="text-[10px] text-slate-500 font-sans">
                      Core campus recruitments and standard intake packages.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-indigo-200">
                    <span className="text-[10px] uppercase text-indigo-600 font-bold block mb-1">
                      2. Dream Company Tier
                    </span>
                    <div className="text-base font-black text-indigo-600 mb-1">
                      ₹{placementPolicy.dreamTierMinLPA} - {placementPolicy.superDreamTierMinLPA} LPA
                    </div>
                    <p className="text-[10px] text-slate-500 font-sans">
                      High-growth tech, corporate consulting, and premium salaries.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-amber-200">
                    <span className="text-[10px] uppercase text-amber-600 font-bold block mb-1">
                      3. Super Dream Tier
                    </span>
                    <div className="text-base font-black text-amber-600 mb-1">
                      &gt; ₹{placementPolicy.superDreamTierMinLPA} LPA
                    </div>
                    <p className="text-[10px] text-slate-500 font-sans">
                      Global product firms, Tier-1 quantitative & AI researchers.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setPolicySavedToast("Policy tier configuration saved and synced across campus drives!");
                      setTimeout(() => setPolicySavedToast(null), 3500);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold uppercase text-xs transition-colors cursor-pointer"
                  >
                    Save Tier Settings
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Student Compliance & Tier Audit Table */}
          <div className="bg-white p-6 border border-slate-300 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black uppercase text-slate-900 font-mono">
                  Student Placement Compliance & Drive Eligibility
                </h3>
                <p className="text-xs text-slate-500 font-sans">
                  Real-time status of students and their automated drive permissions under the "One Student, One Job" rules.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                ENROLLED COHORT: <strong className="text-slate-900">{myStudents.length} Students</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3">Branch & Roll No</th>
                    <th className="py-3 px-3 text-center">CGPA</th>
                    <th className="py-3 px-3">Current Offer Status</th>
                    <th className="py-3 px-3">Package (CTC)</th>
                    <th className="py-3 px-3 text-right">Policy Drive Permission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {myStudents.map((stu) => {
                    const studentOpps = studentOpportunities.filter(o => o.studentId === stu.id);
                    const acceptedOpp = studentOpps.find(o => o.stage === 'accepted' || o.stage === 'joined');
                    const offeredOpp = studentOpps.find(o => o.stage === 'offered');
                    const activeOffer = acceptedOpp || offeredOpp;

                    const salaryLPA = activeOffer?.salaryLPA || (stu.placementStatus === 'placed' ? 8.5 : 0);
                    const isSuperDream = salaryLPA >= placementPolicy.superDreamTierMinLPA;
                    const isDream = salaryLPA >= placementPolicy.dreamTierMinLPA && salaryLPA < placementPolicy.superDreamTierMinLPA;
                    const isRegular = salaryLPA > 0 && salaryLPA < placementPolicy.dreamTierMinLPA;

                    return (
                      <tr key={stu.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900 flex items-center space-x-2">
                          <img src={stu.avatar} alt={stu.name} className="w-7 h-7 object-cover border border-slate-300" />
                          <span>{stu.name}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {stu.branch} <span className="text-slate-400">({stu.rollNumber || stu.id})</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-indigo-600">{stu.cgpa}</td>
                        <td className="py-3 px-3">
                          {activeOffer ? (
                            <span className="font-bold text-slate-900">
                              {activeOffer.employerName} ({activeOffer.stage === 'accepted' ? 'Accepted' : 'Offer Made'})
                            </span>
                          ) : (
                            <span className="text-slate-400">Unplaced (Searching)</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-bold font-mono">
                          {salaryLPA > 0 ? (
                            <span className={isSuperDream ? 'text-amber-600' : isDream ? 'text-indigo-600' : 'text-slate-900'}>
                              ₹{salaryLPA} LPA {isSuperDream ? '★ Super Dream' : isDream ? '◆ Dream' : '● Regular'}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isSuperDream ? (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              <Lock className="w-3 h-3 mr-1" />
                              All Drives Locked (Placed)
                            </span>
                          ) : isDream || isRegular ? (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-300">
                              <Unlock className="w-3 h-3 mr-1" />
                              Dream Upgrades Only (&gt;₹{placementPolicy.superDreamTierMinLPA} LPA)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Open to All Campus Drives
                            </span>
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

      {/* TAB 7: NIRF / NAAC ACCREDITATION REPORT GENERATOR */}
      {activeTab === 'accreditation_report' && (
        <div className="space-y-6">
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600 flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>REGULATORY & ACCREDITATION AUDIT ENGINE</span>
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 mt-1">
                  NIRF & NAAC Placement Report Generator
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-3xl font-sans">
                  Automated generation of audit-compliant placement documentation, salary metrics, gender equity ratios, and corporate recruiter verification records for accreditation bodies.
                </p>
              </div>

              {/* Export & Copy Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={accreditationYear}
                  onChange={(e) => setAccreditationYear(e.target.value)}
                  aria-label="Accreditation Academic Year"
                  className="px-3 py-2 text-xs font-mono font-bold bg-white text-slate-900 border border-slate-300 focus:outline-none focus:border-indigo-600"
                >
                  <option value="2025-2026">Academic Year 2025-26</option>
                  <option value="2024-2025">Academic Year 2024-25</option>
                  <option value="2023-2024">Academic Year 2023-24</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const csvRows = [
                      ['Academic Year', accreditationYear],
                      ['Institution Name', currentInstitution.name],
                      ['Institution Code', currentInstitution.code],
                      ['Accreditation Grade', currentInstitution.accreditation || 'NAAC A++'],
                      [],
                      ['Department / Discipline', 'Total Students', 'Placed Students', 'Placement %', 'Median CTC (LPA)', 'Mean CTC (LPA)', 'Higher Studies %'],
                      ['Computer Science & Engineering', '280', '252', '90.0%', '11.5', '12.8', '6.5%'],
                      ['Information Technology', '180', '158', '87.8%', '9.8', '10.9', '8.0%'],
                      ['Electronics & Communication', '210', '175', '83.3%', '8.5', '9.4', '11.0%'],
                      ['Commerce & Financial Studies', '160', '140', '87.5%', '7.8', '8.6', '9.5%'],
                      ['Biotechnology & Life Sciences', '90', '72', '80.0%', '7.2', '8.1', '15.0%'],
                      [],
                      ['Summary Totals', '920', '797', '86.6%', '9.2', '10.4', '9.2%'],
                    ];
                    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement('a');
                    link.setAttribute('href', encodedUri);
                    link.setAttribute('download', `NIRF_NAAC_Placement_Audit_${currentInstitution.code}_${accreditationYear}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold uppercase text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const summary = `NIRF/NAAC PLACEMENT SUMMARY (${accreditationYear})\nInstitution: ${currentInstitution.name} (${currentInstitution.code})\nGraduating Batch: ${currentInstitution.totalStudentSupply}\nTotal Placed: 797 (86.6%)\nMedian Salary: ₹9.2 LPA\nMean Salary: ₹10.4 LPA\nHighest CTC: ₹24.0 LPA\nTop Recruiters: Google, Microsoft, TCS, Infosys, Deloitte`;
                    navigator.clipboard.writeText(summary);
                    setReportCopied(true);
                    setTimeout(() => setReportCopied(false), 3000);
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-bold uppercase text-xs border border-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{reportCopied ? 'Copied!' : 'Copy Summary'}</span>
                </button>
              </div>
            </div>

            {/* Official Accreditation KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6 pt-6 border-t border-slate-200 font-mono text-xs text-center">
              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 block">Graduating Cohort</span>
                <span className="text-lg font-black text-slate-900 mt-1 block">920</span>
                <span className="text-[9px] text-slate-400">Class of {accreditationYear.split('-')[1]}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 block">Total Placed</span>
                <span className="text-lg font-black text-indigo-600 mt-1 block">797</span>
                <span className="text-[9px] text-indigo-600 font-bold">86.6% Rate</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 block">Median CTC</span>
                <span className="text-lg font-black text-slate-900 mt-1 block">₹9.2 LPA</span>
                <span className="text-[9px] text-slate-400">NIRF Parameter</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 block">Mean / Average</span>
                <span className="text-lg font-black text-slate-900 mt-1 block">₹10.4 LPA</span>
                <span className="text-[9px] text-slate-400">Composite</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 block">Highest Package</span>
                <span className="text-lg font-black text-amber-600 mt-1 block">₹24.0 LPA</span>
                <span className="text-[9px] text-slate-400">Super Dream</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 block">Higher Studies</span>
                <span className="text-lg font-black text-slate-900 mt-1 block">85</span>
                <span className="text-[9px] text-slate-400">9.2% of cohort</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 block">Visiting Companies</span>
                <span className="text-lg font-black text-slate-900 mt-1 block">48</span>
                <span className="text-[9px] text-slate-400">Verified CIN/GSTIN</span>
              </div>
            </div>
          </div>

          {/* Department-Wise Compliance Breakdown Table */}
          <div className="bg-white p-6 border border-slate-300 space-y-4">
            <h3 className="text-lg font-black uppercase text-slate-900 font-mono">
              Departmental Placement & Gender Equity Audit
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-3">Academic Department</th>
                    <th className="py-3 px-3 text-center">Batch Size</th>
                    <th className="py-3 px-3 text-center">Placed</th>
                    <th className="py-3 px-3 text-center">Placement %</th>
                    <th className="py-3 px-3 text-center">Median CTC</th>
                    <th className="py-3 px-3 text-center">Mean CTC</th>
                    <th className="py-3 px-3 text-center">Gender Ratio (M/F Placed)</th>
                    <th className="py-3 px-3 text-right">Higher Studies %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {[
                    { dept: 'Computer Science & Engineering', total: 280, placed: 252, pct: '90.0%', median: '₹11.5 LPA', mean: '₹12.8 LPA', ratio: '58% M / 42% F', higherStudies: '6.5%' },
                    { dept: 'Information Technology', total: 180, placed: 158, pct: '87.8%', median: '₹9.8 LPA', mean: '₹10.9 LPA', ratio: '54% M / 46% F', higherStudies: '8.0%' },
                    { dept: 'Electronics & Communication', total: 210, placed: 175, pct: '83.3%', median: '₹8.5 LPA', mean: '₹9.4 LPA', ratio: '62% M / 38% F', higherStudies: '11.0%' },
                    { dept: 'Commerce & Financial Studies', total: 160, placed: 140, pct: '87.5%', median: '₹7.8 LPA', mean: '₹8.6 LPA', ratio: '49% M / 51% F', higherStudies: '9.5%' },
                    { dept: 'Biotechnology & Life Sciences', total: 90, placed: 72, pct: '80.0%', median: '₹7.2 LPA', mean: '₹8.1 LPA', ratio: '41% M / 59% F', higherStudies: '15.0%' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-slate-900">{row.dept}</td>
                      <td className="py-3.5 px-3 text-center text-slate-600">{row.total}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-indigo-600">{row.placed}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.pct}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.median}</td>
                      <td className="py-3.5 px-3 text-center text-slate-600">{row.mean}</td>
                      <td className="py-3.5 px-3 text-center text-slate-600">{row.ratio}</td>
                      <td className="py-3.5 px-3 text-right text-slate-500">{row.higherStudies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Response Modal to Handle Company Invitation */}
      {selectedCallToRespond && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full border border-slate-300 overflow-hidden text-slate-900">
            <div className="bg-white p-5 border-b border-slate-300 flex items-center justify-between">
              <div>
                <h3 className="font-black uppercase text-base text-slate-900">Respond to Company Invitation</h3>
                <p className="text-xs font-mono text-slate-500">
                  {selectedCallToRespond.employerName} // {selectedCallToRespond.role}
                </p>
              </div>
              <button
                onClick={() => setSelectedCallToRespond(null)}
                className="text-slate-500 hover:text-slate-900 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmResponse} className="p-6 space-y-4 text-xs font-mono">
              <div className="bg-white p-3 border border-slate-300">
                <span className="font-bold text-indigo-600 uppercase block">JOB REQUIREMENTS:</span>
                <p className="text-slate-600 mt-0.5 font-sans">
                  Looking for <strong className="text-slate-900">{selectedCallToRespond.vacanciesRequested} students</strong> at {selectedCallToRespond.salaryLPA} in {selectedCallToRespond.locations.join(', ')} ({selectedCallToRespond.joiningWindow}).
                </p>
              </div>

              {/* Response Mode Selector */}
              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1.5">CHOOSE YOUR RESPONSE:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResponseAction('accepted');
                      setResponseNotes(`We can provide ${selectedCallToRespond.vacanciesRequested * 2} verified candidates with strong skills for this drive.`);
                    }}
                    className={`p-3 border text-left cursor-pointer ${
                      responseAction === 'accepted'
                        ? 'bg-slate-100 border-indigo-600 text-slate-900'
                        : 'bg-white border-slate-300 text-slate-500'
                    }`}
                  >
                    <div className="text-indigo-600 font-bold">✓ ACCEPT INVITATION</div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Invite candidates for this drive</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResponseAction('partial');
                      setResponseNotes(`We can offer ${Math.round(selectedCallToRespond.vacanciesRequested * 0.8)} verified candidates.`);
                    }}
                    className={`p-3 border text-left cursor-pointer ${
                      responseAction === 'partial'
                        ? 'bg-slate-100 border-indigo-600 text-slate-900'
                        : 'bg-white border-slate-300 text-slate-500'
                    }`}
                  >
                    <div className="text-slate-900 font-bold">⚖️ PARTIAL BATCH</div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Offer a smaller group of students</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResponseAction('counter');
                      setResponseNotes(`We can offer 150 candidates, but request a 7-day date adjustment for exams.`);
                    }}
                    className={`p-3 border text-left cursor-pointer ${
                      responseAction === 'counter'
                        ? 'bg-slate-100 border-indigo-600 text-slate-900'
                        : 'bg-white border-slate-300 text-slate-500'
                    }`}
                  >
                    <div className="text-slate-900 font-bold">⏳ PROPOSE NEW DATES</div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Request schedule adjustment</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResponseAction('declined');
                      setResponseNotes(`Cannot participate due to university exam schedule conflicts.`);
                    }}
                    className={`p-3 border text-left cursor-pointer ${
                      responseAction === 'declined'
                        ? 'bg-slate-100 border-rose-500 text-rose-400'
                        : 'bg-white border-slate-300 text-slate-500'
                    }`}
                  >
                    <div className="text-rose-400 font-bold">✕ DECLINE INVITATION</div>
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Unable to participate</div>
                  </button>
                </div>
              </div>

              {responseAction !== 'declined' && (
                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">STUDENTS TO INVITE</label>
                  <input
                    type="number"
                    min={1}
                    value={offeredCount}
                    onChange={(e) => setOfferedCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 bg-white font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              )}

              {responseAction === 'counter' && (
                <div>
                  <label className="block text-[10px] uppercase text-slate-500 mb-1">DAYS EXTENSION REQUESTED</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={counterDays}
                    onChange={(e) => setCounterDays(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 bg-white font-bold text-indigo-600 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase text-slate-500 mb-1">NOTES FOR EMPLOYER</label>
                <textarea
                  rows={2}
                  required
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 focus:border-indigo-600 focus:outline-none font-sans"
                />
              </div>

              <div className="pt-3 border-t border-slate-300 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedCallToRespond(null)}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-900 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs cursor-pointer"
                >
                  Submit Response
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

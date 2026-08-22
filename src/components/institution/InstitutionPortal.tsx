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
    updateStudentInstitutionVerification,
  } = useTalentNetwork();

  const [activeTab, setActiveTab] = useState<
    'inbox' | 'student_verification' | 'inventory' | 'campaign_ops' | 'publish_talent'
  >('inbox');

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

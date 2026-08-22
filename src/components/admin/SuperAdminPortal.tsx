import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import { 
  Building2, 
  GraduationCap, 
  Briefcase, 
  FileText, 
  Activity, 
  Search,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Eye,
  X,
  Filter,
  ExternalLink,
  Send,
  UserCheck,
  UserX,
  Users,
  Layers,
  HelpCircle
} from 'lucide-react';
import { Employer, Institution, StudentCareerPassport, RecruitmentCampaign, CallForTalent, UserRole } from '../../types';

export const SuperAdminPortal: React.FC = () => {
  const { 
    employers, 
    institutions, 
    students, 
    requirements, 
    callsForTalent, 
    campaigns,
    studentOpportunities,
    registeredUsers,
    provisionUserRole,
    updateEmployerVerification,
    updateInstitutionEmpanelment,
    updateStudentPlatformVerification,
  } = useTalentNetwork();

  const [activeTab, setActiveTab] = useState<'overview' | 'verification_queue' | 'users' | 'employers' | 'institutions' | 'students' | 'campaigns' | 'calls'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [provisioningLoading, setProvisioningLoading] = useState(false);
  const [selectedUserToProvision, setSelectedUserToProvision] = useState<string | null>(null);
  const [targetRoleToAssign, setTargetRoleToAssign] = useState<UserRole>('student');

  // Filters
  const [employerFilter, setEmployerFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [institutionFilter, setInstitutionFilter] = useState<'all' | 'empanelled' | 'pending' | 'rejected'>('all');
  const [studentFilter, setStudentFilter] = useState<'all' | 'empanelled' | 'independent' | 'pending_verification' | 'verified'>('all');

  // Detail Modal States
  const [selectedEmployerModal, setSelectedEmployerModal] = useState<Employer | null>(null);
  const [selectedInstitutionModal, setSelectedInstitutionModal] = useState<Institution | null>(null);
  const [selectedStudentModal, setSelectedStudentModal] = useState<StudentCareerPassport | null>(null);
  const [selectedCampaignModal, setSelectedCampaignModal] = useState<RecruitmentCampaign | null>(null);

  // Verification Form Action States
  const [adminNotesInput, setAdminNotesInput] = useState('');
  const [selectedTierInput, setSelectedTierInput] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Stats Calculations
  const pendingEmployers = employers.filter(e => e.verificationStatus === 'pending' || (!e.verified && e.verificationStatus !== 'rejected'));
  const pendingInstitutions = institutions.filter(i => i.empanelmentStatus === 'pending' || (!i.verified && i.empanelmentStatus !== 'rejected'));
  const independentStudents = students.filter(s => s.candidateType === 'independent_direct' || !s.isEmpanelledCampus);
  const pendingStudents = students.filter(s => s.platformVerificationStatus === 'pending');
  const totalOffersMade = studentOpportunities.filter(o => ['offered', 'accepted', 'joined'].includes(o.stage)).length;
  const totalOffersAccepted = studentOpportunities.filter(o => ['accepted', 'joined'].includes(o.stage)).length;

  const showFeedback = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Employer Verification Actions
  const handleVerifyEmployer = (employerId: string, status: 'verified' | 'rejected') => {
    updateEmployerVerification(employerId, status, adminNotesInput || `Actioned by Root Admin on ${new Date().toISOString().split('T')[0]}`);
    showFeedback(`Employer status successfully updated to "${status.toUpperCase()}".`);
    if (selectedEmployerModal && selectedEmployerModal.id === employerId) {
      setSelectedEmployerModal({
        ...selectedEmployerModal,
        verificationStatus: status,
        verifiedByAdmin: status === 'verified',
        verificationNotes: adminNotesInput || selectedEmployerModal.verificationNotes
      });
    }
    setAdminNotesInput('');
  };

  // Institution Empanelment Actions
  const handleEmpanelInstitution = (instId: string, status: 'empanelled' | 'rejected') => {
    const tier = (selectedTierInput as any) || (status === 'empanelled' ? 'Tier-1 High Assurance' : 'Tier-3 Provisional');
    updateInstitutionEmpanelment(instId, status, tier, adminNotesInput || `Empanelment updated by Root Admin on ${new Date().toISOString().split('T')[0]}`);
    showFeedback(`Institution status successfully updated to "${status.toUpperCase()}" with tier [${tier}].`);
    if (selectedInstitutionModal && selectedInstitutionModal.id === instId) {
      setSelectedInstitutionModal({
        ...selectedInstitutionModal,
        empanelmentStatus: status,
        verifiedByAdmin: status === 'empanelled',
        tier,
        empanelmentNotes: adminNotesInput || selectedInstitutionModal.empanelmentNotes
      });
    }
    setAdminNotesInput('');
  };

  // Student Platform Verification Actions
  const handleVerifyStudent = (studentId: string, status: 'verified' | 'rejected') => {
    updateStudentPlatformVerification(studentId, status, adminNotesInput || `Platform credentials verified by Root Admin on ${new Date().toISOString().split('T')[0]}`);
    showFeedback(`Candidate Platform Verification updated to "${status.toUpperCase()}".`);
    if (selectedStudentModal && selectedStudentModal.id === studentId) {
      setSelectedStudentModal({
        ...selectedStudentModal,
        platformVerificationStatus: status,
        verificationNotes: adminNotesInput || selectedStudentModal.verificationNotes
      });
    }
    setAdminNotesInput('');
  };

  // User RBAC Role Provisioning Action
  const handleProvisionRole = async (targetUid: string, role: UserRole) => {
    setProvisioningLoading(true);
    try {
      await provisionUserRole(targetUid, role);
      showFeedback(`Successfully provisioned role "${role.toUpperCase()}" for user ID: ${targetUid}`);
      setSelectedUserToProvision(null);
    } catch (err: any) {
      showFeedback(`Failed to provision role: ${err.message || 'Permission denied'}`);
    } finally {
      setProvisioningLoading(false);
    }
  };

  // Filtering Queries
  const filteredEmployers = employers.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.headquarters || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (employerFilter === 'verified') return matchesSearch && (e.verificationStatus === 'verified' || e.verified);
    if (employerFilter === 'pending') return matchesSearch && (e.verificationStatus === 'pending' || (!e.verified && e.verificationStatus !== 'rejected'));
    if (employerFilter === 'rejected') return matchesSearch && e.verificationStatus === 'rejected';
    return matchesSearch;
  });

  const filteredInstitutions = institutions.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (institutionFilter === 'empanelled') return matchesSearch && (i.empanelmentStatus === 'empanelled' || i.verified);
    if (institutionFilter === 'pending') return matchesSearch && (i.empanelmentStatus === 'pending' || (!i.verified && i.empanelmentStatus !== 'rejected'));
    if (institutionFilter === 'rejected') return matchesSearch && i.empanelmentStatus === 'rejected';
    return matchesSearch;
  });

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.institutionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.rollNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (studentFilter === 'empanelled') return matchesSearch && (s.isEmpanelledCampus !== false && s.candidateType !== 'independent_direct');
    if (studentFilter === 'independent') return matchesSearch && (s.candidateType === 'independent_direct' || s.isEmpanelledCampus === false);
    if (studentFilter === 'pending_verification') return matchesSearch && (s.platformVerificationStatus === 'pending' || s.institutionVerificationStatus === 'pending');
    if (studentFilter === 'verified') return matchesSearch && s.platformVerificationStatus === 'verified';
    return matchesSearch;
  });

  return (
    <div className="space-y-6 font-sans text-slate-900 pb-16">
      {/* ROOT HEADER BANNER */}
      <div className="bg-white p-6 border border-slate-200 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white shrink-0">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-slate-900 mb-0.5">
                  Admin Dashboard
                </h1>
                <span className="bg-slate-100 text-indigo-600 border border-slate-300 text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider font-bold">
                  Super Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm font-mono text-slate-500">
                Verification Approvals • Student Credential Reviews • Live Placement Activity
              </p>
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {actionSuccessMsg && (
          <div className="mt-4 p-3 bg-indigo-600/10 border border-indigo-600/40 text-indigo-600 text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 gap-2 font-mono text-xs overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Platform Overview', count: null },
          { id: 'verification_queue', label: 'Verification Requests', count: (pendingEmployers.length + pendingInstitutions.length + pendingStudents.length) },
          { id: 'users', label: 'User Roles & Admin Provisioning', count: registeredUsers.length },
          { id: 'employers', label: 'Employers', count: employers.length },
          { id: 'institutions', label: 'Colleges & Universities', count: institutions.length },
          { id: 'students', label: 'Students & Candidates', count: students.length },
          { id: 'campaigns', label: 'Hiring Drives', count: campaigns.length },
          { id: 'calls', label: 'College Invitations', count: callsForTalent.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }}
            className={`px-4 py-3 font-bold uppercase tracking-wider transition-colors whitespace-nowrap flex items-center gap-2 border-b-2 -mb-[2px] cursor-pointer ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 bg-slate-50'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span className={`px-1.5 py-0.2 text-[10px] font-bold ${
                tab.id === 'verification_queue' && tab.count > 0 
                  ? 'bg-amber-400 text-white' 
                  : activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* TOP METRICS MATRIX */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-xs font-mono font-bold uppercase">Employers Verified</span>
                <Briefcase className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 font-mono">{employers.filter(e => e.verificationStatus === 'verified' || e.verified).length}</span>
                <span className="text-xs font-mono text-slate-500">/ {employers.length} Registered</span>
              </div>
              {pendingEmployers.length > 0 && (
                <span className="text-[11px] font-mono text-amber-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {pendingEmployers.length} Pending Review
                </span>
              )}
            </div>

            <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-xs font-mono font-bold uppercase">Approved Colleges</span>
                <Building2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 font-mono">{institutions.filter(i => i.empanelmentStatus === 'empanelled' || i.verified).length}</span>
                <span className="text-xs font-mono text-slate-500">/ {institutions.length} Colleges</span>
              </div>
              {pendingInstitutions.length > 0 && (
                <span className="text-[11px] font-mono text-amber-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {pendingInstitutions.length} Approval Requests
                </span>
              )}
            </div>

            <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-xs font-mono font-bold uppercase">Direct Student Registrations</span>
                <GraduationCap className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 font-mono">{independentStudents.length}</span>
                <span className="text-xs font-mono text-slate-500">/ {students.length} Total Students</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 mt-2">
                {pendingStudents.length} Pending Credential Check
              </span>
            </div>

            <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-3">
                <span className="text-xs font-mono font-bold uppercase">Active Job Openings</span>
                <FileText className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-600 font-mono">{requirements.length}</span>
                <span className="text-xs font-mono text-slate-500">across {campaigns.length} Hiring Drives</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 mt-2">
                {totalOffersAccepted} Offers Accepted ({totalOffersMade} Made)
              </span>
            </div>
          </div>

          {/* QUICK VERIFICATION ACTION SHORTCUT BANNER */}
          {(pendingEmployers.length > 0 || pendingInstitutions.length > 0 || pendingStudents.length > 0) && (
            <div className="bg-white border-l-4 border-amber-400 border-r border-y border-slate-300 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  VERIFICATION REQUESTS REQUIRE ATTENTION
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {pendingEmployers.length} Employer(s), {pendingInstitutions.length} College(s), and {pendingStudents.length} Direct Student(s) awaiting approval.
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Review submitted business registrations, college accreditation, and student credentials.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('verification_queue')}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-white font-mono font-bold text-xs uppercase tracking-wider shrink-0 cursor-pointer"
              >
                View Verification Requests →
              </button>
            </div>
          )}

          {/* TELEMETRY METRICS SECTION */}
          <div className="bg-white border border-slate-200 p-6">
            <h2 className="text-lg font-bold uppercase tracking-tight text-slate-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Platform Activity & Placement Stats
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-white border border-slate-300">
                <div className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">College Invitations Sent</div>
                <div className="text-3xl font-black text-slate-900 font-mono">{callsForTalent.length}</div>
                <div className="text-xs text-slate-500 mt-2">Invitations sent from employers to colleges</div>
              </div>
              
              <div className="p-4 bg-white border border-slate-300">
                <div className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Student Applications</div>
                <div className="text-3xl font-black text-indigo-600 font-mono">{studentOpportunities.length}</div>
                <div className="text-xs text-slate-500 mt-2">Active student applications across all drives</div>
              </div>
              
              <div className="p-4 bg-white border border-slate-300">
                <div className="text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Offer Acceptance Rate</div>
                <div className="text-3xl font-black text-slate-900 font-mono">
                  {totalOffersAccepted} <span className="text-sm text-slate-500 font-normal">/ {totalOffersMade}</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {totalOffersMade > 0 ? `${Math.round((totalOffersAccepted / totalOffersMade) * 100)}% Joining Rate` : 'Awaiting offer cycle'}
                </div>
              </div>
            </div>
          </div>

          {/* RECENT RECRUITMENT CAMPAIGNS PREVIEW */}
          <div className="bg-white border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                Active Hiring Drives
              </h3>
              <button 
                onClick={() => setActiveTab('campaigns')}
                className="text-xs font-mono text-indigo-600 hover:underline uppercase"
              >
                View All ({campaigns.length}) →
              </button>
            </div>
            
            <div className="space-y-3">
              {campaigns.slice(0, 4).map((camp) => (
                <div key={camp.id} className="p-4 bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{camp.title}</div>
                    <div className="text-slate-500 mt-0.5">{camp.employerName} • Role: {camp.requirement.role} ({camp.requirement.experienceLevel})</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-slate-500">
                    <span>Openings: <strong className="text-slate-900">{camp.funnel.requiredVacancies}</strong></span>
                    <span>Salary: <strong className="text-indigo-600">{camp.requirement.targetCtcLpa} LPA</strong></span>
                    <button
                      onClick={() => setSelectedCampaignModal(camp)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 uppercase text-[11px] cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GOVERNANCE & VERIFICATION QUEUE */}
      {activeTab === 'verification_queue' && (
        <div className="space-y-8">
          {/* SECTION A: EMPLOYER VERIFICATIONS */}
          <div className="bg-white border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
              <div>
                <div className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider font-bold">
                  Company Verification
                </div>
                <h3 className="text-lg font-bold text-slate-900 uppercase flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-400" />
                  Pending Employer Approvals
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-900">
                {pendingEmployers.length} Pending Approval
              </span>
            </div>

            {pendingEmployers.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 text-xs font-mono text-slate-500">
                All registered employers have been verified. No pending company reviews.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingEmployers.map((emp) => (
                  <div key={emp.id} className="bg-white border border-slate-300 p-5 space-y-3 font-mono">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold text-slate-900">{emp.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{emp.industry} • {emp.companySize || 'Enterprise'}</div>
                      </div>
                      <span className="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-300 px-2 py-0.5 uppercase font-bold">
                        Pending Review
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1 py-2 border-y border-slate-200">
                      <div>HQ: <strong className="text-slate-900">{emp.headquarters || 'Bengaluru'}</strong></div>
                      <div>Contact: <strong className="text-slate-900">{emp.contactEmail || emp.id}</strong></div>
                      <div>Registration Docs: <strong className="text-emerald-400">Submitted & Validated</strong></div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setSelectedEmployerModal(emp)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold uppercase text-slate-900 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Details
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerifyEmployer(emp.id, 'verified')}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve Company
                        </button>
                        <button
                          onClick={() => handleVerifyEmployer(emp.id, 'rejected')}
                          className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION B: INSTITUTION EMPANELMENT */}
          <div className="bg-white border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
              <div>
                <div className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider font-bold">
                  College Partnership
                </div>
                <h3 className="text-lg font-bold text-slate-900 uppercase flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  Pending College Approvals
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-900">
                {pendingInstitutions.length} Pending Approval
              </span>
            </div>

            {pendingInstitutions.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 text-xs font-mono text-slate-500">
                All partner universities and colleges are approved. No pending college submissions.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingInstitutions.map((inst) => (
                  <div key={inst.id} className="bg-white border border-slate-300 p-5 space-y-3 font-mono">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold text-slate-900">{inst.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{inst.code} • {inst.type} • {inst.city}, {inst.state}</div>
                      </div>
                      <span className="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-300 px-2 py-0.5 uppercase font-bold">
                        Pending Approval
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1 py-2 border-y border-slate-200">
                      <div>Accreditation: <strong className="text-indigo-600">{inst.accreditation?.naacGrade || 'NAAC A++'} (NIRF #{inst.accreditation?.nirfRank || 18})</strong></div>
                      <div>Placement Officer: <strong className="text-slate-900">{inst.placementOfficerName} ({inst.placementOfficerEmail})</strong></div>
                      <div>Total Students: <strong className="text-slate-900">{inst.totalStudentSupply} Active Students</strong></div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setSelectedInstitutionModal(inst)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold uppercase text-slate-900 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View College
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEmpanelInstitution(inst.id, 'empanelled')}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve College
                        </button>
                        <button
                          onClick={() => handleEmpanelInstitution(inst.id, 'rejected')}
                          className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION C: INDEPENDENT CANDIDATE CREDENTIAL VERIFICATION */}
          <div className="bg-white border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
              <div>
                <div className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider font-bold">
                  Direct Student Applicants
                </div>
                <h3 className="text-lg font-bold text-slate-900 uppercase flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-purple-400" />
                  Direct Student Credential Review
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-900">
                {pendingStudents.length} Pending Review
              </span>
            </div>

            {pendingStudents.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 text-xs font-mono text-slate-500">
                All direct student registrations have been reviewed.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingStudents.map((stu) => (
                  <div key={stu.id} className="bg-white border border-slate-300 p-5 space-y-3 font-mono">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <img src={stu.avatar} alt={stu.name} className="w-10 h-10 object-cover border border-slate-300" />
                        <div>
                          <div className="text-base font-bold text-slate-900">{stu.name}</div>
                          <div className="text-xs text-slate-500">{stu.program} • {stu.branch}</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-purple-950/80 border border-purple-800 text-purple-300 px-2 py-0.5 uppercase font-bold">
                        Direct Registration
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1 py-2 border-y border-slate-200">
                      <div>College: <strong className="text-slate-900">{stu.independentCredentials?.collegeName || stu.institutionName}</strong></div>
                      <div>Roll / Registration #: <strong className="text-indigo-600">{stu.rollNumber || stu.independentCredentials?.rollNumber || 'N/A'}</strong></div>
                      <div>ID Proof Provided: <strong className="text-slate-900">{stu.independentCredentials?.idProofType || 'College ID & Marksheet'} ({stu.independentCredentials?.idProofNumber || 'ID-REG-2027'})</strong></div>
                      <div>Academic Score: <strong className="text-slate-900">CGPA {stu.cgpa} / 10.0 (Class of {stu.graduationYear})</strong></div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setSelectedStudentModal(stu)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold uppercase text-slate-900 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Details
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerifyStudent(stu.id, 'verified')}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve Student
                        </button>
                        <button
                          onClick={() => handleVerifyStudent(stu.id, 'rejected')}
                          className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: USER ROLES & ADMIN PROVISIONING */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
              <div>
                <div className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider font-bold">
                  Server-Side RBAC & Identity Control
                </div>
                <h3 className="text-lg font-bold text-slate-900 uppercase flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  User Role Provisioning & Access Control
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Enforced via Firestore Security Rules. Roles cannot be escalated on client registration.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-3 py-1.5 bg-white border border-slate-300 text-slate-900">
                  {registeredUsers.length} Authenticated Accounts in Firestore
                </span>
              </div>
            </div>

            {/* Quick Filter / Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by user email, UID, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 text-xs font-mono text-slate-900 pl-9 pr-4 py-2 border border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Protected Admin White-list: <span className="text-indigo-600">vkonline99@gmail.com</span>
              </div>
            </div>

            {/* Users Directory Table */}
            <div className="overflow-x-auto border border-slate-200">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                    <th className="py-3 px-4">User Details</th>
                    <th className="py-3 px-4">Firebase UID</th>
                    <th className="py-3 px-4 text-center">Current Role</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Provision Role Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {registeredUsers
                    .filter(u => 
                      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (u.uid || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (u.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((userRecord) => (
                      <tr key={userRecord.uid} className="hover:bg-white transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{userRecord.name || 'User'}</div>
                          <div className="text-[11px] text-slate-500">{userRecord.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 select-all">
                          {userRecord.uid}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 text-[10px] uppercase font-bold border ${
                            userRecord.role === 'super_admin'
                              ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                              : userRecord.role === 'employer'
                              ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                              : userRecord.role === 'institution'
                              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                              : 'bg-purple-950/80 border-purple-700 text-purple-300'
                          }`}>
                            {userRecord.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={selectedUserToProvision === userRecord.uid ? targetRoleToAssign : userRecord.role}
                              onChange={(e) => {
                                setSelectedUserToProvision(userRecord.uid);
                                setTargetRoleToAssign(e.target.value as UserRole);
                              }}
                              className="bg-slate-50 text-[11px] text-slate-900 p-1.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
                            >
                              <option value="student">student</option>
                              <option value="institution">institution</option>
                              <option value="employer">employer</option>
                              <option value="super_admin">super_admin</option>
                            </select>
                            <button
                              disabled={provisioningLoading}
                              onClick={() => handleProvisionRole(
                                userRecord.uid, 
                                selectedUserToProvision === userRecord.uid ? targetRoleToAssign : userRecord.role
                              )}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold uppercase transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {provisioningLoading && selectedUserToProvision === userRecord.uid ? 'Saving...' : 'Apply Role'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {registeredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                        No registered user records found in Firestore. New accounts will appear here in real-time as users sign in.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'employers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-slate-200 gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employers by name, industry, location..."
                className="w-full bg-white text-xs font-mono text-slate-900 pl-9 pr-3 py-2 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">Filter:</span>
              <select
                value={employerFilter}
                onChange={(e) => setEmployerFilter(e.target.value as any)}
                className="bg-white text-xs font-mono text-slate-900 px-2.5 py-2 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              >
                <option value="all">All Employers ({employers.length})</option>
                <option value="verified">Verified Only</option>
                <option value="pending">Pending Approval</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEmployers.map((emp) => {
              const isVerified = emp.verificationStatus === 'verified' || emp.verified;
              const isRejected = emp.verificationStatus === 'rejected';

              return (
                <div key={emp.id} className="bg-white border border-slate-200 p-5 space-y-3 font-mono">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>{emp.name}</span>
                        {isVerified && (
                          <span className="text-[10px] bg-emerald-950/80 border border-emerald-800 text-emerald-400 px-1.5 py-0.2 font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> VERIFIED
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[10px] bg-rose-950/80 border border-rose-800 text-rose-400 px-1.5 py-0.2 font-bold">
                            REJECTED
                          </span>
                        )}
                        {!isVerified && !isRejected && (
                          <span className="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-400 px-1.5 py-0.2 font-bold">
                            PENDING REVIEW
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{emp.industry} • {emp.companySize || 'Enterprise'}</div>
                    </div>
                    <span className="text-xs bg-slate-100 px-2 py-1 border border-slate-300 text-indigo-600">
                      ★ {emp.reputationScore}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Location</div>
                      <div className="text-slate-900 truncate">{emp.headquarters || 'Bengaluru'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Open Jobs</div>
                      <div className="text-slate-900 font-bold">{emp.openRequirementsCount || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Total Hires</div>
                      <div className="text-indigo-600 font-bold">{emp.totalHiresCount || 0}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500">
                      Tier: <strong className="text-slate-900">{emp.tier || 'Enterprise Partner'}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedEmployerModal(emp)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold uppercase text-indigo-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" /> View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: INSTITUTIONS DIRECTORY */}
      {activeTab === 'institutions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-slate-200 gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search colleges by name, code, state..."
                className="w-full bg-white text-xs font-mono text-slate-900 pl-9 pr-3 py-2 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">Filter:</span>
              <select
                value={institutionFilter}
                onChange={(e) => setInstitutionFilter(e.target.value as any)}
                className="bg-white text-xs font-mono text-slate-900 px-2.5 py-2 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              >
                <option value="all">All Campuses ({institutions.length})</option>
                <option value="empanelled">Empanelled Only</option>
                <option value="pending">Pending Empanelment</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInstitutions.map((inst) => {
              const isEmpanelled = inst.empanelmentStatus === 'empanelled' || inst.verified;
              const isRejected = inst.empanelmentStatus === 'rejected';

              return (
                <div key={inst.id} className="bg-white border border-slate-200 p-5 space-y-3 font-mono">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>{inst.name}</span>
                        {isEmpanelled && (
                          <span className="text-[10px] bg-emerald-950/80 border border-emerald-800 text-emerald-400 px-1.5 py-0.2 font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> EMPANELLED
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[10px] bg-rose-950/80 border border-rose-800 text-rose-400 px-1.5 py-0.2 font-bold">
                            REJECTED
                          </span>
                        )}
                        {!isEmpanelled && !isRejected && (
                          <span className="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-400 px-1.5 py-0.2 font-bold">
                            PENDING EMPANELMENT
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{inst.code} • {inst.type} • {inst.city}, {inst.state}</div>
                    </div>
                    <span className="text-xs bg-slate-100 px-2 py-1 border border-slate-300 text-indigo-600">
                      ★ {inst.overallRating}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Total Students</div>
                      <div className="text-slate-900 font-bold">{inst.totalStudentSupply}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Offer Rate</div>
                      <div className="text-indigo-600 font-bold">{inst.historicalOfferRatePercent}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Accreditation</div>
                      <div className="text-slate-900 font-bold">{inst.accreditation?.naacGrade || 'NAAC A++'}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500">
                      Tier: <strong className="text-slate-900">{inst.tier || 'Tier-1 Partner'}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedInstitutionModal(inst)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold uppercase text-indigo-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" /> View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: STUDENT DIRECTORY (EMPANELLED + DIRECT CANDIDATES) */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-slate-200 gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search candidates by name, college, roll number, branch..."
                className="w-full bg-white text-xs font-mono text-slate-900 pl-9 pr-3 py-2 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">Candidate Type:</span>
              <select
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value as any)}
                className="bg-white text-xs font-mono text-slate-900 px-2.5 py-2 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              >
                <option value="all">All Candidates ({students.length})</option>
                <option value="empanelled">Empanelled Campus Students</option>
                <option value="independent">Direct Independent Candidates</option>
                <option value="pending_verification">Pending Review</option>
                <option value="verified">Platform Verified</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((stu) => {
              const isIndependent = stu.candidateType === 'independent_direct' || stu.isEmpanelledCampus === false;
              const isPlatformVerified = stu.platformVerificationStatus === 'verified';
              const isCampusVerified = stu.institutionVerificationStatus === 'verified';

              return (
                <div key={stu.id} className="bg-white border border-slate-200 p-5 space-y-3 font-mono flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <img src={stu.avatar} alt={stu.name} className="w-11 h-11 object-cover border border-slate-300" />
                        <div>
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{stu.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">{stu.program} • {stu.branch}</div>
                        </div>
                      </div>
                      {isIndependent ? (
                        <span className="text-[9px] bg-purple-950/80 border border-purple-800 text-purple-300 px-1.5 py-0.5 font-bold uppercase shrink-0">
                          Direct Candidate
                        </span>
                      ) : (
                        <span className="text-[9px] bg-emerald-950/80 border border-emerald-800 text-emerald-400 px-1.5 py-0.5 font-bold uppercase shrink-0">
                          Empanelled Campus
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 space-y-1 py-2 border-y border-slate-200">
                      <div className="truncate">Campus: <strong className="text-slate-900">{stu.institutionName}</strong></div>
                      <div>Roll #: <strong className="text-indigo-600">{stu.rollNumber || 'DIRECT-APPLICANT'}</strong></div>
                      <div>CGPA: <strong className="text-slate-900">{stu.cgpa} / 10.0</strong> • Graduating {stu.graduationYear}</div>
                      
                      {/* Verification Status Badges */}
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {isIndependent ? (
                          <span className={`text-[10px] px-1.5 py-0.5 border ${
                            isPlatformVerified 
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                              : stu.platformVerificationStatus === 'rejected'
                              ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                              : 'bg-amber-950/60 border-amber-800 text-amber-400'
                          }`}>
                            Platform: {stu.platformVerificationStatus?.toUpperCase() || 'PENDING'}
                          </span>
                        ) : (
                          <>
                            <span className={`text-[10px] px-1.5 py-0.5 border ${
                              isCampusVerified 
                                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                                : stu.institutionVerificationStatus === 'rejected'
                                ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                                : 'bg-amber-950/60 border-amber-800 text-amber-400'
                            }`}>
                              Campus: {stu.institutionVerificationStatus?.toUpperCase() || 'VERIFIED'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950/60 border border-emerald-800 text-emerald-400">
                              Platform: VERIFIED
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Verified Skills Preview */}
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Top Verified Benchmarks:</div>
                      <div className="flex flex-wrap gap-1">
                        {stu.skills.slice(0, 2).map((sk, idx) => (
                          <span key={idx} className="text-[10px] bg-white border border-slate-300 px-1.5 py-0.5 text-slate-600">
                            {sk.name} ({sk.score}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Status: <strong className="text-indigo-600">{stu.availability === 'actively_seeking' ? 'Seeking Job' : 'Open'}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedStudentModal(stu)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold uppercase text-indigo-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" /> View Profile
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: RECRUITMENT CAMPAIGNS & OPEN DEMANDS */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="bg-white p-4 border border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase text-slate-900">
              Global Recruitment Drives & Hiring Requirements ({campaigns.length})
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Total Vacancies: <strong className="text-indigo-600">{campaigns.reduce((acc, c) => acc + c.funnel.requiredVacancies, 0)}</strong>
            </span>
          </div>

          <div className="space-y-4">
            {campaigns.map((camp) => (
              <div key={camp.id} className="bg-white border border-slate-200 p-6 space-y-4 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                  <div>
                    <div className="text-base font-bold text-slate-900">{camp.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Company: <strong className="text-slate-900">{camp.employerName}</strong> • Role: <strong className="text-indigo-600">{camp.requirement.role}</strong> ({camp.requirement.experienceLevel})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 bg-slate-100 border border-slate-300 text-indigo-600 font-bold uppercase">
                      CTC: {camp.requirement.targetCtcLpa} LPA
                    </span>
                    <button
                      onClick={() => setSelectedCampaignModal(camp)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase cursor-pointer"
                    >
                      Detailed View
                    </button>
                  </div>
                </div>

                {/* Funnel Pipeline Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
                  <div className="bg-white p-3 border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-500 block">Required</span>
                    <span className="text-base font-black text-slate-900">{camp.funnel.requiredVacancies}</span>
                  </div>
                  <div className="bg-white p-3 border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-500 block">Pool Size</span>
                    <span className="text-base font-black text-slate-900">{camp.funnel.eligiblePoolSize}</span>
                  </div>
                  <div className="bg-white p-3 border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-500 block">Institutions</span>
                    <span className="text-base font-black text-slate-900">{camp.funnel.targetInstitutionsCount}</span>
                  </div>
                  <div className="bg-white p-3 border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-500 block">Invited</span>
                    <span className="text-base font-black text-slate-900">{camp.funnel.invitedStudentsCount}</span>
                  </div>
                  <div className="bg-white p-3 border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-500 block">Consented</span>
                    <span className="text-base font-black text-indigo-600">{camp.funnel.consentedStudentsCount}</span>
                  </div>
                  <div className="bg-white p-3 border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-500 block">Shortlisted</span>
                    <span className="text-base font-black text-slate-900">{camp.funnel.shortlistedCandidatesCount}</span>
                  </div>
                  <div className="bg-slate-100 p-3 border border-indigo-600">
                    <span className="text-[9px] uppercase font-bold text-indigo-600 block">Offers Joined</span>
                    <span className="text-base font-black text-indigo-600">{camp.funnel.joinedCount} Joined</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-4 pt-1">
                  <span>Target Batch: <strong className="text-slate-900">{camp.requirement.graduationYear}</strong></span>
                  <span>Allowed Locations: <strong className="text-slate-900">{camp.requirement.locations.join(', ')}</strong></span>
                  <span>Minimum CGPA: <strong className="text-slate-900">{camp.requirement.minCgpa}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: CAMPUS CALLS FOR TALENT DISPATCH */}
      {activeTab === 'calls' && (
        <div className="space-y-4">
          <div className="bg-white p-4 border border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase text-slate-900">
              Direct Employer-To-Campus Call Logs ({callsForTalent.length})
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Automated Placement Coordination Protocol
            </span>
          </div>

          <div className="overflow-x-auto bg-white border border-slate-200">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Employer</th>
                  <th className="py-3 px-4">Partner Campus</th>
                  <th className="py-3 px-4">Role & Package</th>
                  <th className="py-3 px-4 text-center">Vacancies</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Placement Cell Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {callsForTalent.map((call) => (
                  <tr key={call.id} className="hover:bg-white transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{call.employerName}</td>
                    <td className="py-3 px-4 text-slate-600">{call.institutionName}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{call.role}</div>
                      <div className="text-[11px] text-indigo-600">{call.salaryLPA}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">{call.vacanciesRequested}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold border ${
                        call.status === 'accepted' ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' :
                        call.status === 'partial' ? 'bg-blue-950/60 border-blue-800 text-blue-400' :
                        call.status === 'counter' ? 'bg-amber-950/60 border-amber-800 text-amber-400' :
                        call.status === 'declined' ? 'bg-rose-950/60 border-rose-800 text-rose-400' :
                        'bg-slate-100 border-slate-300 text-slate-500'
                      }`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {call.responseNotes || 'Awaiting Placement Cell review'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED INSPECTOR MODAL: EMPLOYER */}
      {/* ========================================================================= */}
      {selectedEmployerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 w-full max-w-2xl p-6 space-y-5 font-mono shadow-2xl animate-fadeIn my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] text-indigo-600 uppercase tracking-wider font-bold">
                  Company Details & Verification
                </span>
                <h2 className="text-xl font-bold text-slate-900 uppercase mt-0.5">{selectedEmployerModal.name}</h2>
                <p className="text-xs text-slate-500">{selectedEmployerModal.industry} • ID: {selectedEmployerModal.id}</p>
              </div>
              <button
                onClick={() => setSelectedEmployerModal(null)}
                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Verification Status</span>
                <span className={`font-bold ${selectedEmployerModal.verificationStatus === 'verified' || selectedEmployerModal.verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedEmployerModal.verificationStatus?.toUpperCase() || (selectedEmployerModal.verified ? 'VERIFIED' : 'PENDING')}
                </span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Assigned Tier</span>
                <span className="font-bold text-slate-900">{selectedEmployerModal.tier || 'Enterprise Partner'}</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Rating</span>
                <span className="font-bold text-indigo-600">★ {selectedEmployerModal.reputationScore} / 5.0</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Headquarters</span>
                <span className="font-bold text-slate-900">{selectedEmployerModal.headquarters || 'Bengaluru, India'}</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Open Jobs</span>
                <span className="font-bold text-slate-900">{selectedEmployerModal.openRequirementsCount || 0} Open Roles</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Total Hires</span>
                <span className="font-bold text-indigo-600">{selectedEmployerModal.totalHiresCount || 0} Candidates</span>
              </div>
            </div>

            <div className="bg-white p-4 border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-900 uppercase text-[11px]">Business Registration & Details:</div>
              <div className="text-slate-500">Contact Email: <strong className="text-slate-900">{selectedEmployerModal.contactEmail || 'hr@enterprise.com'}</strong></div>
              <div className="text-slate-500">Company Registration #: <strong className="text-slate-900">U72200KA2018PTC112340 (Active)</strong></div>
              <div className="text-slate-500">Tax ID (GSTIN): <strong className="text-emerald-400">29AAAAA0000A1Z5 (Active)</strong></div>
              {selectedEmployerModal.verificationNotes && (
                <div className="text-slate-500 pt-2 border-t border-slate-300">
                  Admin Note: {selectedEmployerModal.verificationNotes}
                </div>
              )}
            </div>

            {/* Admin Verification Controls */}
            <div className="p-4 bg-slate-50 border border-slate-300 space-y-3">
              <div className="font-bold text-slate-900 uppercase text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Admin Verification Actions
              </div>
              <input
                type="text"
                value={adminNotesInput}
                onChange={(e) => setAdminNotesInput(e.target.value)}
                placeholder="Enter remarks or approval notes..."
                className="w-full bg-slate-50 text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => handleVerifyEmployer(selectedEmployerModal.id, 'rejected')}
                  className="px-4 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold uppercase cursor-pointer"
                >
                  Reject Company
                </button>
                <button
                  onClick={() => handleVerifyEmployer(selectedEmployerModal.id, 'verified')}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase cursor-pointer"
                >
                  Approve Company
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED INSPECTOR MODAL: INSTITUTION */}
      {/* ========================================================================= */}
      {selectedInstitutionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 w-full max-w-2xl p-6 space-y-5 font-mono shadow-2xl animate-fadeIn my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] text-indigo-600 uppercase tracking-wider font-bold">
                  College Profile & Partnership Details
                </span>
                <h2 className="text-xl font-bold text-slate-900 uppercase mt-0.5">{selectedInstitutionModal.name}</h2>
                <p className="text-xs text-slate-500">{selectedInstitutionModal.code} • {selectedInstitutionModal.type} • {selectedInstitutionModal.city}, {selectedInstitutionModal.state}</p>
              </div>
              <button
                onClick={() => setSelectedInstitutionModal(null)}
                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Partnership Status</span>
                <span className={`font-bold ${selectedInstitutionModal.empanelmentStatus === 'empanelled' || selectedInstitutionModal.verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedInstitutionModal.empanelmentStatus === 'empanelled' || selectedInstitutionModal.verified ? 'APPROVED' : 'PENDING'}
                </span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Partner Tier</span>
                <span className="font-bold text-slate-900">{selectedInstitutionModal.tier || 'Tier-1 Partner'}</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">NAAC Grade / NIRF</span>
                <span className="font-bold text-indigo-600">{selectedInstitutionModal.accreditation?.naacGrade || 'NAAC A++'} (Rank #{selectedInstitutionModal.accreditation?.nirfRank || 18})</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Total Students</span>
                <span className="font-bold text-slate-900">{selectedInstitutionModal.totalStudentSupply} Students</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Past Offer Rate</span>
                <span className="font-bold text-emerald-400">{selectedInstitutionModal.historicalOfferRatePercent}%</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Joining Rate</span>
                <span className="font-bold text-slate-900">{selectedInstitutionModal.historicalJoiningRatePercent}%</span>
              </div>
            </div>

            <div className="bg-white p-4 border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-900 uppercase text-[11px]">Placement Team & Contact:</div>
              <div className="text-slate-500">Placement Officer: <strong className="text-slate-900">{selectedInstitutionModal.placementOfficerName}</strong></div>
              <div className="text-slate-500">Officer Email: <strong className="text-slate-900">{selectedInstitutionModal.placementOfficerEmail}</strong></div>
              <div className="text-slate-500">Active Batches: <strong className="text-indigo-600">{selectedInstitutionModal.batches?.length || 1} Batch Cohorts Active</strong></div>
              {selectedInstitutionModal.empanelmentNotes && (
                <div className="text-slate-500 pt-2 border-t border-slate-300">
                  Admin Note: {selectedInstitutionModal.empanelmentNotes}
                </div>
              )}
            </div>

            {/* Admin Empanelment Controls */}
            <div className="p-4 bg-slate-50 border border-slate-300 space-y-3">
              <div className="font-bold text-slate-900 uppercase text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Admin Partnership Approval
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedTierInput || selectedInstitutionModal.tier || 'Tier-1 Partner'}
                  onChange={(e) => setSelectedTierInput(e.target.value)}
                  className="bg-slate-50 text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="Tier-1 Partner">Tier-1 Partner (NIRF Top 50)</option>
                  <option value="Tier-2 Partner">Tier-2 Partner (State / Accredited)</option>
                  <option value="Tier-3 Provisional">Tier-3 Provisional (Under Review)</option>
                </select>
                <input
                  type="text"
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  placeholder="Approval notes / accreditation remarks..."
                  className="bg-slate-50 text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => handleEmpanelInstitution(selectedInstitutionModal.id, 'rejected')}
                  className="px-4 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold uppercase cursor-pointer"
                >
                  Reject College
                </button>
                <button
                  onClick={() => handleEmpanelInstitution(selectedInstitutionModal.id, 'empanelled')}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase cursor-pointer"
                >
                  Approve College Partnership
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED INSPECTOR MODAL: STUDENT CAREER PASSPORT & CREDENTIALS */}
      {/* ========================================================================= */}
      {selectedStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 w-full max-w-3xl p-6 space-y-5 font-mono shadow-2xl animate-fadeIn my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <img src={selectedStudentModal.avatar} alt={selectedStudentModal.name} className="w-12 h-12 object-cover border border-slate-300" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 uppercase">{selectedStudentModal.name}</h2>
                    {selectedStudentModal.candidateType === 'independent_direct' || !selectedStudentModal.isEmpanelledCampus ? (
                      <span className="text-[10px] bg-purple-950/80 border border-purple-800 text-purple-300 px-2 py-0.5 font-bold uppercase">
                        Direct Independent Candidate
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-950/80 border border-emerald-800 text-emerald-400 px-2 py-0.5 font-bold uppercase">
                        Empanelled Campus Student
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{selectedStudentModal.program} • {selectedStudentModal.branch} • ID: {selectedStudentModal.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentModal(null)}
                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Platform Status</span>
                <span className={`font-bold ${selectedStudentModal.platformVerificationStatus === 'verified' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedStudentModal.platformVerificationStatus?.toUpperCase() || 'PENDING'}
                </span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Campus Status</span>
                <span className="font-bold text-slate-900">
                  {selectedStudentModal.institutionVerificationStatus?.toUpperCase() || 'NOT_APPLICABLE'}
                </span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">CGPA Score</span>
                <span className="font-bold text-indigo-600">{selectedStudentModal.cgpa} / 10.0</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Graduation Batch</span>
                <span className="font-bold text-slate-900">Class of {selectedStudentModal.graduationYear}</span>
              </div>
            </div>

            {/* Independent Candidate Direct Registration Credentials Dossier */}
            {selectedStudentModal.independentCredentials && (
              <div className="bg-slate-50 p-4 border border-purple-900/60 space-y-2 text-xs">
                <div className="text-purple-300 font-bold uppercase text-[11px] flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-purple-400" />
                  Submitted Student Credentials & Proofs:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  <div>College Name: <strong className="text-slate-900">{selectedStudentModal.independentCredentials.collegeName}</strong></div>
                  <div>University: <strong className="text-slate-900">{selectedStudentModal.independentCredentials.universityAffiliation || 'State University'}</strong></div>
                  <div>Student Roll / Reg #: <strong className="text-indigo-600">{selectedStudentModal.independentCredentials.rollNumber}</strong></div>
                  <div>ID Proof: <strong className="text-slate-900">{selectedStudentModal.independentCredentials.idProofType} ({selectedStudentModal.independentCredentials.idProofNumber})</strong></div>
                  <div>Portfolio / GitHub: <a href={selectedStudentModal.independentCredentials.portfolioUrl || 'https://github.com'} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">{selectedStudentModal.independentCredentials.portfolioUrl || 'github.com/candidate'} <ExternalLink className="w-2.5 h-2.5" /></a></div>
                  <div>Submitted On: <strong className="text-slate-900">{selectedStudentModal.independentCredentials.submissionDate || '2026-08-20'}</strong></div>
                </div>
              </div>
            )}

            {/* Verified Skills Benchmarks */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900 uppercase">Verified Skills & Scores:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedStudentModal.skills.map((sk, i) => (
                  <div key={i} className="p-2.5 bg-white border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{sk.name}</div>
                      <div className="text-[10px] text-slate-500">Verified by: {sk.verifiedBy || 'Skill Assessment'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-indigo-600">{sk.score}%</div>
                      <div className="text-[9px] text-emerald-400">Top {100 - (sk.percentile || 90)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin Verification Controls */}
            <div className="p-4 bg-slate-50 border border-slate-300 space-y-3">
              <div className="font-bold text-slate-900 uppercase text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Student Verification Actions
              </div>
              <input
                type="text"
                value={adminNotesInput}
                onChange={(e) => setAdminNotesInput(e.target.value)}
                placeholder="Enter verification notes (e.g. ID proof confirmed)..."
                className="w-full bg-slate-50 text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => handleVerifyStudent(selectedStudentModal.id, 'rejected')}
                  className="px-4 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold uppercase cursor-pointer"
                >
                  Reject Student
                </button>
                <button
                  onClick={() => handleVerifyStudent(selectedStudentModal.id, 'verified')}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase cursor-pointer"
                >
                  Approve Student Credentials
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED INSPECTOR MODAL: CAMPAIGN & DEMAND */}
      {/* ========================================================================= */}
      {selectedCampaignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 w-full max-w-2xl p-6 space-y-5 font-mono shadow-2xl animate-fadeIn my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] text-indigo-600 uppercase tracking-wider font-bold">
                  Hiring Demand & Campaign Pipeline
                </span>
                <h2 className="text-xl font-bold text-slate-900 uppercase mt-0.5">{selectedCampaignModal.title}</h2>
                <p className="text-xs text-slate-500">{selectedCampaignModal.employerName} • Role: {selectedCampaignModal.requirement.role}</p>
              </div>
              <button
                onClick={() => setSelectedCampaignModal(null)}
                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Target CTC</span>
                <span className="font-bold text-indigo-600">{selectedCampaignModal.requirement.targetCtcLpa} LPA</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Required Vacancies</span>
                <span className="font-bold text-slate-900">{selectedCampaignModal.funnel.requiredVacancies} Openings</span>
              </div>
              <div className="bg-white p-3 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Minimum CGPA</span>
                <span className="font-bold text-slate-900">{selectedCampaignModal.requirement.minCgpa} / 10.0</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-900 uppercase text-[11px]">Skill Benchmarks Required:</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedCampaignModal.requirement.requiredSkills.map((sk, idx) => (
                  <span key={idx} className="px-2 py-1 bg-white border border-slate-300 text-slate-900 text-[11px]">
                    {sk.name} (Min: {sk.minScore}%)
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedCampaignModal(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold uppercase text-slate-900 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

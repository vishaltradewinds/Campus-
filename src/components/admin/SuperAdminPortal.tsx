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
import { Employer, Institution, StudentCareerPassport, RecruitmentCampaign, CallForTalent } from '../../types';

export const SuperAdminPortal: React.FC = () => {
  const { 
    employers, 
    institutions, 
    students, 
    requirements, 
    callsForTalent, 
    campaigns,
    studentOpportunities,
    updateEmployerVerification,
    updateInstitutionEmpanelment,
    updateStudentPlatformVerification,
    seedDatabase
  } = useTalentNetwork();

  const [activeTab, setActiveTab] = useState<'overview' | 'verification_queue' | 'employers' | 'institutions' | 'students' | 'campaigns' | 'calls'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

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

  const handleSeed = async () => {
    setSeeding(true);
    setSeedSuccess(false);
    try {
      await seedDatabase();
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 4000);
    } catch (e) {
      console.error('Seed error:', e);
    } finally {
      setSeeding(false);
    }
  };

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
    <div className="space-y-6 font-sans text-[#F5F5F5] pb-16">
      {/* ROOT HEADER BANNER */}
      <div className="bg-[#111111] p-6 border border-[#222222] shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#CCFF00] text-black shrink-0">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-white mb-0.5">
                  Admin Dashboard
                </h1>
                <span className="bg-[#222] text-[#CCFF00] border border-[#333] text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider font-bold">
                  Super Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm font-mono text-[#888888]">
                Verification Approvals • Student Credential Reviews • Live Placement Activity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-4 py-2.5 bg-[#222222] hover:bg-[#2e2e2e] text-white border border-[#444] text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              {seeding ? 'Updating Data...' : 'Refresh Sample Data'}
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {actionSuccessMsg && (
          <div className="mt-4 p-3 bg-[#CCFF00]/10 border border-[#CCFF00]/40 text-[#CCFF00] text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {seedSuccess && (
          <div className="mt-4 p-3 bg-[#CCFF00]/10 border border-[#CCFF00]/40 text-[#CCFF00] text-xs font-mono flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Sample platform data successfully updated.</span>
          </div>
        )}
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-[#222222] gap-2 font-mono text-xs overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Platform Overview', count: null },
          { id: 'verification_queue', label: 'Verification Requests', count: (pendingEmployers.length + pendingInstitutions.length + pendingStudents.length) },
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
                ? 'border-[#CCFF00] text-[#CCFF00] bg-[#161616]'
                : 'border-transparent text-[#888888] hover:text-white hover:bg-[#111111]'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span className={`px-1.5 py-0.2 text-[10px] font-bold ${
                tab.id === 'verification_queue' && tab.count > 0 
                  ? 'bg-amber-400 text-black' 
                  : activeTab === tab.id ? 'bg-[#CCFF00] text-black' : 'bg-[#222] text-[#888]'
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
            <div className="bg-[#111111] border border-[#222222] p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#888888] mb-3">
                <span className="text-xs font-mono font-bold uppercase">Employers Verified</span>
                <Briefcase className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">{employers.filter(e => e.verificationStatus === 'verified' || e.verified).length}</span>
                <span className="text-xs font-mono text-[#888]">/ {employers.length} Registered</span>
              </div>
              {pendingEmployers.length > 0 && (
                <span className="text-[11px] font-mono text-amber-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {pendingEmployers.length} Pending Review
                </span>
              )}
            </div>

            <div className="bg-[#111111] border border-[#222222] p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#888888] mb-3">
                <span className="text-xs font-mono font-bold uppercase">Approved Colleges</span>
                <Building2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">{institutions.filter(i => i.empanelmentStatus === 'empanelled' || i.verified).length}</span>
                <span className="text-xs font-mono text-[#888]">/ {institutions.length} Colleges</span>
              </div>
              {pendingInstitutions.length > 0 && (
                <span className="text-[11px] font-mono text-amber-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {pendingInstitutions.length} Approval Requests
                </span>
              )}
            </div>

            <div className="bg-[#111111] border border-[#222222] p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#888888] mb-3">
                <span className="text-xs font-mono font-bold uppercase">Direct Student Registrations</span>
                <GraduationCap className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">{independentStudents.length}</span>
                <span className="text-xs font-mono text-[#888]">/ {students.length} Total Students</span>
              </div>
              <span className="text-[11px] font-mono text-[#888] mt-2">
                {pendingStudents.length} Pending Credential Check
              </span>
            </div>

            <div className="bg-[#111111] border border-[#222222] p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#888888] mb-3">
                <span className="text-xs font-mono font-bold uppercase">Active Job Openings</span>
                <FileText className="w-4 h-4 text-[#CCFF00]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#CCFF00] font-mono">{requirements.length}</span>
                <span className="text-xs font-mono text-[#888]">across {campaigns.length} Hiring Drives</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 mt-2">
                {totalOffersAccepted} Offers Accepted ({totalOffersMade} Made)
              </span>
            </div>
          </div>

          {/* QUICK VERIFICATION ACTION SHORTCUT BANNER */}
          {(pendingEmployers.length > 0 || pendingInstitutions.length > 0 || pendingStudents.length > 0) && (
            <div className="bg-[#181818] border-l-4 border-amber-400 border-r border-y border-[#333] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  VERIFICATION REQUESTS REQUIRE ATTENTION
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {pendingEmployers.length} Employer(s), {pendingInstitutions.length} College(s), and {pendingStudents.length} Direct Student(s) awaiting approval.
                </div>
                <p className="text-xs text-[#888] font-mono mt-0.5">
                  Review submitted business registrations, college accreditation, and student credentials.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('verification_queue')}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black font-mono font-bold text-xs uppercase tracking-wider shrink-0 cursor-pointer"
              >
                View Verification Requests →
              </button>
            </div>
          )}

          {/* TELEMETRY METRICS SECTION */}
          <div className="bg-[#111111] border border-[#222222] p-6">
            <h2 className="text-lg font-bold uppercase tracking-tight text-white mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#CCFF00]" />
              Platform Activity & Placement Stats
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-[#181818] border border-[#333333]">
                <div className="text-xs font-mono text-[#AAAAAA] mb-1 uppercase tracking-wider">College Invitations Sent</div>
                <div className="text-3xl font-black text-white font-mono">{callsForTalent.length}</div>
                <div className="text-xs text-[#888888] mt-2">Invitations sent from employers to colleges</div>
              </div>
              
              <div className="p-4 bg-[#181818] border border-[#333333]">
                <div className="text-xs font-mono text-[#AAAAAA] mb-1 uppercase tracking-wider">Student Applications</div>
                <div className="text-3xl font-black text-[#CCFF00] font-mono">{studentOpportunities.length}</div>
                <div className="text-xs text-[#888888] mt-2">Active student applications across all drives</div>
              </div>
              
              <div className="p-4 bg-[#181818] border border-[#333333]">
                <div className="text-xs font-mono text-[#AAAAAA] mb-1 uppercase tracking-wider">Offer Acceptance Rate</div>
                <div className="text-3xl font-black text-white font-mono">
                  {totalOffersAccepted} <span className="text-sm text-[#888888] font-normal">/ {totalOffersMade}</span>
                </div>
                <div className="text-xs text-[#888888] mt-2">
                  {totalOffersMade > 0 ? `${Math.round((totalOffersAccepted / totalOffersMade) * 100)}% Joining Rate` : 'Awaiting offer cycle'}
                </div>
              </div>
            </div>
          </div>

          {/* RECENT RECRUITMENT CAMPAIGNS PREVIEW */}
          <div className="bg-[#111111] border border-[#222222] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#CCFF00]" />
                Active Hiring Drives
              </h3>
              <button 
                onClick={() => setActiveTab('campaigns')}
                className="text-xs font-mono text-[#CCFF00] hover:underline uppercase"
              >
                View All ({campaigns.length}) →
              </button>
            </div>
            
            <div className="space-y-3">
              {campaigns.slice(0, 4).map((camp) => (
                <div key={camp.id} className="p-4 bg-[#181818] border border-[#2e2e2e] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
                  <div>
                    <div className="font-bold text-white text-sm">{camp.title}</div>
                    <div className="text-[#888] mt-0.5">{camp.employerName} • Role: {camp.requirement.role} ({camp.requirement.experienceLevel})</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[#aaa]">
                    <span>Openings: <strong className="text-white">{camp.funnel.requiredVacancies}</strong></span>
                    <span>Salary: <strong className="text-[#CCFF00]">{camp.requirement.targetCtcLpa} LPA</strong></span>
                    <button
                      onClick={() => setSelectedCampaignModal(camp)}
                      className="px-2.5 py-1 bg-[#222] hover:bg-[#333] border border-[#444] text-white uppercase text-[11px] cursor-pointer flex items-center gap-1"
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
          <div className="bg-[#111111] border border-[#222222] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-2">
              <div>
                <div className="text-[10px] font-mono text-[#CCFF00] uppercase tracking-wider font-bold">
                  Company Verification
                </div>
                <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-400" />
                  Pending Employer Approvals
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 bg-[#222] border border-[#333] text-white">
                {pendingEmployers.length} Pending Approval
              </span>
            </div>

            {pendingEmployers.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-[#333] text-xs font-mono text-[#888]">
                All registered employers have been verified. No pending company reviews.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingEmployers.map((emp) => (
                  <div key={emp.id} className="bg-[#181818] border border-[#333] p-5 space-y-3 font-mono">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold text-white">{emp.name}</div>
                        <div className="text-xs text-[#888] mt-0.5">{emp.industry} • {emp.companySize || 'Enterprise'}</div>
                      </div>
                      <span className="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-300 px-2 py-0.5 uppercase font-bold">
                        Pending Review
                      </span>
                    </div>

                    <div className="text-xs text-[#aaa] space-y-1 py-2 border-y border-[#282828]">
                      <div>HQ: <strong className="text-white">{emp.headquarters || 'Bengaluru'}</strong></div>
                      <div>Contact: <strong className="text-white">{emp.contactEmail || emp.id}</strong></div>
                      <div>Registration Docs: <strong className="text-emerald-400">Submitted & Validated</strong></div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setSelectedEmployerModal(emp)}
                        className="px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-[#444] text-xs font-bold uppercase text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Details
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerifyEmployer(emp.id, 'verified')}
                          className="px-3 py-1.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
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
          <div className="bg-[#111111] border border-[#222222] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-2">
              <div>
                <div className="text-[10px] font-mono text-[#CCFF00] uppercase tracking-wider font-bold">
                  College Partnership
                </div>
                <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  Pending College Approvals
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 bg-[#222] border border-[#333] text-white">
                {pendingInstitutions.length} Pending Approval
              </span>
            </div>

            {pendingInstitutions.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-[#333] text-xs font-mono text-[#888]">
                All partner universities and colleges are approved. No pending college submissions.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingInstitutions.map((inst) => (
                  <div key={inst.id} className="bg-[#181818] border border-[#333] p-5 space-y-3 font-mono">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold text-white">{inst.name}</div>
                        <div className="text-xs text-[#888] mt-0.5">{inst.code} • {inst.type} • {inst.city}, {inst.state}</div>
                      </div>
                      <span className="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-300 px-2 py-0.5 uppercase font-bold">
                        Pending Approval
                      </span>
                    </div>

                    <div className="text-xs text-[#aaa] space-y-1 py-2 border-y border-[#282828]">
                      <div>Accreditation: <strong className="text-[#CCFF00]">{inst.accreditation?.naacGrade || 'NAAC A++'} (NIRF #{inst.accreditation?.nirfRank || 18})</strong></div>
                      <div>Placement Officer: <strong className="text-white">{inst.placementOfficerName} ({inst.placementOfficerEmail})</strong></div>
                      <div>Total Students: <strong className="text-white">{inst.totalStudentSupply} Active Students</strong></div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setSelectedInstitutionModal(inst)}
                        className="px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-[#444] text-xs font-bold uppercase text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View College
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEmpanelInstitution(inst.id, 'empanelled')}
                          className="px-3 py-1.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
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
          <div className="bg-[#111111] border border-[#222222] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-2">
              <div>
                <div className="text-[10px] font-mono text-[#CCFF00] uppercase tracking-wider font-bold">
                  Direct Student Applicants
                </div>
                <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-purple-400" />
                  Direct Student Credential Review
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 bg-[#222] border border-[#333] text-white">
                {pendingStudents.length} Pending Review
              </span>
            </div>

            {pendingStudents.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-[#333] text-xs font-mono text-[#888]">
                All direct student registrations have been reviewed.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingStudents.map((stu) => (
                  <div key={stu.id} className="bg-[#181818] border border-[#333] p-5 space-y-3 font-mono">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <img src={stu.avatar} alt={stu.name} className="w-10 h-10 object-cover border border-[#444]" />
                        <div>
                          <div className="text-base font-bold text-white">{stu.name}</div>
                          <div className="text-xs text-[#888]">{stu.program} • {stu.branch}</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-purple-950/80 border border-purple-800 text-purple-300 px-2 py-0.5 uppercase font-bold">
                        Direct Registration
                      </span>
                    </div>

                    <div className="text-xs text-[#aaa] space-y-1 py-2 border-y border-[#282828]">
                      <div>College: <strong className="text-white">{stu.independentCredentials?.collegeName || stu.institutionName}</strong></div>
                      <div>Roll / Registration #: <strong className="text-[#CCFF00]">{stu.rollNumber || stu.independentCredentials?.rollNumber || 'N/A'}</strong></div>
                      <div>ID Proof Provided: <strong className="text-white">{stu.independentCredentials?.idProofType || 'College ID & Marksheet'} ({stu.independentCredentials?.idProofNumber || 'ID-REG-2027'})</strong></div>
                      <div>Academic Score: <strong className="text-white">CGPA {stu.cgpa} / 10.0 (Class of {stu.graduationYear})</strong></div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setSelectedStudentModal(stu)}
                        className="px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-[#444] text-xs font-bold uppercase text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Details
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerifyStudent(stu.id, 'verified')}
                          className="px-3 py-1.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
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

      {/* TAB 3: EMPLOYERS DIRECTORY */}
      {activeTab === 'employers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#111111] p-4 border border-[#222222] gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employers by name, industry, location..."
                className="w-full bg-[#181818] text-xs font-mono text-white pl-9 pr-3 py-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#888]">Filter:</span>
              <select
                value={employerFilter}
                onChange={(e) => setEmployerFilter(e.target.value as any)}
                className="bg-[#181818] text-xs font-mono text-white px-2.5 py-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
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
                <div key={emp.id} className="bg-[#111111] border border-[#222222] p-5 space-y-3 font-mono">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-base font-bold text-white flex items-center gap-2">
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
                      <div className="text-xs text-[#888] mt-0.5">{emp.industry} • {emp.companySize || 'Enterprise'}</div>
                    </div>
                    <span className="text-xs bg-[#222] px-2 py-1 border border-[#333] text-[#CCFF00]">
                      ★ {emp.reputationScore}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#222] text-xs text-[#aaa]">
                    <div>
                      <div className="text-[10px] text-[#666] uppercase">Location</div>
                      <div className="text-white truncate">{emp.headquarters || 'Bengaluru'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#666] uppercase">Open Jobs</div>
                      <div className="text-white font-bold">{emp.openRequirementsCount || 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#666] uppercase">Total Hires</div>
                      <div className="text-[#CCFF00] font-bold">{emp.totalHiresCount || 0}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#222]">
                    <span className="text-[11px] text-[#888]">
                      Tier: <strong className="text-white">{emp.tier || 'Enterprise Partner'}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedEmployerModal(emp)}
                      className="px-3 py-1 bg-[#222] hover:bg-[#333] border border-[#444] text-xs font-bold uppercase text-[#CCFF00] flex items-center gap-1 cursor-pointer"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#111111] p-4 border border-[#222222] gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search colleges by name, code, state..."
                className="w-full bg-[#181818] text-xs font-mono text-white pl-9 pr-3 py-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#888]">Filter:</span>
              <select
                value={institutionFilter}
                onChange={(e) => setInstitutionFilter(e.target.value as any)}
                className="bg-[#181818] text-xs font-mono text-white px-2.5 py-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
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
                <div key={inst.id} className="bg-[#111111] border border-[#222222] p-5 space-y-3 font-mono">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-base font-bold text-white flex items-center gap-2">
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
                      <div className="text-xs text-[#888] mt-0.5">{inst.code} • {inst.type} • {inst.city}, {inst.state}</div>
                    </div>
                    <span className="text-xs bg-[#222] px-2 py-1 border border-[#333] text-[#CCFF00]">
                      ★ {inst.overallRating}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#222] text-xs text-[#aaa]">
                    <div>
                      <div className="text-[10px] text-[#666] uppercase">Total Students</div>
                      <div className="text-white font-bold">{inst.totalStudentSupply}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#666] uppercase">Offer Rate</div>
                      <div className="text-[#CCFF00] font-bold">{inst.historicalOfferRatePercent}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#666] uppercase">Accreditation</div>
                      <div className="text-white font-bold">{inst.accreditation?.naacGrade || 'NAAC A++'}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#222]">
                    <span className="text-[11px] text-[#888]">
                      Tier: <strong className="text-white">{inst.tier || 'Tier-1 Partner'}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedInstitutionModal(inst)}
                      className="px-3 py-1 bg-[#222] hover:bg-[#333] border border-[#444] text-xs font-bold uppercase text-[#CCFF00] flex items-center gap-1 cursor-pointer"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#111111] p-4 border border-[#222222] gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search candidates by name, college, roll number, branch..."
                className="w-full bg-[#181818] text-xs font-mono text-white pl-9 pr-3 py-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#888]">Candidate Type:</span>
              <select
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value as any)}
                className="bg-[#181818] text-xs font-mono text-white px-2.5 py-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
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
                <div key={stu.id} className="bg-[#111111] border border-[#222222] p-5 space-y-3 font-mono flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <img src={stu.avatar} alt={stu.name} className="w-11 h-11 object-cover border border-[#333]" />
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span>{stu.name}</span>
                          </div>
                          <div className="text-[11px] text-[#888]">{stu.program} • {stu.branch}</div>
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

                    <div className="text-xs text-[#aaa] space-y-1 py-2 border-y border-[#222]">
                      <div className="truncate">Campus: <strong className="text-white">{stu.institutionName}</strong></div>
                      <div>Roll #: <strong className="text-[#CCFF00]">{stu.rollNumber || 'DIRECT-APPLICANT'}</strong></div>
                      <div>CGPA: <strong className="text-white">{stu.cgpa} / 10.0</strong> • Graduating {stu.graduationYear}</div>
                      
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
                      <div className="text-[10px] text-[#666] uppercase mb-1">Top Verified Benchmarks:</div>
                      <div className="flex flex-wrap gap-1">
                        {stu.skills.slice(0, 2).map((sk, idx) => (
                          <span key={idx} className="text-[10px] bg-[#181818] border border-[#333] px-1.5 py-0.5 text-[#ccc]">
                            {sk.name} ({sk.score}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#222] flex items-center justify-between">
                    <span className="text-[10px] text-[#888]">
                      Status: <strong className="text-[#CCFF00]">{stu.availability === 'actively_seeking' ? 'Seeking Job' : 'Open'}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedStudentModal(stu)}
                      className="px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-[#444] text-xs font-bold uppercase text-[#CCFF00] flex items-center gap-1 cursor-pointer"
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
          <div className="bg-[#111111] p-4 border border-[#222222] flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase text-white">
              Global Recruitment Drives & Hiring Requirements ({campaigns.length})
            </h3>
            <span className="text-xs font-mono text-[#888]">
              Total Vacancies: <strong className="text-[#CCFF00]">{campaigns.reduce((acc, c) => acc + c.funnel.requiredVacancies, 0)}</strong>
            </span>
          </div>

          <div className="space-y-4">
            {campaigns.map((camp) => (
              <div key={camp.id} className="bg-[#111111] border border-[#222222] p-6 space-y-4 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-2">
                  <div>
                    <div className="text-base font-bold text-white">{camp.title}</div>
                    <div className="text-xs text-[#888] mt-0.5">
                      Company: <strong className="text-white">{camp.employerName}</strong> • Role: <strong className="text-[#CCFF00]">{camp.requirement.role}</strong> ({camp.requirement.experienceLevel})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 bg-[#222] border border-[#333] text-[#CCFF00] font-bold uppercase">
                      CTC: {camp.requirement.targetCtcLpa} LPA
                    </span>
                    <button
                      onClick={() => setSelectedCampaignModal(camp)}
                      className="px-3 py-1 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-bold text-xs uppercase cursor-pointer"
                    >
                      Detailed View
                    </button>
                  </div>
                </div>

                {/* Funnel Pipeline Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
                  <div className="bg-[#181818] p-3 border border-[#282828]">
                    <span className="text-[9px] uppercase text-[#888] block">Required</span>
                    <span className="text-base font-black text-white">{camp.funnel.requiredVacancies}</span>
                  </div>
                  <div className="bg-[#181818] p-3 border border-[#282828]">
                    <span className="text-[9px] uppercase text-[#888] block">Pool Size</span>
                    <span className="text-base font-black text-white">{camp.funnel.eligiblePoolSize}</span>
                  </div>
                  <div className="bg-[#181818] p-3 border border-[#282828]">
                    <span className="text-[9px] uppercase text-[#888] block">Institutions</span>
                    <span className="text-base font-black text-white">{camp.funnel.targetInstitutionsCount}</span>
                  </div>
                  <div className="bg-[#181818] p-3 border border-[#282828]">
                    <span className="text-[9px] uppercase text-[#888] block">Invited</span>
                    <span className="text-base font-black text-white">{camp.funnel.invitedStudentsCount}</span>
                  </div>
                  <div className="bg-[#181818] p-3 border border-[#282828]">
                    <span className="text-[9px] uppercase text-[#888] block">Consented</span>
                    <span className="text-base font-black text-[#CCFF00]">{camp.funnel.consentedStudentsCount}</span>
                  </div>
                  <div className="bg-[#181818] p-3 border border-[#282828]">
                    <span className="text-[9px] uppercase text-[#888] block">Shortlisted</span>
                    <span className="text-base font-black text-white">{camp.funnel.shortlistedCandidatesCount}</span>
                  </div>
                  <div className="bg-[#222222] p-3 border border-[#CCFF00]">
                    <span className="text-[9px] uppercase font-bold text-[#CCFF00] block">Offers Joined</span>
                    <span className="text-base font-black text-[#CCFF00]">{camp.funnel.joinedCount} Joined</span>
                  </div>
                </div>

                <div className="text-xs text-[#888] flex flex-wrap items-center gap-4 pt-1">
                  <span>Target Batch: <strong className="text-white">{camp.requirement.graduationYear}</strong></span>
                  <span>Allowed Locations: <strong className="text-white">{camp.requirement.locations.join(', ')}</strong></span>
                  <span>Minimum CGPA: <strong className="text-white">{camp.requirement.minCgpa}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: CAMPUS CALLS FOR TALENT DISPATCH */}
      {activeTab === 'calls' && (
        <div className="space-y-4">
          <div className="bg-[#111111] p-4 border border-[#222222] flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase text-white">
              Direct Employer-To-Campus Call Logs ({callsForTalent.length})
            </h3>
            <span className="text-xs font-mono text-[#888]">
              Automated Placement Coordination Protocol
            </span>
          </div>

          <div className="overflow-x-auto bg-[#111111] border border-[#222222]">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#282828] bg-[#161616] text-[#888] uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Employer</th>
                  <th className="py-3 px-4">Partner Campus</th>
                  <th className="py-3 px-4">Role & Package</th>
                  <th className="py-3 px-4 text-center">Vacancies</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Placement Cell Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222] text-[#F5F5F5]">
                {callsForTalent.map((call) => (
                  <tr key={call.id} className="hover:bg-[#181818] transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{call.employerName}</td>
                    <td className="py-3 px-4 text-[#ccc]">{call.institutionName}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{call.role}</div>
                      <div className="text-[11px] text-[#CCFF00]">{call.salaryLPA}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-white">{call.vacanciesRequested}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold border ${
                        call.status === 'accepted' ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' :
                        call.status === 'partial' ? 'bg-blue-950/60 border-blue-800 text-blue-400' :
                        call.status === 'counter' ? 'bg-amber-950/60 border-amber-800 text-amber-400' :
                        call.status === 'declined' ? 'bg-rose-950/60 border-rose-800 text-rose-400' :
                        'bg-[#222] border-[#444] text-[#888]'
                      }`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#888] text-[11px]">
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
          <div className="bg-[#111111] border border-[#333333] w-full max-w-2xl p-6 space-y-5 font-mono shadow-2xl animate-fadeIn my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#282828]">
              <div>
                <span className="text-[10px] text-[#CCFF00] uppercase tracking-wider font-bold">
                  Company Details & Verification
                </span>
                <h2 className="text-xl font-bold text-white uppercase mt-0.5">{selectedEmployerModal.name}</h2>
                <p className="text-xs text-[#888]">{selectedEmployerModal.industry} • ID: {selectedEmployerModal.id}</p>
              </div>
              <button
                onClick={() => setSelectedEmployerModal(null)}
                className="p-1 text-[#888] hover:text-white hover:bg-[#222] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Verification Status</span>
                <span className={`font-bold ${selectedEmployerModal.verificationStatus === 'verified' || selectedEmployerModal.verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedEmployerModal.verificationStatus?.toUpperCase() || (selectedEmployerModal.verified ? 'VERIFIED' : 'PENDING')}
                </span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Assigned Tier</span>
                <span className="font-bold text-white">{selectedEmployerModal.tier || 'Enterprise Partner'}</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Rating</span>
                <span className="font-bold text-[#CCFF00]">★ {selectedEmployerModal.reputationScore} / 5.0</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Headquarters</span>
                <span className="font-bold text-white">{selectedEmployerModal.headquarters || 'Bengaluru, India'}</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Open Jobs</span>
                <span className="font-bold text-white">{selectedEmployerModal.openRequirementsCount || 0} Open Roles</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Total Hires</span>
                <span className="font-bold text-[#CCFF00]">{selectedEmployerModal.totalHiresCount || 0} Candidates</span>
              </div>
            </div>

            <div className="bg-[#181818] p-4 border border-[#282828] text-xs space-y-2">
              <div className="font-bold text-white uppercase text-[11px]">Business Registration & Details:</div>
              <div className="text-[#aaa]">Contact Email: <strong className="text-white">{selectedEmployerModal.contactEmail || 'hr@enterprise.com'}</strong></div>
              <div className="text-[#aaa]">Company Registration #: <strong className="text-white">U72200KA2018PTC112340 (Active)</strong></div>
              <div className="text-[#aaa]">Tax ID (GSTIN): <strong className="text-emerald-400">29AAAAA0000A1Z5 (Active)</strong></div>
              {selectedEmployerModal.verificationNotes && (
                <div className="text-[#888] pt-2 border-t border-[#333]">
                  Admin Note: {selectedEmployerModal.verificationNotes}
                </div>
              )}
            </div>

            {/* Admin Verification Controls */}
            <div className="p-4 bg-[#141414] border border-[#333] space-y-3">
              <div className="font-bold text-white uppercase text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#CCFF00]" />
                Admin Verification Actions
              </div>
              <input
                type="text"
                value={adminNotesInput}
                onChange={(e) => setAdminNotesInput(e.target.value)}
                placeholder="Enter remarks or approval notes..."
                className="w-full bg-[#1c1c1c] text-xs font-mono text-white p-2.5 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
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
                  className="px-5 py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black text-xs font-bold uppercase cursor-pointer"
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
          <div className="bg-[#111111] border border-[#333333] w-full max-w-2xl p-6 space-y-5 font-mono shadow-2xl animate-fadeIn my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#282828]">
              <div>
                <span className="text-[10px] text-[#CCFF00] uppercase tracking-wider font-bold">
                  College Profile & Partnership Details
                </span>
                <h2 className="text-xl font-bold text-white uppercase mt-0.5">{selectedInstitutionModal.name}</h2>
                <p className="text-xs text-[#888]">{selectedInstitutionModal.code} • {selectedInstitutionModal.type} • {selectedInstitutionModal.city}, {selectedInstitutionModal.state}</p>
              </div>
              <button
                onClick={() => setSelectedInstitutionModal(null)}
                className="p-1 text-[#888] hover:text-white hover:bg-[#222] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Partnership Status</span>
                <span className={`font-bold ${selectedInstitutionModal.empanelmentStatus === 'empanelled' || selectedInstitutionModal.verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedInstitutionModal.empanelmentStatus === 'empanelled' || selectedInstitutionModal.verified ? 'APPROVED' : 'PENDING'}
                </span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Partner Tier</span>
                <span className="font-bold text-white">{selectedInstitutionModal.tier || 'Tier-1 Partner'}</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">NAAC Grade / NIRF</span>
                <span className="font-bold text-[#CCFF00]">{selectedInstitutionModal.accreditation?.naacGrade || 'NAAC A++'} (Rank #{selectedInstitutionModal.accreditation?.nirfRank || 18})</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Total Students</span>
                <span className="font-bold text-white">{selectedInstitutionModal.totalStudentSupply} Students</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Past Offer Rate</span>
                <span className="font-bold text-emerald-400">{selectedInstitutionModal.historicalOfferRatePercent}%</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Joining Rate</span>
                <span className="font-bold text-white">{selectedInstitutionModal.historicalJoiningRatePercent}%</span>
              </div>
            </div>

            <div className="bg-[#181818] p-4 border border-[#282828] text-xs space-y-2">
              <div className="font-bold text-white uppercase text-[11px]">Placement Team & Contact:</div>
              <div className="text-[#aaa]">Placement Officer: <strong className="text-white">{selectedInstitutionModal.placementOfficerName}</strong></div>
              <div className="text-[#aaa]">Officer Email: <strong className="text-white">{selectedInstitutionModal.placementOfficerEmail}</strong></div>
              <div className="text-[#aaa]">Active Batches: <strong className="text-[#CCFF00]">{selectedInstitutionModal.batches?.length || 1} Batch Cohorts Active</strong></div>
              {selectedInstitutionModal.empanelmentNotes && (
                <div className="text-[#888] pt-2 border-t border-[#333]">
                  Admin Note: {selectedInstitutionModal.empanelmentNotes}
                </div>
              )}
            </div>

            {/* Admin Empanelment Controls */}
            <div className="p-4 bg-[#141414] border border-[#333] space-y-3">
              <div className="font-bold text-white uppercase text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#CCFF00]" />
                Admin Partnership Approval
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedTierInput || selectedInstitutionModal.tier || 'Tier-1 Partner'}
                  onChange={(e) => setSelectedTierInput(e.target.value)}
                  className="bg-[#1c1c1c] text-xs font-mono text-white p-2.5 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
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
                  className="bg-[#1c1c1c] text-xs font-mono text-white p-2.5 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
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
                  className="px-5 py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black text-xs font-bold uppercase cursor-pointer"
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
          <div className="bg-[#111111] border border-[#333333] w-full max-w-3xl p-6 space-y-5 font-mono shadow-2xl animate-fadeIn my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#282828]">
              <div className="flex items-center gap-3">
                <img src={selectedStudentModal.avatar} alt={selectedStudentModal.name} className="w-12 h-12 object-cover border border-[#444]" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white uppercase">{selectedStudentModal.name}</h2>
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
                  <p className="text-xs text-[#888]">{selectedStudentModal.program} • {selectedStudentModal.branch} • ID: {selectedStudentModal.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentModal(null)}
                className="p-1 text-[#888] hover:text-white hover:bg-[#222] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Platform Status</span>
                <span className={`font-bold ${selectedStudentModal.platformVerificationStatus === 'verified' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedStudentModal.platformVerificationStatus?.toUpperCase() || 'PENDING'}
                </span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Campus Status</span>
                <span className="font-bold text-white">
                  {selectedStudentModal.institutionVerificationStatus?.toUpperCase() || 'NOT_APPLICABLE'}
                </span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">CGPA Score</span>
                <span className="font-bold text-[#CCFF00]">{selectedStudentModal.cgpa} / 10.0</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Graduation Batch</span>
                <span className="font-bold text-white">Class of {selectedStudentModal.graduationYear}</span>
              </div>
            </div>

            {/* Independent Candidate Direct Registration Credentials Dossier */}
            {selectedStudentModal.independentCredentials && (
              <div className="bg-[#161616] p-4 border border-purple-900/60 space-y-2 text-xs">
                <div className="text-purple-300 font-bold uppercase text-[11px] flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-purple-400" />
                  Submitted Student Credentials & Proofs:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#ccc]">
                  <div>College Name: <strong className="text-white">{selectedStudentModal.independentCredentials.collegeName}</strong></div>
                  <div>University: <strong className="text-white">{selectedStudentModal.independentCredentials.universityAffiliation || 'State University'}</strong></div>
                  <div>Student Roll / Reg #: <strong className="text-[#CCFF00]">{selectedStudentModal.independentCredentials.rollNumber}</strong></div>
                  <div>ID Proof: <strong className="text-white">{selectedStudentModal.independentCredentials.idProofType} ({selectedStudentModal.independentCredentials.idProofNumber})</strong></div>
                  <div>Portfolio / GitHub: <a href={selectedStudentModal.independentCredentials.portfolioUrl || 'https://github.com'} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">{selectedStudentModal.independentCredentials.portfolioUrl || 'github.com/candidate'} <ExternalLink className="w-2.5 h-2.5" /></a></div>
                  <div>Submitted On: <strong className="text-white">{selectedStudentModal.independentCredentials.submissionDate || '2026-08-20'}</strong></div>
                </div>
              </div>
            )}

            {/* Verified Skills Benchmarks */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-white uppercase">Verified Skills & Scores:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedStudentModal.skills.map((sk, i) => (
                  <div key={i} className="p-2.5 bg-[#181818] border border-[#282828] text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{sk.name}</div>
                      <div className="text-[10px] text-[#888]">Verified by: {sk.verifiedBy || 'Skill Assessment'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#CCFF00]">{sk.score}%</div>
                      <div className="text-[9px] text-emerald-400">Top {100 - (sk.percentile || 90)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin Verification Controls */}
            <div className="p-4 bg-[#141414] border border-[#333] space-y-3">
              <div className="font-bold text-white uppercase text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#CCFF00]" />
                Student Verification Actions
              </div>
              <input
                type="text"
                value={adminNotesInput}
                onChange={(e) => setAdminNotesInput(e.target.value)}
                placeholder="Enter verification notes (e.g. ID proof confirmed)..."
                className="w-full bg-[#1c1c1c] text-xs font-mono text-white p-2.5 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
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
                  className="px-5 py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black text-xs font-bold uppercase cursor-pointer"
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
          <div className="bg-[#111111] border border-[#333333] w-full max-w-2xl p-6 space-y-5 font-mono shadow-2xl animate-fadeIn my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#282828]">
              <div>
                <span className="text-[10px] text-[#CCFF00] uppercase tracking-wider font-bold">
                  Hiring Demand & Campaign Pipeline
                </span>
                <h2 className="text-xl font-bold text-white uppercase mt-0.5">{selectedCampaignModal.title}</h2>
                <p className="text-xs text-[#888]">{selectedCampaignModal.employerName} • Role: {selectedCampaignModal.requirement.role}</p>
              </div>
              <button
                onClick={() => setSelectedCampaignModal(null)}
                className="p-1 text-[#888] hover:text-white hover:bg-[#222] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Target CTC</span>
                <span className="font-bold text-[#CCFF00]">{selectedCampaignModal.requirement.targetCtcLpa} LPA</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Required Vacancies</span>
                <span className="font-bold text-white">{selectedCampaignModal.funnel.requiredVacancies} Openings</span>
              </div>
              <div className="bg-[#181818] p-3 border border-[#282828]">
                <span className="text-[10px] text-[#666] uppercase block">Minimum CGPA</span>
                <span className="font-bold text-white">{selectedCampaignModal.requirement.minCgpa} / 10.0</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-white uppercase text-[11px]">Skill Benchmarks Required:</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedCampaignModal.requirement.requiredSkills.map((sk, idx) => (
                  <span key={idx} className="px-2 py-1 bg-[#181818] border border-[#333] text-white text-[11px]">
                    {sk.name} (Min: {sk.minScore}%)
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#282828] flex justify-end">
              <button
                onClick={() => setSelectedCampaignModal(null)}
                className="px-5 py-2 bg-[#222] hover:bg-[#333] border border-[#444] text-xs font-bold uppercase text-white cursor-pointer"
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

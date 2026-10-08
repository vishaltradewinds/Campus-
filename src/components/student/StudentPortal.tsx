import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import {
  Sparkles,
  ShieldCheck,
  Briefcase,
  Award,
  CheckCircle2,
  Lock,
  History,
  FileCheck,
  BookOpen,
  GraduationCap,
  Play,
  FileText,
  CheckSquare,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Layers,
  Calculator,
  Scale,
  DollarSign,
  Building,
} from 'lucide-react';
import { StudentConsentOpportunity, CampaignConsentPermission } from '../../types';
import { StageBadge } from '../common/StatusBadge';
import { StudentConsentMatrix } from './StudentConsentMatrix';
import { CareerPassportEvidencePanel } from './CareerPassportEvidencePanel';
import { DataSovereigntySettings } from './DataSovereigntySettings';
import confetti from 'canvas-confetti';

interface DomainAssessmentTemplate {
  domainId: string;
  discipline: string;
  courseTitle: string;
  assessmentName: string;
  timeLimit: string;
  scenario: string;
  prompt: string;
  defaultAnswer: string;
  rubrics: { criterion: string; weight: string; status: string }[];
}

const DOMAIN_ASSESSMENTS: DomainAssessmentTemplate[] = [
  {
    domainId: 'eng-mech',
    discipline: 'Engineering & Technology',
    courseTitle: 'Mechanical & Mechatronics / Applied Engineering',
    assessmentName: 'Mechanical Systems CAD & Thermal Heat Exchanger Evaluation',
    timeLimit: '45 mins',
    scenario:
      'A manufacturing plant requires a counter-flow heat exchanger for recovering waste heat from turbine exhaust. The mass flow rate is 4.5 kg/s with an inlet temperature of 420°C.',
    prompt:
      '1. Calculate required log-mean temperature difference (LMTD) and overall surface area.\n2. Specify material selection and corrosion-resistance factors for high-temperature exhaust.\n3. Outline the structural safety factor for pressure casing under cyclic thermal fatigue.',
    defaultAnswer: '',
    rubrics: [
      { criterion: 'Thermodynamic LMTD & Area Precision', weight: '35%', status: 'Rubric defined' },
      { criterion: 'Metallurgical Material Selection & Standards', weight: '35%', status: 'Rubric defined' },
      { criterion: 'Fatigue Margin & FEA Safety Compliance', weight: '30%', status: 'Rubric defined' },
    ],
  },
  {
    domainId: 'comm-fin',
    discipline: 'Commerce & Management',
    courseTitle: 'Finance, Accounting, Taxation & Valuation',
    assessmentName: 'Corporate Valuation (DCF Model) & GST Reconciliation Diagnostic',
    timeLimit: '45 mins',
    scenario:
      'Evaluate a consumer goods corporate expansion. The company projects Free Cash Flows of ₹45 Cr, ₹58 Cr, ₹72 Cr, and ₹89 Cr for years 1-4 with a terminal growth rate of 5.5% and WACC of 11.2%.',
    prompt:
      '1. Compute Present Value of FCF and Terminal Value using Gordon Growth Model.\n2. Detail the Input Tax Credit (ITC) reconciliation procedure between GSTR-2B and ERP purchase registers.\n3. Recommend working capital optimization strategies.',
    defaultAnswer: '',
    rubrics: [
      { criterion: 'DCF & Terminal Valuation Accuracy', weight: '40%', status: 'Rubric defined' },
      { criterion: 'Statutory GST & GSTR-2B Compliance', weight: '30%', status: 'Rubric defined' },
      { criterion: 'Working Capital & Liquidity Analysis', weight: '30%', status: 'Rubric defined' },
    ],
  },
  {
    domainId: 'sci-bio',
    discipline: 'Sciences & Biotechnology',
    courseTitle: 'Biotechnology, Life Sciences & Clinical Research',
    assessmentName: 'Molecular Biology Lab Protocols & HPLC Chromatography Validation',
    timeLimit: '45 mins',
    scenario:
      'A pharmaceutical bio-manufacturing process requires purification and purity verification of a recombinant therapeutic monoclonal antibody batch.',
    prompt:
      '1. Formulate the Protein-A affinity chromatography and ion-exchange polishing gradient.\n2. Detail the analytical HPLC purity assay protocol and system suitability criteria.\n3. Outline GLP/GMP documentation and sterility verification.',
    defaultAnswer: '',
    rubrics: [
      { criterion: 'Downstream Chromatography Protocol', weight: '40%', status: 'Rubric defined' },
      { criterion: 'SEC-HPLC Analytical Rigor', weight: '35%', status: 'Rubric defined' },
      { criterion: 'GMP/GLP Regulatory Documentation', weight: '25%', status: 'Rubric defined' },
    ],
  },
  {
    domainId: 'comm-media',
    discipline: 'Humanities, Media & Arts',
    courseTitle: 'Journalism, Corporate PR & Mass Media',
    assessmentName: 'Corporate Crisis Communication & ESG Strategy Brief',
    timeLimit: '45 mins',
    scenario:
      'A consumer brand experiences a supply-chain packaging controversy regarding recyclability claims. Draft a crisis response roadmap for media, customers, and regulatory bodies.',
    prompt:
      '1. Develop a 3-pillar public statement with proactive accountability.\n2. Outline the press briefing Q&A and spokesperson talking points.\n3. Detail internal stakeholder and employee communications alignment.',
    defaultAnswer: '',
    rubrics: [
      { criterion: 'Clarity, Empathy & Ethical Posture', weight: '40%', status: 'Rubric defined' },
      { criterion: 'Spokesperson Strategy & Q&A Resilience', weight: '35%', status: 'Rubric defined' },
      { criterion: 'Multi-Stakeholder Internal Alignment', weight: '25%', status: 'Rubric defined' },
    ],
  },
  {
    domainId: 'des-prod',
    discipline: 'Design & Architecture',
    courseTitle: 'Industrial Product Design & UI/UX Systems',
    assessmentName: 'Product Ergonomics & Usability Heuristics Evaluation',
    timeLimit: '45 mins',
    scenario:
      'Design an assistive smart mobility walker for senior citizens navigating urban public transportation and outdoor pavements.',
    prompt:
      '1. Detail anthropometric dimensions, grip angle, and weight distribution.\n2. Specify physical feedback and intuitive UI controls for built-in safety brakes.\n3. Outline user testing methodologies and accessibility standards.',
    defaultAnswer: '',
    rubrics: [
      { criterion: 'Anthropometric Ergonomic Standards', weight: '40%', status: 'Rubric defined' },
      { criterion: 'Intuitive Controls & Accessibility', weight: '35%', status: 'Rubric defined' },
      { criterion: 'Empirical User Testing Protocol', weight: '25%', status: 'Rubric defined' },
    ],
  },
];

export const StudentPortal: React.FC = () => {
  const {
    currentStudent,
    studentOpportunities,
    advanceCandidateStage,
    updateStudentAvailability,
  } = useTalentNetwork();

  const [activeTab, setActiveTab] = useState<
    'consent_matrix' | 'opportunities' | 'sovereignty_audit' | 'passport' | 'assessment_lab' | 'salary_simulator'
  >('consent_matrix');

  // Interactive Offer & In-Hand Salary Simulator State
  const [simulatedCTC, setSimulatedCTC] = useState<number>(12.0);
  const [taxRegime, setTaxRegime] = useState<'new' | 'old'>('new');
  const [metroLiving, setMetroLiving] = useState(true);
  const [compareOpp1Id, setCompareOpp1Id] = useState<string>('');
  const [compareOpp2Id, setCompareOpp2Id] = useState<string>('');

  // Match default assessment to student's program/branch
  const getInitialDomainAssessment = (): DomainAssessmentTemplate => {
    const branchLower = currentStudent.branch.toLowerCase();
    const progLower = currentStudent.program.toLowerCase();

    if (branchLower.includes('commerce') || branchLower.includes('financ') || branchLower.includes('tax') || branchLower.includes('account') || progLower.includes('b.com') || progLower.includes('m.com')) {
      return DOMAIN_ASSESSMENTS[1]; // Finance
    }
    if (branchLower.includes('bio') || branchLower.includes('chemist') || branchLower.includes('life') || branchLower.includes('pharm') || progLower.includes('b.sc') || progLower.includes('m.sc')) {
      return DOMAIN_ASSESSMENTS[2]; // Biotech
    }
    if (branchLower.includes('journalism') || branchLower.includes('media') || branchLower.includes('communicat') || progLower.includes('b.a.')) {
      return DOMAIN_ASSESSMENTS[3]; // Media & PR
    }
    if (branchLower.includes('design') || progLower.includes('b.des')) {
      return DOMAIN_ASSESSMENTS[4]; // Design
    }
    return DOMAIN_ASSESSMENTS[0]; // Engineering default
  };

  const [selectedAssessmentTemplate, setSelectedAssessmentTemplate] = useState<DomainAssessmentTemplate>(getInitialDomainAssessment);
  const [selectedAssessmentOpp, setSelectedAssessmentOpp] = useState<StudentConsentOpportunity | null>(null);
  const [candidateWork, setCandidateWork] = useState<string>(getInitialDomainAssessment().defaultAnswer);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);
  const [assessmentDoneMsg, setAssessmentDoneMsg] = useState<string | null>(null);

  // Switch domain template
  const handleSelectTemplate = (tmpl: DomainAssessmentTemplate) => {
    setSelectedAssessmentTemplate(tmpl);
    setCandidateWork(tmpl.defaultAnswer);
    setDiagnosticResult(null);
  };

  // Opportunities for current student
  const myOpportunities = studentOpportunities.filter(
    (o) => o.studentId === currentStudent.id
  );

  const pendingInvitations = myOpportunities.filter((o) => o.stage === 'invited');
  const activeApplications = myOpportunities.filter((o) => o.stage !== 'invited' && o.stage !== 'declined');

  // Count denied campaigns
  const deniedConsentsCount = (
    Object.values(currentStudent.campaignConsents || {}) as CampaignConsentPermission[]
  ).filter((c) => c.status === 'denied').length;

  const handleLaunchAssessment = (opp: StudentConsentOpportunity) => {
    setSelectedAssessmentOpp(opp);
    setActiveTab('assessment_lab');
  };

  const handleRunDiagnostic = () => {
    setIsRunningDiagnostic(true);
    setTimeout(() => {
      setIsRunningDiagnostic(false);
      setDiagnosticResult('Diagnostic rubric prepared. Submit the assessment for authorized scoring; no verification is implied by this preview.');
    }, 800);
  };

  const handleCompleteAssessment = () => {
    setIsSubmittingAssessment(true);
    setTimeout(() => {
      const oppToUpdate = selectedAssessmentOpp || myOpportunities.find((o) => o.stage === 'consented' || o.stage === 'assessment_pending') || myOpportunities[0];
      if (oppToUpdate) {
        advanceCandidateStage(oppToUpdate.id, 'assessment_completed');
      }
      setIsSubmittingAssessment(false);
      setSelectedAssessmentOpp(null);
      setAssessmentDoneMsg(`Domain Skill Assessment submitted successfully! Assessment submitted successfully. Pending verification for ${selectedAssessmentTemplate.courseTitle}.`);
      setTimeout(() => setAssessmentDoneMsg(null), 6000);
    }, 1200);
  };

  const handleAcceptOffer = (opp: StudentConsentOpportunity) => {
    advanceCandidateStage(opp.id, 'accepted');
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900">
      <CareerPassportEvidencePanel studentId={currentStudent.id} />
      {/* Student Identity & Banner */}
      <div className="bg-white p-6 border border-slate-300 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <img
              src={currentStudent.avatar}
              alt={currentStudent.name}
              className="w-16 h-16 object-cover border border-slate-300"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">{currentStudent.name}</h1>
                
                {/* Candidate Type Badge */}
                {currentStudent.candidateType === 'independent_direct' || !currentStudent.isEmpanelledCampus ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-purple-950/80 text-purple-300 border border-purple-800">
                    <Award className="w-3 h-3 mr-1" />
                    INDEPENDENT DIRECT CANDIDATE
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-100 text-indigo-600 border border-slate-300">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    EMPANELLED CAMPUS COHORT
                  </span>
                )}

                {/* Platform Verification Badge */}
                {currentStudent.platformVerificationStatus === 'verified' ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    PLATFORM VERIFIED
                  </span>
                ) : currentStudent.platformVerificationStatus === 'rejected' ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-rose-950/80 text-rose-400 border border-rose-800">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    VERIFICATION FLAGGED
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-800">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    PLATFORM REVIEW PENDING
                  </span>
                )}

                {/* Campus Verification Badge (for empanelled students) */}
                {currentStudent.isEmpanelledCampus && (
                  currentStudent.institutionVerificationStatus === 'verified' ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                      ✓ CAMPUS TPO VERIFIED
                    </span>
                  ) : currentStudent.institutionVerificationStatus === 'rejected' ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-rose-950/80 text-rose-400 border border-rose-800">
                      ✗ CAMPUS FLAGGED
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-800">
                      ⏳ CAMPUS ATTESTATION PENDING
                    </span>
                  )
                )}

                {deniedConsentsCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-rose-950/80 text-rose-400 border border-rose-800">
                    <Lock className="w-3 h-3 mr-1" />
                    HIDDEN FROM {deniedConsentsCount} COMPANIES
                  </span>
                )}
              </div>

              <p className="text-xs font-mono text-slate-500 mt-1.5 flex flex-wrap items-center gap-2">
                <span className="uppercase text-slate-900 font-bold">{currentStudent.program} — {currentStudent.branch}</span>
                <span>//</span>
                <span>Class of {currentStudent.graduationYear}</span>
                <span>//</span>
                <span className="text-indigo-600">{currentStudent.institutionName}</span>
                <span>//</span>
                <span>Ref / Roll: <strong className="text-slate-900">{currentStudent.rollNumber || currentStudent.id}</strong></span>
                <span>//</span>
                <span>CGPA: <strong className="text-indigo-600">{currentStudent.cgpa} / 10.0</strong></span>
              </p>
            </div>
          </div>

          {/* Student Availability Status */}
          <div className="bg-white p-3 border border-slate-300 text-xs font-mono">
            <span className="text-[10px] uppercase text-slate-500 block mb-1">PLACEMENT STATUS:</span>
            <select
              value={currentStudent.availability}
              onChange={(e) => updateStudentAvailability(currentStudent.id, e.target.value as any)}
              aria-label="Placement Availability"
              className="w-full bg-white text-slate-900 font-bold text-xs px-2.5 py-1.5 border border-slate-300 focus:border-indigo-600 focus:outline-none cursor-pointer"
            >
              <option value="actively_seeking">🟢 Actively Looking for Campus Jobs</option>
              <option value="open_to_offers">🟡 Open to Opportunities</option>
              <option value="not_currently_available">🔴 Placed / Not Seeking</option>
            </select>
          </div>
        </div>

        {/* Student Navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap gap-2">
          <button
            id="tab-consent-matrix"
            onClick={() => setActiveTab('consent_matrix')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'consent_matrix'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>1. Employer Permissions & Consent</span>
            {pendingInvitations.length > 0 && (
              <span className="px-1.5 py-0.2 bg-black text-indigo-600 font-bold text-[10px] ml-1">
                {pendingInvitations.length} Pending
              </span>
            )}
          </button>

          <button
            id="tab-opportunities"
            onClick={() => setActiveTab('opportunities')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'opportunities'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>2. Applications & Hiring Rounds</span>
            {activeApplications.length > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-900 font-bold text-[10px] ml-1 border border-slate-300">
                {activeApplications.length}
              </span>
            )}
          </button>

          <button
            id="tab-passport"
            onClick={() => setActiveTab('passport')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'passport'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>3. Academic Profile & Verified Skills</span>
          </button>

          <button
            id="tab-assessment-lab"
            onClick={() => setActiveTab('assessment_lab')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'assessment_lab'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>4. Domain & Subject Assessment Lab</span>
          </button>

          <button
            id="tab-sovereignty-audit"
            onClick={() => setActiveTab('sovereignty_audit')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'sovereignty_audit'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>5. Privacy & Data Audit Log</span>
          </button>

          <button
            id="tab-salary-simulator"
            onClick={() => setActiveTab('salary_simulator')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'salary_simulator'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>6. In-Hand Salary & Offer Comparator</span>
          </button>
        </div>
      </div>

      {assessmentDoneMsg && (
        <div className="bg-white border-l-4 border-indigo-600 border-y border-r border-slate-300 text-slate-900 px-4 py-3 flex items-center space-x-2 text-xs font-mono font-bold">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{assessmentDoneMsg}</span>
        </div>
      )}

      {/* TAB 1: COMPANY PERMISSIONS */}
      {activeTab === 'consent_matrix' && <StudentConsentMatrix />}

      {/* TAB 2: RECRUITMENT APPLICATIONS */}
      {activeTab === 'opportunities' && (
        <div className="space-y-6">
          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="bg-white border-l-4 border-l-indigo-600 border-slate-300 p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black uppercase text-slate-900 font-mono">
                  New Campus Drive Invitations (Your Action Needed)
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-sans">
                Your college verified your eligibility for these drives. Review role requirements and choose whether to apply.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingInvitations.map((opp) => (
                  <div key={opp.id} className="p-4 bg-white border border-slate-300 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-black text-sm uppercase text-slate-900">{opp.employerName}</h4>
                        <p className="text-xs font-mono text-indigo-600">{opp.role}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-100 text-indigo-600 text-[10px] font-mono font-bold border border-slate-300">
                        {opp.matchScore}% Match
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-500 space-y-1">
                      <div>Package: <strong className="text-slate-900">₹{opp.salaryLPA} LPA</strong></div>
                      <div>Location: <strong className="text-slate-900">{opp.locations.join(', ')}</strong></div>
                      <div>Joining: <strong className="text-slate-900">{opp.joiningWindow}</strong></div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => setActiveTab('consent_matrix')}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs transition-all text-center cursor-pointer"
                      >
                        Review & Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Applications */}
          <div className="bg-white p-6 border border-slate-300 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <span>My Active Campus Applications ({activeApplications.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Track your evaluation stages, assessment scores, and job offers
                </p>
              </div>
            </div>

            {activeApplications.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 text-xs font-mono text-slate-500">
                You have not consented to any company drives yet. Visit the "Employer Permissions" tab to view available drives.
              </div>
            ) : (
              <div className="space-y-4">
                {activeApplications.map((opp) => {
                  const isOffered = opp.stage === 'offered';
                  const isJoined = opp.stage === 'accepted' || opp.stage === 'joined';
                  const isAssessmentPending = opp.stage === 'consented' || opp.stage === 'assessment_pending';

                  return (
                    <div
                      key={opp.id}
                      className={`p-5 border transition-all ${
                        isOffered
                          ? 'bg-white border-indigo-600'
                          : isJoined
                          ? 'bg-white border-l-4 border-l-indigo-600 border-slate-300'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-base uppercase text-slate-900">{opp.employerName}</span>
                            <StageBadge stage={opp.stage} />
                          </div>
                          <h4 className="text-xs font-mono font-bold text-indigo-600 uppercase mt-1">{opp.role}</h4>
                          <p className="text-xs font-mono text-slate-500 mt-1">
                            Salary: <strong className="text-slate-900">₹{opp.salaryLPA} LPA</strong> // Locations: {opp.locations.join(', ')}
                          </p>
                        </div>

                        {/* Interactive Action */}
                        <div className="flex items-center space-x-2">
                          {isAssessmentPending && (
                            <button
                              onClick={() => handleLaunchAssessment(opp)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Take Subject Assessment</span>
                            </button>
                          )}

                          {isOffered && (
                            <button
                              id="accept-offer-btn"
                              onClick={() => handleAcceptOffer(opp)}
                              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Accept Job Offer & Confirm Placement</span>
                            </button>
                          )}

                          {isJoined && (
                            <span className="px-3 py-1.5 bg-slate-100 text-indigo-600 font-mono font-bold uppercase text-xs flex items-center space-x-1 border border-slate-300">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Offer Accepted & Placed</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Recruitment Step Progress Bar */}
                      <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-5 gap-2 text-center text-[10px] font-mono font-bold uppercase">
                        <div className="p-1.5 bg-slate-100 text-indigo-600 border border-slate-300">
                          1. Opted-In ✓
                        </div>
                        <div
                          className={`p-1.5 border ${
                            opp.stage !== 'consented' && opp.stage !== 'invited'
                              ? 'bg-slate-100 text-indigo-600 border-slate-300'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          2. Assessment {opp.assessmentScore ? `(${opp.assessmentScore}%)` : ''}
                        </div>
                        <div
                          className={`p-1.5 border ${
                            ['shortlisted', 'interviewing', 'offered', 'accepted', 'joined'].includes(opp.stage)
                              ? 'bg-slate-100 text-indigo-600 border-slate-300'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          3. Shortlisted
                        </div>
                        <div
                          className={`p-1.5 border ${
                            ['interviewing', 'offered', 'accepted', 'joined'].includes(opp.stage)
                              ? 'bg-slate-100 text-indigo-600 border-slate-300'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          4. Interview Round
                        </div>
                        <div
                          className={`p-1.5 border ${
                            ['offered', 'accepted', 'joined'].includes(opp.stage)
                              ? 'bg-indigo-600 text-white font-black'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          5. Job Offer
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

      {/* TAB 3: PROFILE & VERIFIED SKILLS */}
      {activeTab === 'passport' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Skills & Badges */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 border border-slate-300">
              <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600 mb-1">
                Verified Competencies
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 mb-4 flex items-center space-x-2">
                <span>Verified Subject & Domain Skills</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentStudent.skills.map((sk, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-slate-300 bg-white flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-slate-900 uppercase">{sk.name}</span>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-100 text-indigo-600 border border-slate-300">
                          {sk.badge} Badge
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-2 text-xs font-mono">
                        <span className="text-slate-500">Score:</span>
                        <strong className="text-indigo-600">{sk.score}% (Top {100 - sk.percentile}%)</strong>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200 text-[9px] font-mono text-slate-500 flex justify-between uppercase">
                      <span>Verified by: {sk.verifiedBy}</span>
                      <span>Date: {sk.verifiedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Projects & Academic Portfolio */}
            <div className="bg-white p-6 border border-slate-300">
              <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600 mb-1">
                Practical Work & Research
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 mb-4 flex items-center space-x-2">
                <span>Academic Projects & Research Portfolio</span>
              </h3>

              <div className="space-y-4">
                {currentStudent.projects.map((proj) => (
                  <div key={proj.id} className="p-4 border border-slate-300 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="font-mono font-bold text-sm text-slate-900 uppercase">{proj.title}</h4>
                      {proj.projectUrl && (
                        <a
                          href={proj.projectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-xs font-mono text-indigo-600 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Project / Publication</span>
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 font-sans leading-relaxed">{proj.description}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {proj.technologies.map((t, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-white text-slate-500 text-[10px] font-mono border border-slate-300">
                            {t}
                          </span>
                        ))}
                      </div>
                      {proj.verifiedScore && (
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-slate-100 px-2 py-0.5 border border-slate-300">
                          Project Evaluation Score: {proj.verifiedScore}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 space-y-4">
              <h3 className="text-base font-black uppercase text-slate-900 flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
                <span>College & Academic Details</span>
              </h3>

              <div className="text-xs font-mono space-y-2.5 text-slate-500">
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span>INSTITUTION:</span>
                  <strong className="text-slate-900 text-right">{currentStudent.institutionName}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span>DEGREE & COURSE:</span>
                  <strong className="text-slate-900 text-right">{currentStudent.program} — {currentStudent.branch}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span>GRADUATION:</span>
                  <strong className="text-slate-900">Class of {currentStudent.graduationYear}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span>CGPA:</span>
                  <strong className="text-indigo-600 font-bold">{currentStudent.cgpa} / 10.0</strong>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 border border-slate-300 space-y-4">
              <h3 className="text-base font-black uppercase text-slate-900 flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                <span>Career Preferences</span>
              </h3>

              <div className="text-xs font-mono space-y-3 text-slate-500">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block mb-1">TARGET ROLES:</span>
                  <div className="flex flex-wrap gap-1">
                    {currentStudent.preferences.targetRoles.map((r, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-indigo-600 border border-slate-300 text-[10px]">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-slate-500 block mb-1">PREFERRED CITIES:</span>
                  <div className="flex flex-wrap gap-1">
                    {currentStudent.preferences.preferredLocations.map((l, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white text-slate-900 border border-slate-300 text-[10px]">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between py-1.5 border-t border-slate-200">
                  <span>MINIMUM SALARY:</span>
                  <strong className="text-indigo-600 font-bold">₹{currentStudent.preferences.expectedSalaryMinLPA || currentStudent.preferences.minSalaryLPA} LPA</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DOMAIN SKILL ASSESSMENT LAB (ALL ACADEMIC DISCIPLINES) */}
      {activeTab === 'assessment_lab' && (
        <div className="space-y-6">
          {/* Header & Course Switcher */}
          <div className="bg-white p-6 border border-slate-300 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600 mb-1">
                  National Skill & Subject Diagnostic Lab
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center space-x-2">
                  <span>Domain Skill & Academic Evaluation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  Standardized academic evaluations for Engineering, Commerce, Management, Life Sciences, Humanities & Design
                </p>
              </div>

              {selectedAssessmentOpp && (
                <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 text-indigo-600 border border-slate-300">
                  APPLICATION: {selectedAssessmentOpp.employerName} ({selectedAssessmentOpp.role})
                </span>
              )}
            </div>

            {/* Academic Stream Tabs */}
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-500 block mb-2">
                SELECT ACADEMIC DISCIPLINE BENCHMARK:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {DOMAIN_ASSESSMENTS.map((tmpl) => (
                  <button
                    key={tmpl.domainId}
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`p-2.5 text-left border transition-all cursor-pointer ${
                      selectedAssessmentTemplate.domainId === tmpl.domainId
                        ? 'bg-slate-100 border-indigo-600 text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <div className="text-[10px] font-mono font-bold uppercase text-indigo-600 truncate">
                      {tmpl.discipline}
                    </div>
                    <div className="text-xs font-bold mt-1 line-clamp-1">
                      {tmpl.courseTitle.split('/')[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assessment Workbench */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Scenario & Question Prompt */}
            <div className="space-y-4">
              <div className="bg-white p-5 border border-slate-300 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-indigo-600">
                    {selectedAssessmentTemplate.discipline}
                  </span>
                  <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 border border-slate-300 text-slate-900">
                    ⏱ {selectedAssessmentTemplate.timeLimit}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black uppercase text-slate-900 font-mono">
                    {selectedAssessmentTemplate.assessmentName}
                  </h4>
                  <p className="text-xs text-slate-500 mt-2 font-sans leading-relaxed bg-white p-3 border border-slate-200">
                    <strong>Scenario:</strong> {selectedAssessmentTemplate.scenario}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-1">
                    EXAMINATION PROMPT & TASKS:
                  </span>
                  <pre className="text-xs text-slate-900 font-mono bg-slate-50 p-3 border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {selectedAssessmentTemplate.prompt}
                  </pre>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-2">
                    EVALUATION RUBRICS:
                  </span>
                  <div className="space-y-2">
                    {selectedAssessmentTemplate.rubrics.map((r, i) => (
                      <div key={i} className="p-2 bg-white border border-slate-200 text-xs font-mono flex items-center justify-between">
                        <span className="text-slate-600">{r.criterion}</span>
                        <span className="text-indigo-600 font-bold">{r.weight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Candidate Solution Workspace */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-50 overflow-hidden border border-slate-300">
                <div className="bg-white px-4 py-2.5 flex items-center justify-between border-b border-slate-300 text-xs font-mono">
                  <span className="text-indigo-600 font-bold">Candidate Response & Analytical Proof Worksheet</span>
                  <span className="text-[10px] bg-slate-100 text-emerald-400 px-2 py-0.5 border border-emerald-900 uppercase">
                    ● Proctored Diagnostic Active
                  </span>
                </div>

                <textarea
                  rows={14}
                  value={candidateWork}
                  onChange={(e) => setCandidateWork(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 font-mono text-xs p-4 focus:outline-none focus:ring-0 leading-relaxed border-none resize-y"
                  placeholder="Enter calculations, methodology, formulas, case analysis, or regulatory compliance breakdown..."
                />

                {diagnosticResult && (
                  <div className="p-3 bg-white border-t border-slate-300 text-xs font-mono text-indigo-600 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{diagnosticResult}</span>
                  </div>
                )}

                <div className="bg-white p-4 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
                  <button
                    onClick={handleRunDiagnostic}
                    disabled={isRunningDiagnostic}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 font-mono text-xs uppercase cursor-pointer"
                  >
                    {isRunningDiagnostic ? 'Verifying Rubrics...' : 'Verify Solution Accuracy'}
                  </button>

                  <button
                    onClick={handleCompleteAssessment}
                    disabled={isSubmittingAssessment}
                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-mono font-black uppercase text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    {isSubmittingAssessment ? (
                      <span>Validating & Recording Benchmark...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Submit & Verify Domain Benchmark Score</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PRIVACY & ACTIVITY LOG */}
      {activeTab === 'sovereignty_audit' && <DataSovereigntySettings />}

      {/* TAB 6: IN-HAND SALARY & OFFER COMPARATOR SIMULATOR */}
      {activeTab === 'salary_simulator' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white p-6 border border-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-600 flex items-center space-x-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>TRANSPARENT COMPENSATION SIMULATOR</span>
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 mt-1">
                  CTC to In-Hand Monthly Salary Calculator
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-3xl font-sans">
                  Demystify campus offer letters. See exactly what hits your bank account every month after Provident Fund (EPF), Professional Tax, Gratuity, and Income Tax (New Regime).
                </p>
              </div>

              {/* Quick load from active student opportunities */}
              {myOpportunities.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                  <span className="text-slate-500 uppercase font-bold mr-1">Load From My Drives:</span>
                  {myOpportunities.slice(0, 3).map((opp) => (
                    <button
                      key={opp.id}
                      type="button"
                      onClick={() => setSimulatedCTC(opp.salaryLPA)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-300 font-bold transition-colors cursor-pointer"
                    >
                      {opp.employerName}: ₹{opp.salaryLPA}L
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Simulator Controls */}
            <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Input Slider & Presets */}
              <div className="p-5 border border-slate-300 bg-slate-50 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-xs font-bold uppercase text-slate-700">Headline Annual CTC</span>
                    <span className="text-xl font-black font-mono text-indigo-600">₹{simulatedCTC.toFixed(1)} LPA</span>
                  </div>
                  <input
                    type="range"
                    min={3.5}
                    max={45.0}
                    step={0.5}
                    value={simulatedCTC}
                    onChange={(e) => setSimulatedCTC(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-0.5">
                    <span>₹3.5 LPA</span>
                    <span>₹20 LPA</span>
                    <span>₹45 LPA</span>
                  </div>
                </div>

                {/* Preset Chips */}
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1.5">Common Campus Bands:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[5.0, 7.5, 10.0, 14.0, 18.0, 24.0].map((ctc) => (
                      <button
                        key={ctc}
                        type="button"
                        onClick={() => setSimulatedCTC(ctc)}
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                          simulatedCTC === ctc
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        ₹{ctc}L
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tax Regime Selector */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1.5">Income Tax Regime:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setTaxRegime('new')}
                      className={`p-2 text-center border font-bold uppercase cursor-pointer ${
                        taxRegime === 'new'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      New Regime (Default)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxRegime('old')}
                      className={`p-2 text-center border font-bold uppercase cursor-pointer ${
                        taxRegime === 'old'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      Old Regime
                    </button>
                  </div>
                </div>
              </div>

              {/* Calculated Outputs */}
              {(() => {
                const totalAnnualCTC = simulatedCTC * 100000;
                const basicSalary = totalAnnualCTC * 0.50;
                const hra = totalAnnualCTC * 0.20;
                const specialAllowance = totalAnnualCTC * 0.15;
                const performanceBonus = totalAnnualCTC * 0.08;
                const gratuity = Math.round(basicSalary * 0.0481);
                const annualEPF = Math.min(basicSalary * 0.12, 21600);
                const employerEPF = annualEPF;
                const professionalTax = 2400; // ₹200/mo

                // Gross cash salary
                const grossCash = totalAnnualCTC - employerEPF - gratuity;

                // Tax Calculation under New Regime (FY 2025-26)
                const standardDeduction = 75000;
                const taxableIncome = Math.max(0, grossCash - standardDeduction);
                let annualIncomeTax = 0;

                if (taxableIncome <= 700000) {
                  annualIncomeTax = 0; // Sec 87A rebate
                } else {
                  // Slab: 3L - 7L @ 5% (20,000)
                  // Slab: 7L - 10L @ 10%
                  // Slab: 10L - 12L @ 15%
                  // Slab: 12L - 15L @ 20%
                  // Above 15L @ 30%
                  if (taxableIncome > 300000) {
                    const slab1 = Math.min(taxableIncome - 300000, 400000);
                    annualIncomeTax += slab1 * 0.05;
                  }
                  if (taxableIncome > 700000) {
                    const slab2 = Math.min(taxableIncome - 700000, 300000);
                    annualIncomeTax += slab2 * 0.10;
                  }
                  if (taxableIncome > 1000000) {
                    const slab3 = Math.min(taxableIncome - 1000000, 200000);
                    annualIncomeTax += slab3 * 0.15;
                  }
                  if (taxableIncome > 1200000) {
                    const slab4 = Math.min(taxableIncome - 1200000, 300000);
                    annualIncomeTax += slab4 * 0.20;
                  }
                  if (taxableIncome > 1500000) {
                    const slab5 = taxableIncome - 1500000;
                    annualIncomeTax += slab5 * 0.30;
                  }
                  annualIncomeTax = Math.round(annualIncomeTax * 1.04); // 4% Cess
                }

                const annualNetTakeHome = grossCash - annualEPF - professionalTax - annualIncomeTax;
                const monthlyNetTakeHome = Math.round(annualNetTakeHome / 12);

                return (
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Primary Highlight Card */}
                    <div className="p-6 bg-indigo-50 border-2 border-indigo-600 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-700 font-bold block mb-1">
                          Estimated Net Monthly Take-Home (Cash In Bank)
                        </span>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-indigo-700">
                          ₹{monthlyNetTakeHome.toLocaleString()} <span className="text-sm font-bold text-slate-500">/ mo</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 font-sans">
                          Net cash credited to your salary account on the 30th/31st of every month after all statutory deductions.
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-indigo-200 text-xs font-mono text-slate-600 flex justify-between">
                        <span>ANNUAL TAKE-HOME:</span>
                        <strong className="text-indigo-900">₹{annualNetTakeHome.toLocaleString()}</strong>
                      </div>
                    </div>

                    {/* Breakdown Matrix */}
                    <div className="p-5 border border-slate-300 bg-white font-mono text-xs space-y-2.5">
                      <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-2">
                        Monthly Salary Composition:
                      </h4>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Base Salary (Fixed):</span>
                        <strong className="text-slate-900">₹{Math.round(basicSalary / 12).toLocaleString()}</strong>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">HRA & Allowances:</span>
                        <strong className="text-slate-900">₹{Math.round((hra + specialAllowance) / 12).toLocaleString()}</strong>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Employee EPF (Provident Fund):</span>
                        <strong className="text-rose-600">-₹{Math.round(annualEPF / 12).toLocaleString()}</strong>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Monthly TDS (Income Tax):</span>
                        <strong className="text-rose-600">
                          {annualIncomeTax > 0 ? `-₹${Math.round(annualIncomeTax / 12).toLocaleString()}` : '₹0 (Rebate Under 7L)'}
                        </strong>
                      </div>

                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Professional Tax:</span>
                        <strong className="text-rose-600">-₹200</strong>
                      </div>

                      <div className="flex justify-between py-1 pt-1.5 text-slate-500 text-[10px]">
                        <span>Annual Gratuity Pool (Accrued):</span>
                        <span>₹{gratuity.toLocaleString()}/yr</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Side-by-Side Offer Comparison Engine */}
          <div className="bg-white p-6 border border-slate-300 space-y-4">
            <div className="flex items-center space-x-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-lg font-black uppercase text-slate-900 font-mono">
                  Side-by-Side Offer Evaluation Matrix
                </h3>
                <p className="text-xs text-slate-500 font-sans">
                  Compare two prospective roles across living costs, take-home pay, and net disposable savings.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Offer A */}
              <div className="p-5 border-2 border-indigo-600 bg-slate-50 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-black text-indigo-600 uppercase">Offer Scenario A</span>
                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold">Tier 1 Metro (Bengaluru)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">HEADLINE CTC:</span>
                  <strong className="text-slate-900">₹14.5 LPA</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ESTIMATED IN-HAND:</span>
                  <strong className="text-indigo-600">₹94,500 / month</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">EST. METRO RENT & LIVING:</span>
                  <span className="text-rose-600">-₹35,000 / month</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold">
                  <span className="text-slate-700">NET MONTHLY SAVINGS:</span>
                  <strong className="text-emerald-700 text-sm">₹59,500 / month</strong>
                </div>
              </div>

              {/* Offer B */}
              <div className="p-5 border border-slate-300 bg-white space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-black text-slate-900 uppercase">Offer Scenario B</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-300">Tier 2 City (Pune / Coimbatore)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">HEADLINE CTC:</span>
                  <strong className="text-slate-900">₹11.0 LPA</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ESTIMATED IN-HAND:</span>
                  <strong className="text-indigo-600">₹74,200 / month</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">EST. TIER 2 RENT & LIVING:</span>
                  <span className="text-rose-600">-₹18,000 / month</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold">
                  <span className="text-slate-700">NET MONTHLY SAVINGS:</span>
                  <strong className="text-emerald-700 text-sm">₹56,200 / month</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

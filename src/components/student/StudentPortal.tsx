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
} from 'lucide-react';
import { StudentConsentOpportunity, CampaignConsentPermission } from '../../types';
import { StageBadge } from '../common/StatusBadge';
import { StudentConsentMatrix } from './StudentConsentMatrix';
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
    defaultAnswer: `# 1. THERMAL SIZING & LMTD CALCULATION
Delta_T1 = T_hot_in - T_cold_out = 420°C - 95°C = 325°C
Delta_T2 = T_hot_out - T_cold_in = 160°C - 30°C = 130°C
LMTD = (Delta_T1 - Delta_T2) / ln(Delta_T1 / Delta_T2) = (325 - 130) / ln(325 / 130) = 212.7°C

Total Heat Duty Q = m_dot * Cp * Delta_T = 4.5 * 1.085 * (420 - 160) = 1,269.45 kW
Required Surface Area A = Q / (U * LMTD) = 1269.45 / (0.045 * 212.7) = 132.6 m²

# 2. MATERIAL SPECIFICATION & CORROSION MITIGATION
- Core Tubes: Inconel 625 / 316L Stainless Steel with passivated oxide layer to prevent sulfur-gas pitting.
- Shell Casing: SA-516 Grade 70 carbon steel with ceramic thermal barrier coating (TBC).

# 3. FATIGUE SAFETY MARGIN
- Operating allowable stress: S_allow = S_yield / 2.5 = 180 MPa.
- Finite Element Analysis (FEA) peak cyclic stress is capped at 112 MPa (Safety Factor = 1.61 against ASME Sec VIII Div 2).`,
    rubrics: [
      { criterion: 'Thermodynamic LMTD & Area Precision', weight: '35%', status: 'Verified Correct' },
      { criterion: 'Metallurgical Material Selection & Standards', weight: '35%', status: 'Meets ASME Code' },
      { criterion: 'Fatigue Margin & FEA Safety Compliance', weight: '30%', status: 'Compliant' },
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
    defaultAnswer: `# 1. DISCOUNTED CASH FLOW VALUATION (DCF)
WACC = 11.2% = 0.112
Discount Factors: Year 1 (0.8993), Year 2 (0.8087), Year 3 (0.7272), Year 4 (0.6540)
PV of FCF = (45 * 0.8993) + (58 * 0.8087) + (72 * 0.7272) + (89 * 0.6540)
PV of Forecast Period = 40.47 + 46.90 + 52.36 + 58.21 = ₹197.94 Cr

Terminal Value (TV_4) = [FCF_4 * (1 + g)] / (WACC - g)
TV_4 = [89 * 1.055] / (0.112 - 0.055) = 93.895 / 0.057 = ₹1,647.28 Cr
PV of Terminal Value = 1,647.28 * 0.6540 = ₹1,077.32 Cr
Total Enterprise Value (EV) = 197.94 + 1,077.32 = ₹1,275.26 Cr

# 2. GSTR-2B LEDGER RECONCILIATION PROTOCOL
- Execute automated 3-way match: Purchase Order vs. Vendor E-Invoice QR vs. GSTR-2B monthly table 4(A).
- Segment non-matching invoices into: (a) Timing variance (ITC eligible next cycle), (b) Vendor filing default (withhold payout), and (c) Ineligible ITC under Section 17(5).

# 3. WORKING CAPITAL STRATEGY
- Target Cash Conversion Cycle (CCC) reduction from 68 days to 48 days by implementing dynamic supplier discounting and inventory JIT buffer tracking.`,
    rubrics: [
      { criterion: 'DCF & Terminal Valuation Accuracy', weight: '40%', status: 'Exact Mathematical Match' },
      { criterion: 'Statutory GST & GSTR-2B Compliance', weight: '30%', status: 'Section 17(5) Validated' },
      { criterion: 'Working Capital & Liquidity Analysis', weight: '30%', status: 'Actionable & Robust' },
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
    defaultAnswer: `# 1. PURIFICATION PROCESS & CHROMATOGRAPHY GRADIENT
- Step 1 (Capture): Protein A affinity resin (MabSelect Sure). Equilibration buffer: 20 mM Sodium Phosphate, 150 mM NaCl, pH 7.2.
- Elution: 50 mM Glycine-HCl, pH 3.2. Immediate neutralization using 1.0 M Tris-HCl, pH 8.5.
- Step 2 (Polishing): Cation Exchange (SP Sepharose) gradient from 0 to 500 mM NaCl over 15 column volumes at pH 5.5 to remove host cell proteins (HCP) and aggregate dimers.

# 2. ANALYTICAL HPLC PURITY PROTOCOL
- Column: Size Exclusion (SEC-HPLC) TSKgel G3000SWxl (7.8 mm x 300 mm).
- Mobile Phase: 0.1 M Sodium Phosphate, 0.1 M Sodium Sulfate, 0.05% Sodium Azide, pH 6.8. Flow rate: 0.8 mL/min, Detection: UV 280 nm.
- Acceptance Criteria: Monomer Peak Area >= 98.5%, Aggregate High-Molecular-Weight impurities <= 1.0%, Resolution (Rs) > 2.0.

# 3. GMP COMPLIANCE & STERILITY VERIFICATION
- Batch documentation executed under 21 CFR Part 11 electronic records.
- 14-day membrane filtration sterility testing per Indian & US Pharmacopoeia standards with negative control broth validation.`,
    rubrics: [
      { criterion: 'Downstream Chromatography Protocol', weight: '40%', status: 'Standard Industrial Protocol' },
      { criterion: 'SEC-HPLC Analytical Rigor', weight: '35%', status: 'Meets System Suitability' },
      { criterion: 'GMP/GLP Regulatory Documentation', weight: '25%', status: 'Pharmacopoeia Validated' },
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
    defaultAnswer: `# 1. CRISIS STATEMENT: IMMEDIATE ACCOUNTABILITY & REMEDIATION
Headline: "Our Commitment to Complete Transparency and Certified Packaging Verification"
- Opening: "We hold ourselves to the highest standards of environmental integrity. In response to recent community questions regarding packaging materials, we are immediately initiating a voluntary third-party audit of our entire supply chain."
- Core Action: Withdrawing the disputed batch, partnering with an accredited environmental verifier, and creating a public weekly tracker on our website.

# 2. SPOKESPERSON BRIEFING & MEDIA TALKING POINTS
- Tone: Empathetic, factual, action-oriented. Strict avoidance of defensive or jargon-heavy phrasing.
- Key Message 1: "Transparency is our primary responsibility. We are fixing this swiftly."
- Key Message 2: "Independent audit findings will be made public within 14 business days."
- Response to aggressive question: Acknowledge the core concern directly, provide timeline of corrective steps, and offer one-on-one background access with technical leads.

# 3. INTERNAL STAKEHOLDER & EMPLOYEE ALIGNMENT
- Immediate town hall with store managers, customer support leads, and regional teams.
- Equipping customer support agents with verified FAQ cheat-sheets and escalation channels.`,
    rubrics: [
      { criterion: 'Clarity, Empathy & Ethical Posture', weight: '40%', status: 'Exemplary Tone' },
      { criterion: 'Spokesperson Strategy & Q&A Resilience', weight: '35%', status: 'High Media Fidelity' },
      { criterion: 'Multi-Stakeholder Internal Alignment', weight: '25%', status: 'Complete Alignment' },
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
    defaultAnswer: `# 1. ANTHROPOMETRIC & ERGONOMIC SPECIFICATIONS
- Handle Height Range: 780 mm to 960 mm (accommodating 5th percentile female to 95th percentile male adult heights).
- Grip Angle: 15-degree anatomical tilt with dual-density silicone padding to minimize ulnar nerve compression and arthritis strain.
- Center of Mass: Low-slung chassis with 62:38 front-to-rear weight bias ensuring stability across 15-degree slope inclines.

# 2. INTUITIVE CONTROLS & TACTILE FEEDBACK
- Dual-action brake lever: Light squeeze for proportional deceleration; downward click for instant mechanical park-lock.
- High-contrast visual indicators (Yellow/Black reflective accents) for low-light road safety.
- Single-button folding latch with tactile "audible snap" verification confirming locked state.

# 3. TESTING METHODOLOGY & ACCESSIBILITY (ISO 11199-2)
- Usability sample: 24 senior participants across varied mobility spectrums evaluating curb clearance, turning radius, and stair navigation.
- Heuristic benchmark: Zero critical safety failures, maximum fold time <= 4.5 seconds.`,
    rubrics: [
      { criterion: 'Anthropometric Ergonomic Standards', weight: '40%', status: 'ISO 11199-2 Aligned' },
      { criterion: 'Intuitive Controls & Accessibility', weight: '35%', status: 'High Usability Rating' },
      { criterion: 'Empirical User Testing Protocol', weight: '25%', status: 'Comprehensive Matrix' },
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
    'consent_matrix' | 'opportunities' | 'sovereignty_audit' | 'passport' | 'assessment_lab'
  >('consent_matrix');

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
      setDiagnosticResult('All 3 evaluation criteria verified! Solution demonstrates top-tier academic rigor, precision methodology, and industry domain compliance.');
    }, 800);
  };

  const handleCompleteAssessment = () => {
    setIsSubmittingAssessment(true);
    setTimeout(() => {
      const oppToUpdate = selectedAssessmentOpp || myOpportunities.find((o) => o.stage === 'consented' || o.stage === 'assessment_pending') || myOpportunities[0];
      if (oppToUpdate) {
        advanceCandidateStage(oppToUpdate.id, 'assessment_completed', {
          assessmentScore: 95,
        });
      }
      setIsSubmittingAssessment(false);
      setSelectedAssessmentOpp(null);
      setAssessmentDoneMsg(`Domain Skill Assessment submitted successfully! Score: 95% (Top 5th Percentile Verified) for ${selectedAssessmentTemplate.courseTitle}.`);
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
    <div className="space-y-6 pb-12 font-sans text-[#F5F5F5]">
      {/* Student Identity & Banner */}
      <div className="bg-[#111111] p-6 border border-[#333333] shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <img
              src={currentStudent.avatar}
              alt={currentStudent.name}
              className="w-16 h-16 object-cover border border-[#333333]"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black uppercase italic tracking-tight text-white">{currentStudent.name}</h1>
                
                {/* Candidate Type Badge */}
                {currentStudent.candidateType === 'independent_direct' || !currentStudent.isEmpanelledCampus ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-purple-950/80 text-purple-300 border border-purple-800">
                    <Award className="w-3 h-3 mr-1" />
                    INDEPENDENT DIRECT CANDIDATE
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#222222] text-[#CCFF00] border border-[#333333]">
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

              <p className="text-xs font-mono text-[#888888] mt-1.5 flex flex-wrap items-center gap-2">
                <span className="uppercase text-white font-bold">{currentStudent.program} — {currentStudent.branch}</span>
                <span>//</span>
                <span>Class of {currentStudent.graduationYear}</span>
                <span>//</span>
                <span className="text-[#CCFF00]">{currentStudent.institutionName}</span>
                <span>//</span>
                <span>Ref / Roll: <strong className="text-white">{currentStudent.rollNumber || currentStudent.id}</strong></span>
                <span>//</span>
                <span>CGPA: <strong className="text-[#CCFF00]">{currentStudent.cgpa} / 10.0</strong></span>
              </p>
            </div>
          </div>

          {/* Student Availability Status */}
          <div className="bg-[#181818] p-3 border border-[#333333] text-xs font-mono">
            <span className="text-[10px] uppercase text-[#888888] block mb-1">PLACEMENT STATUS:</span>
            <select
              value={currentStudent.availability}
              onChange={(e) => updateStudentAvailability(currentStudent.id, e.target.value as any)}
              aria-label="Placement Availability"
              className="w-full bg-[#111111] text-white font-bold text-xs px-2.5 py-1.5 border border-[#333333] focus:border-[#CCFF00] focus:outline-none cursor-pointer"
            >
              <option value="actively_seeking">🟢 Actively Looking for Campus Jobs</option>
              <option value="open_to_offers">🟡 Open to Opportunities</option>
              <option value="not_currently_available">🔴 Placed / Not Seeking</option>
            </select>
          </div>
        </div>

        {/* Student Navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-[#222222] flex flex-wrap gap-2">
          <button
            id="tab-consent-matrix"
            onClick={() => setActiveTab('consent_matrix')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'consent_matrix'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>1. Employer Permissions & Consent</span>
            {pendingInvitations.length > 0 && (
              <span className="px-1.5 py-0.2 bg-black text-[#CCFF00] font-bold text-[10px] ml-1">
                {pendingInvitations.length} Pending
              </span>
            )}
          </button>

          <button
            id="tab-opportunities"
            onClick={() => setActiveTab('opportunities')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'opportunities'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>2. Applications & Hiring Rounds</span>
            {activeApplications.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#222222] text-white font-bold text-[10px] ml-1 border border-[#333333]">
                {activeApplications.length}
              </span>
            )}
          </button>

          <button
            id="tab-passport"
            onClick={() => setActiveTab('passport')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'passport'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
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
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
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
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>5. Privacy & Data Audit Log</span>
          </button>
        </div>
      </div>

      {assessmentDoneMsg && (
        <div className="bg-[#181818] border-l-4 border-[#CCFF00] border-y border-r border-[#333333] text-white px-4 py-3 flex items-center space-x-2 text-xs font-mono font-bold">
          <CheckCircle2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
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
            <div className="bg-[#181818] border-l-4 border-l-[#CCFF00] border-[#333333] p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-[#CCFF00]" />
                <h3 className="text-sm font-black uppercase text-white font-mono">
                  New Campus Drive Invitations (Your Action Needed)
                </h3>
              </div>
              <p className="text-xs text-[#888888] font-sans">
                Your college verified your eligibility for these drives. Review role requirements and choose whether to apply.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingInvitations.map((opp) => (
                  <div key={opp.id} className="p-4 bg-[#111111] border border-[#333333] space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-black text-sm uppercase text-white">{opp.employerName}</h4>
                        <p className="text-xs font-mono text-[#CCFF00]">{opp.role}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-[#222222] text-[#CCFF00] text-[10px] font-mono font-bold border border-[#333333]">
                        {opp.matchScore}% Match
                      </span>
                    </div>

                    <div className="text-xs font-mono text-[#888888] space-y-1">
                      <div>Package: <strong className="text-white">₹{opp.salaryLPA} LPA</strong></div>
                      <div>Location: <strong className="text-white">{opp.locations.join(', ')}</strong></div>
                      <div>Joining: <strong className="text-white">{opp.joiningWindow}</strong></div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t border-[#222222]">
                      <button
                        onClick={() => setActiveTab('consent_matrix')}
                        className="w-full py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs transition-all text-center cursor-pointer"
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
          <div className="bg-[#111111] p-6 border border-[#333333] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>My Active Campus Applications ({activeApplications.length})</span>
                </h3>
                <p className="text-xs text-[#888888] mt-0.5 font-sans">
                  Track your evaluation stages, assessment scores, and job offers
                </p>
              </div>
            </div>

            {activeApplications.length === 0 ? (
              <div className="p-8 text-center bg-[#141414] border border-[#222222] text-xs font-mono text-[#888888]">
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
                          ? 'bg-[#181818] border-[#CCFF00]'
                          : isJoined
                          ? 'bg-[#181818] border-l-4 border-l-[#CCFF00] border-[#333333]'
                          : 'bg-[#141414] border-[#222222]'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-base uppercase text-white">{opp.employerName}</span>
                            <StageBadge stage={opp.stage} />
                          </div>
                          <h4 className="text-xs font-mono font-bold text-[#CCFF00] uppercase mt-1">{opp.role}</h4>
                          <p className="text-xs font-mono text-[#888888] mt-1">
                            Salary: <strong className="text-white">₹{opp.salaryLPA} LPA</strong> // Locations: {opp.locations.join(', ')}
                          </p>
                        </div>

                        {/* Interactive Action */}
                        <div className="flex items-center space-x-2">
                          {isAssessmentPending && (
                            <button
                              onClick={() => handleLaunchAssessment(opp)}
                              className="px-4 py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Take Subject Assessment</span>
                            </button>
                          )}

                          {isOffered && (
                            <button
                              id="accept-offer-btn"
                              onClick={() => handleAcceptOffer(opp)}
                              className="px-5 py-2.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Accept Job Offer & Confirm Placement</span>
                            </button>
                          )}

                          {isJoined && (
                            <span className="px-3 py-1.5 bg-[#222222] text-[#CCFF00] font-mono font-bold uppercase text-xs flex items-center space-x-1 border border-[#333333]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Offer Accepted & Placed</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Recruitment Step Progress Bar */}
                      <div className="mt-4 pt-3 border-t border-[#222222] grid grid-cols-5 gap-2 text-center text-[10px] font-mono font-bold uppercase">
                        <div className="p-1.5 bg-[#222222] text-[#CCFF00] border border-[#333333]">
                          1. Opted-In ✓
                        </div>
                        <div
                          className={`p-1.5 border ${
                            opp.stage !== 'consented' && opp.stage !== 'invited'
                              ? 'bg-[#222222] text-[#CCFF00] border-[#333333]'
                              : 'bg-[#181818] text-[#666666] border-[#222222]'
                          }`}
                        >
                          2. Assessment {opp.assessmentScore ? `(${opp.assessmentScore}%)` : ''}
                        </div>
                        <div
                          className={`p-1.5 border ${
                            ['shortlisted', 'interviewing', 'offered', 'accepted', 'joined'].includes(opp.stage)
                              ? 'bg-[#222222] text-[#CCFF00] border-[#333333]'
                              : 'bg-[#181818] text-[#666666] border-[#222222]'
                          }`}
                        >
                          3. Shortlisted
                        </div>
                        <div
                          className={`p-1.5 border ${
                            ['interviewing', 'offered', 'accepted', 'joined'].includes(opp.stage)
                              ? 'bg-[#222222] text-[#CCFF00] border-[#333333]'
                              : 'bg-[#181818] text-[#666666] border-[#222222]'
                          }`}
                        >
                          4. Interview Round
                        </div>
                        <div
                          className={`p-1.5 border ${
                            ['offered', 'accepted', 'joined'].includes(opp.stage)
                              ? 'bg-[#CCFF00] text-black font-black'
                              : 'bg-[#181818] text-[#666666] border-[#222222]'
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
            <div className="bg-[#111111] p-6 border border-[#333333]">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00] mb-1">
                Verified Competencies
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white mb-4 flex items-center space-x-2">
                <span>Verified Subject & Domain Skills</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentStudent.skills.map((sk, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-[#333333] bg-[#181818] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-white uppercase">{sk.name}</span>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#222222] text-[#CCFF00] border border-[#333333]">
                          {sk.badge} Badge
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-2 text-xs font-mono">
                        <span className="text-[#888888]">Score:</span>
                        <strong className="text-[#CCFF00]">{sk.score}% (Top {100 - sk.percentile}%)</strong>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#282828] text-[9px] font-mono text-[#888888] flex justify-between uppercase">
                      <span>Verified by: {sk.verifiedBy}</span>
                      <span>Date: {sk.verifiedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Projects & Academic Portfolio */}
            <div className="bg-[#111111] p-6 border border-[#333333]">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00] mb-1">
                Practical Work & Research
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white mb-4 flex items-center space-x-2">
                <span>Academic Projects & Research Portfolio</span>
              </h3>

              <div className="space-y-4">
                {currentStudent.projects.map((proj) => (
                  <div key={proj.id} className="p-4 border border-[#333333] bg-[#181818]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="font-mono font-bold text-sm text-white uppercase">{proj.title}</h4>
                      {proj.projectUrl && (
                        <a
                          href={proj.projectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-xs font-mono text-[#CCFF00] hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Project / Publication</span>
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-[#CCCCCC] mt-1.5 font-sans leading-relaxed">{proj.description}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {proj.technologies.map((t, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-[#111111] text-[#AAAAAA] text-[10px] font-mono border border-[#333333]">
                            {t}
                          </span>
                        ))}
                      </div>
                      {proj.verifiedScore && (
                        <span className="text-xs font-mono font-bold text-[#CCFF00] bg-[#222222] px-2 py-0.5 border border-[#333333]">
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
            <div className="bg-[#111111] p-6 border border-[#333333] space-y-4">
              <h3 className="text-base font-black uppercase text-white flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-[#CCFF00]" />
                <span>College & Academic Details</span>
              </h3>

              <div className="text-xs font-mono space-y-2.5 text-[#888888]">
                <div className="flex justify-between py-1.5 border-b border-[#222222]">
                  <span>INSTITUTION:</span>
                  <strong className="text-white text-right">{currentStudent.institutionName}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#222222]">
                  <span>DEGREE & COURSE:</span>
                  <strong className="text-white text-right">{currentStudent.program} — {currentStudent.branch}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#222222]">
                  <span>GRADUATION:</span>
                  <strong className="text-white">Class of {currentStudent.graduationYear}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#222222]">
                  <span>CGPA:</span>
                  <strong className="text-[#CCFF00] font-bold">{currentStudent.cgpa} / 10.0</strong>
                </div>
              </div>
            </div>

            <div className="bg-[#111111] p-6 border border-[#333333] space-y-4">
              <h3 className="text-base font-black uppercase text-white flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-[#CCFF00]" />
                <span>Career Preferences</span>
              </h3>

              <div className="text-xs font-mono space-y-3 text-[#888888]">
                <div>
                  <span className="text-[10px] uppercase text-[#888888] block mb-1">TARGET ROLES:</span>
                  <div className="flex flex-wrap gap-1">
                    {currentStudent.preferences.targetRoles.map((r, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[#222222] text-[#CCFF00] border border-[#333333] text-[10px]">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-[#888888] block mb-1">PREFERRED CITIES:</span>
                  <div className="flex flex-wrap gap-1">
                    {currentStudent.preferences.preferredLocations.map((l, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[#181818] text-white border border-[#333333] text-[10px]">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between py-1.5 border-t border-[#222222]">
                  <span>MINIMUM SALARY:</span>
                  <strong className="text-[#CCFF00] font-bold">₹{currentStudent.preferences.expectedSalaryMinLPA || currentStudent.preferences.minSalaryLPA} LPA</strong>
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
          <div className="bg-[#111111] p-6 border border-[#333333] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#222222]">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00] mb-1">
                  National Skill & Subject Diagnostic Lab
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>Domain Skill & Academic Evaluation</span>
                </h3>
                <p className="text-xs text-[#888888] mt-0.5 font-sans">
                  Standardized academic evaluations for Engineering, Commerce, Management, Life Sciences, Humanities & Design
                </p>
              </div>

              {selectedAssessmentOpp && (
                <span className="text-xs font-mono font-bold px-3 py-1 bg-[#222222] text-[#CCFF00] border border-[#333333]">
                  APPLICATION: {selectedAssessmentOpp.employerName} ({selectedAssessmentOpp.role})
                </span>
              )}
            </div>

            {/* Academic Stream Tabs */}
            <div>
              <span className="text-[10px] font-mono uppercase text-[#888888] block mb-2">
                SELECT ACADEMIC DISCIPLINE BENCHMARK:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {DOMAIN_ASSESSMENTS.map((tmpl) => (
                  <button
                    key={tmpl.domainId}
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`p-2.5 text-left border transition-all cursor-pointer ${
                      selectedAssessmentTemplate.domainId === tmpl.domainId
                        ? 'bg-[#222222] border-[#CCFF00] text-white'
                        : 'bg-[#141414] border-[#282828] text-[#888888] hover:text-white'
                    }`}
                  >
                    <div className="text-[10px] font-mono font-bold uppercase text-[#CCFF00] truncate">
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
              <div className="bg-[#111111] p-5 border border-[#333333] space-y-4">
                <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-[#CCFF00]">
                    {selectedAssessmentTemplate.discipline}
                  </span>
                  <span className="text-[10px] font-mono bg-[#222222] px-2 py-0.5 border border-[#333333] text-white">
                    ⏱ {selectedAssessmentTemplate.timeLimit}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black uppercase text-white font-mono">
                    {selectedAssessmentTemplate.assessmentName}
                  </h4>
                  <p className="text-xs text-[#AAAAAA] mt-2 font-sans leading-relaxed bg-[#181818] p-3 border border-[#282828]">
                    <strong>Scenario:</strong> {selectedAssessmentTemplate.scenario}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#888888] block mb-1">
                    EXAMINATION PROMPT & TASKS:
                  </span>
                  <pre className="text-xs text-white font-mono bg-[#141414] p-3 border border-[#222222] whitespace-pre-wrap leading-relaxed">
                    {selectedAssessmentTemplate.prompt}
                  </pre>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#888888] block mb-2">
                    EVALUATION RUBRICS:
                  </span>
                  <div className="space-y-2">
                    {selectedAssessmentTemplate.rubrics.map((r, i) => (
                      <div key={i} className="p-2 bg-[#181818] border border-[#282828] text-xs font-mono flex items-center justify-between">
                        <span className="text-[#CCCCCC]">{r.criterion}</span>
                        <span className="text-[#CCFF00] font-bold">{r.weight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Candidate Solution Workspace */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-[#0A0A0A] overflow-hidden border border-[#333333]">
                <div className="bg-[#181818] px-4 py-2.5 flex items-center justify-between border-b border-[#333333] text-xs font-mono">
                  <span className="text-[#CCFF00] font-bold">Candidate Response & Analytical Proof Worksheet</span>
                  <span className="text-[10px] bg-[#222222] text-emerald-400 px-2 py-0.5 border border-emerald-900 uppercase">
                    ● Proctored Diagnostic Active
                  </span>
                </div>

                <textarea
                  rows={14}
                  value={candidateWork}
                  onChange={(e) => setCandidateWork(e.target.value)}
                  className="w-full bg-[#0A0A0A] text-[#F5F5F5] font-mono text-xs p-4 focus:outline-none focus:ring-0 leading-relaxed border-none resize-y"
                  placeholder="Enter calculations, methodology, formulas, case analysis, or regulatory compliance breakdown..."
                />

                {diagnosticResult && (
                  <div className="p-3 bg-[#181818] border-t border-[#333333] text-xs font-mono text-[#CCFF00] flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{diagnosticResult}</span>
                  </div>
                )}

                <div className="bg-[#181818] p-4 border-t border-[#333333] flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
                  <button
                    onClick={handleRunDiagnostic}
                    disabled={isRunningDiagnostic}
                    className="w-full sm:w-auto px-4 py-2 bg-[#222222] hover:bg-[#2c2c2c] text-white border border-[#333333] font-mono text-xs uppercase cursor-pointer"
                  >
                    {isRunningDiagnostic ? 'Verifying Rubrics...' : 'Verify Solution Accuracy'}
                  </button>

                  <button
                    onClick={handleCompleteAssessment}
                    disabled={isSubmittingAssessment}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#CCFF00] hover:bg-[#b8e600] disabled:opacity-50 text-black font-mono font-black uppercase text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
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
    </div>
  );
};

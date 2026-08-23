import React, { useState } from 'react';
import { 
  Building2, 
  School, 
  GraduationCap, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Lock, 
  FileText, 
  Sparkles, 
  TrendingUp, 
  BarChart3, 
  Users, 
  Search, 
  Award, 
  Clock, 
  Target, 
  ChevronDown, 
  ChevronRight, 
  Scale, 
  Globe, 
  Database, 
  Key, 
  HelpCircle, 
  Check, 
  Briefcase, 
  Calendar, 
  Zap,
  Cpu,
  Fingerprint,
  FileCheck2,
  Sliders,
  ShieldAlert,
  Compass
} from 'lucide-react';
import { UserRole } from '../../types';

interface LandingPageProps {
  onSelectAuth: (isLogin: boolean, role?: 'student' | 'institution' | 'employer') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectAuth }) => {
  const [activeRoleTab, setActiveRoleTab] = useState<'employer' | 'institution' | 'student' | 'admin'>('employer');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [activeLifecycleStep, setActiveLifecycleStep] = useState<number>(0);

  const stakeholderWorkflows = {
    employer: {
      roleTitle: 'Enterprise Employers & Talent Acquisition',
      roleBadge: 'Corporate Recruitment OS',
      icon: Building2,
      accentColor: 'indigo',
      summary: 'Eliminate recruiting fatigue, credential inflation, and post-offer dropouts through deterministic campus matching and auditable candidate consent.',
      steps: [
        {
          number: '01',
          title: 'Define Verified Hiring Requirements',
          description: 'Specify branch disciplines, minimum CGPA criteria, required technical competencies, location mobility, and clear CTC salary bands.',
          deliverable: 'Standardized Demand Matrix with automated eligibility filters'
        },
        {
          number: '02',
          title: 'Deterministic Campus & Supply Matching',
          description: 'The engine evaluates supply inventory across empanelled universities and independent talent without subjective biases or random seeds.',
          deliverable: 'Ranked institutional cohorts & candidate compatibility scorecards'
        },
        {
          number: '03',
          title: 'Broadcast Targeted Calls for Talent',
          description: 'Issue direct recruitment calls to specific university TPO offices or launch open national talent discovery campaigns.',
          deliverable: 'Official Institutional Call-for-Talent token with reservation quota'
        },
        {
          number: '04',
          title: 'Review Consented Candidate Dossiers',
          description: 'Access student career passports only after candidates have explicitly reviewed and granted consent to your compensation package.',
          deliverable: 'DPDP-compliant, unredacted verified candidate dossiers'
        },
        {
          number: '05',
          title: 'Evaluate, Interview & Issue Digital Offers',
          description: 'Conduct proctored diagnostic evaluations, log multi-stage interview results, and release tamper-proof digital offer letters with real-time acceptance tracking.',
          deliverable: 'Auditable joining pipeline with guaranteed candidate commitment tracking'
        }
      ],
      benefits: [
        { title: '70% Reduction in Campus Cycle Time', desc: 'Eliminate weeks of manual resume parsing and cold TPO coordination with automated matching.' },
        { title: '100% Verified Credentials', desc: 'TPO-certified marksheets, roll numbers, and proctored technical diagnostic scores.' },
        { title: 'Zero Unsolicited Data Liability', desc: 'Operate in full compliance with the Digital Personal Data Protection (DPDP) Act 2023.' },
        { title: 'Predictable Joining Conversion', desc: 'Track candidate offer acceptance in real-time, preventing last-minute cohort ghosting.' }
      ],
      ctaText: 'Register as Enterprise Employer',
      authRole: 'employer' as const
    },
    institution: {
      roleTitle: 'Academic Institutions & Placement Cells (TPOs)',
      roleBadge: 'University Placement OS',
      icon: School,
      accentColor: 'emerald',
      summary: 'Empower placement officers to digitize student batch registries, verify academic records, and attract marquee enterprise campus drives with full auditability.',
      steps: [
        {
          number: '01',
          title: 'Institutional Empanelment & Profile Setup',
          description: 'Empanel your college or university with official NIRF/NAAC accreditation, AISHE registration, and Placement Cell authorization.',
          deliverable: 'Verified Institutional Node with verified TPO signing authority'
        },
        {
          number: '02',
          title: 'Enrol Student Cohorts & Discipline Inventories',
          description: 'Import student rosters across Engineering, Commerce, Management, Sciences, Arts, and Healthcare departments.',
          deliverable: 'Structured digital batch inventory with real-time availability counts'
        },
        {
          number: '03',
          title: 'Authenticate Academic Transcripts & Roll Records',
          description: 'Review and certify student CGPA, backlogs, academic standing, and disciplinary clearance with official TPO digital stamps.',
          deliverable: 'Institutionally Certified Student Career Passports'
        },
        {
          number: '04',
          title: 'Receive & Manage Corporate Talent Calls',
          description: 'Evaluate incoming corporate drive proposals, review offered salary bands, and allocate student batches with one-click approval.',
          deliverable: 'Structured drive schedule with clear campus eligibility parameters'
        },
        {
          number: '05',
          title: 'Monitor Drive Analytics & Placement Governance',
          description: 'Track candidate shortlists, interview progress, offer releases, and formal joining agreements from a central institutional dashboard.',
          deliverable: 'Comprehensive placement reports ready for NAAC/NIRF accreditation filings'
        }
      ],
      benefits: [
        { title: 'Marquee Corporate Empanelment', desc: 'Direct discovery by pan-India enterprises seeking certified talent in your academic disciplines.' },
        { title: 'Zero Spreadsheet Chaos', desc: 'Replace fragile Excel rosters and scattered WhatsApp groups with an integrated recruitment operating system.' },
        { title: 'Automated Accreditation Reporting', desc: 'Generate verified placement records, median CTC benchmarks, and employer audit logs in one click.' },
        { title: 'Protected Student Privacy', desc: 'Ensure no external recruiter accesses student phone numbers or personal records without student consent.' }
      ],
      ctaText: 'Empanel Your Institution',
      authRole: 'institution' as const
    },
    student: {
      roleTitle: 'Students, Graduates & Direct Candidates',
      roleBadge: 'Career Passport & Data Sovereignty',
      icon: GraduationCap,
      accentColor: 'blue',
      summary: 'Build a verifiable Career Passport, take standardized diagnostic skill assessments, and control exactly which employers access your personal data.',
      steps: [
        {
          number: '01',
          title: 'Create Verified Student Career Passport',
          description: 'Enrol via your empanelled university or join as an independent candidate. Link your academic stream, graduation year, and career aspirations.',
          deliverable: 'Sovereign digital identity with secure cryptographic ID'
        },
        {
          number: '02',
          title: 'Complete Proctored Diagnostic Skill Benchmarks',
          description: 'Validate your core technical, domain, and analytical competencies in standardized subject diagnostic labs to earn verified badges.',
          deliverable: 'Objective competency scorecards recognized across all platform employers'
        },
        {
          number: '03',
          title: 'Configure Granular Data Sovereignty Settings',
          description: 'Define your salary threshold, anonymize personal contact details, and dictate which recruiter categories can request your profile.',
          deliverable: '3-Layer Privacy Shield protecting phone, email, and academic transcripts'
        },
        {
          number: '04',
          title: 'Receive & Review Curated Campus Opportunities',
          description: 'Review incoming hiring demands matched specifically to your skill benchmark, degree discipline, and minimum compensation expectations.',
          deliverable: 'Full transparency into job role, location, CTC breakdown, and hiring timeline'
        },
        {
          number: '05',
          title: 'Grant Explicit Consent & Accept Digital Offers',
          description: 'Approve recruiter access to your dossier, attend scheduled interviews, and sign digital offer letters securely within the platform.',
          deliverable: 'Tamper-proof digital employment offer with guaranteed joining verification'
        }
      ],
      benefits: [
        { title: '100% Data Privacy & Control', desc: 'No unsolicited headhunter calls or data reselling. You explicitly authorize every employer dossier request.' },
        { title: 'Meritocratic Pan-India Exposure', desc: 'Compete on verified competency diagnostics rather than college brand names or superficial resume keywords.' },
        { title: 'Real Compensation Transparency', desc: 'Filter out substandard drives by setting strict minimum CTC thresholds in your privacy matrix.' },
        { title: 'Official Institutional Endorsement', desc: 'Showcase verified university credentials and diagnostic assessment badges that recruiters trust.' }
      ],
      ctaText: 'Create Your Career Passport',
      authRole: 'student' as const
    },
    admin: {
      roleTitle: 'Platform Governance & Super Administrators',
      roleBadge: 'Ecosystem Trust & Compliance',
      icon: ShieldCheck,
      accentColor: 'slate',
      summary: 'Maintain network integrity through rigorous business verification, institutional credential audits, and real-time security enforcement.',
      steps: [
        {
          number: '01',
          title: 'Employer Business Verification',
          description: 'Audit Corporate Identification Numbers (CIN), GSTIN certificates, and official career domains to eliminate fraudulent job postings.',
          deliverable: 'Verified Corporate Trust Badge with locked reputation metrics'
        },
        {
          number: '02',
          title: 'Institutional Accreditation Audit',
          description: 'Verify AISHE IDs, NAAC ratings, NIRF rankings, and placement officer credentials before granting campus drive broadcast rights.',
          deliverable: 'Accredited Institutional Node status with student batch provisioning'
        },
        {
          number: '03',
          title: 'Assessment Rubric & Integrity Monitoring',
          description: 'Maintain standardized diagnostic test item banks, proctoring security logs, and deterministic scoring models.',
          deliverable: 'Calibrated diagnostic evaluation framework across engineering and allied domains'
        },
        {
          number: '04',
          title: 'Audit Trail & DPDP Compliance Enforcement',
          description: 'Monitor cross-tenant data requests, consent grant logs, and cryptographic access tokens to guarantee regulatory compliance.',
          deliverable: 'Comprehensive compliance and data sovereignty audit trails'
        },
        {
          number: '05',
          title: 'Ecosystem Analytics & Supply Balancing',
          description: 'Track aggregate talent demand versus institutional graduation cohorts across all Indian states and academic specializations.',
          deliverable: 'Macroeconomic campus employment index and talent flow insights'
        }
      ],
      benefits: [
        { title: 'Zero-Tolerance Anti-Fraud Architecture', desc: 'Multi-layer administrative gates prevent ghost employers, fake colleges, and fabricated candidate portfolios.' },
        { title: 'End-to-End Auditability', desc: 'Every requirement, consent grant, assessment score, and offer letter is permanently logged.' },
        { title: 'Role-Based Access Enforcement', desc: 'Strict Firestore security rules lock immutable fields and enforce tenant isolation.' },
        { title: 'National Scale Infrastructure', desc: 'Architected to handle multi-stream university ecosystems across millions of active candidates.' }
      ],
      ctaText: 'Access Administrative Portal',
      authRole: undefined
    }
  };

  const lifecycleStages = [
    {
      step: '01',
      title: 'Demand Publication',
      actor: 'Enterprise Employer',
      badge: 'Demand-Side Token',
      description: 'Corporate HR registers hiring requirements with explicit technical rubrics, CTC bands (e.g. ₹8 - ₹16 LPA), eligibility cutoffs, and vacancy allocations.',
      safeguard: 'Zero ambiguous job specs; salary bands and skill requirements are locked and validated.'
    },
    {
      step: '02',
      title: 'Deterministic Matching',
      actor: 'NexusTalent Matching Engine',
      badge: 'Multi-Parametric Filter',
      description: 'The engine evaluates 7 deterministic parameters (Skills, Degree Discipline, CGPA, Cohort, Location, Compensation, Work Authorization) without random seeds.',
      safeguard: 'Mathematical compatibility calculation ensures pure meritocracy.'
    },
    {
      step: '03',
      title: 'Institutional Call Routing',
      actor: 'University Placement Office (TPO)',
      badge: 'Campus Empanelment',
      description: 'The demand is routed directly to empanelled university TPOs or broadcast to verified independent talent pools for batch nomination.',
      safeguard: 'TPO verifies academic standing, backlogs, and departmental eligibility.'
    },
    {
      step: '04',
      title: 'Candidate Review & Consent Gate',
      actor: 'Student Candidate',
      badge: 'DPDP Sovereignty Gate',
      description: 'Students review the drive terms, role expectations, and compensation before explicitly authorizing the employer to view their full unredacted passport.',
      safeguard: 'No personal contact information is exposed without candidate affirmative consent.'
    },
    {
      step: '05',
      title: 'Diagnostic Lab & Interview Rounds',
      actor: 'Recruiter & Candidate',
      badge: 'Proctored Assessment',
      description: 'Candidates undertake proctored domain diagnostics. Recruiters track candidate progress through shortlisting, technical tests, and interviews in real time.',
      safeguard: 'Standardized assessment rubrics prevent interviewer bias.'
    },
    {
      step: '06',
      title: 'Offer Release & Joining Audit',
      actor: 'Tripartite (Employer ↔ TPO ↔ Student)',
      badge: 'Encrypted Offer Token',
      description: 'Employer releases the official digital offer letter. Student signs acceptance within the portal. Placement Office records the verified hire.',
      safeguard: 'Real-time joining tracking eliminates post-offer dropouts and multi-offer holding abuse.'
    }
  ];

  const faqs = [
    {
      q: 'How does NexusTalent OS guarantee student data privacy under the DPDP Act 2023?',
      a: 'NexusTalent implements a strict 3-Layer Data Sovereignty architecture. Initial candidate discovery shows only anonymized competency badges, branch discipline, and graduation year. A recruiter cannot view a student\'s phone number, email address, roll number, or detailed academic transcript until the student explicitly reviews the employer\'s drive proposal and clicks "Grant Consent". Every consent event is timestamped and recorded in an immutable audit trail.'
    },
    {
      q: 'How does the platform prevent credential inflation and fake resumes?',
      a: 'All academic credentials (CGPA, enrollment status, roll numbers) are directly verified and digitally stamped by the empanelled university\'s Training & Placement Officer (TPO). In addition, skill badges are awarded through standardized, proctored subject diagnostic labs and verified code repositories—completely eliminating fabricated self-reported skills.'
    },
    {
      q: 'What makes the NexusTalent matching engine deterministic?',
      a: 'Unlike traditional black-box platforms that use randomized recommendation loops or marketing bids, NexusTalent uses a transparent 7-parameter compatibility matrix: (1) Verified Skill Alignment, (2) Branch/Discipline Qualification, (3) Minimum CGPA Cutoff, (4) Graduation Year Cohort, (5) Candidate Location Preferences, (6) Minimum Compensation Expectations, and (7) Availability Status. The exact same inputs will always produce the exact same compatibility score.'
    },
    {
      q: 'Can independent candidates from non-empanelled colleges participate?',
      a: 'Yes. Independent students can register directly on the platform by submitting government-recognized academic credentials and completing the Platform Diagnostic Benchmark. Their profiles are clearly categorized as "Direct Verified Candidate", giving them equal access to national hiring campaigns without requiring an active campus TPO agreement.'
    },
    {
      q: 'How do Academic Institutions (TPOs) benefit from empanelment?',
      a: 'Empanelled institutions gain a centralized placement management system that replaces manual Excel sheets, automated batch eligibility filters, digital verification workflows, and one-click compliance reports for NAAC, NIRF, and NBA accreditation filings. Furthermore, their students gain immediate visibility to pan-India enterprise recruiters.'
    },
    {
      q: 'How are employer corporate credentials verified on the platform?',
      a: 'Every enterprise employer must submit a valid Corporate Identification Number (CIN) or Goods and Services Tax Identification Number (GSTIN), an official corporate domain email, and executive point-of-contact credentials. Our administrative compliance team audits every organization prior to unlocking talent outreach capabilities.'
    }
  ];

  const currentTab = stakeholderWorkflows[activeRoleTab];
  const CurrentIcon = currentTab.icon;

  return (
    <div className="w-full bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-950">
      
      {/* Top Formal Announcement / Compliance Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs font-mono py-2.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-900/80 text-indigo-300 border border-indigo-700/50">
              DPDP ACT 2023 COMPLIANT
            </span>
            <span className="text-slate-400 text-xs hidden md:inline">
              Multi-Tenant Operating Infrastructure for Indian Higher Education & Corporate Campus Hiring
            </span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span className="flex items-center text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              Deterministic Matching v4.2
            </span>
            <span className="text-slate-700">|</span>
            <span>TPO Academic Verification Protocol</span>
          </div>
        </div>
      </div>

      {/* Navigation Header */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg font-black flex items-center justify-center text-lg tracking-tighter shadow-sm">
              NT
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-slate-900 text-base tracking-tight uppercase">NexusTalent OS</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">ENTERPRISE</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">National Campus & Talent Exchange Network</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-8 text-xs font-semibold text-slate-600">
            <a href="#why-nexustalent" className="hover:text-indigo-600 transition-colors">The Critical Need</a>
            <a href="#stakeholders" className="hover:text-indigo-600 transition-colors">Stakeholder Workflows</a>
            <a href="#core-engine" className="hover:text-indigo-600 transition-colors">Matching & Privacy Engine</a>
            <a href="#lifecycle" className="hover:text-indigo-600 transition-colors">Recruitment Lifecycle</a>
            <a href="#faq" className="hover:text-indigo-600 transition-colors">Standards & FAQ</a>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onSelectAuth(true)}
              className="text-xs font-bold text-slate-700 hover:text-indigo-600 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-all shadow-2xs cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => onSelectAuth(false)}
              className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-slate-200 bg-gradient-to-b from-white via-slate-50/50 to-slate-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100/80 px-3.5 py-1.5 rounded-full mb-6 text-xs font-semibold text-indigo-700">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Unified Sovereign Recruitment Architecture</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12] mb-6">
              The National Digital Infrastructure for <br className="hidden sm:inline" />
              <span className="text-indigo-600">Verified Campus Placement</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10">
              A single, secure operating ecosystem connecting Enterprises, University Placement Cells (TPOs), and Students. Eliminating hiring fraud, unverified credentials, and fragmented spreadsheets with deterministic matching and auditable data sovereignty.
            </p>

            {/* Main Role Launchpads */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-12">
              <div 
                onClick={() => onSelectAuth(false, 'employer')}
                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">For Employers</h3>
                  <p className="text-xs text-slate-500 leading-normal">Hire verified graduates with deterministic matching & zero dropouts.</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Start Hiring</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              <div 
                onClick={() => onSelectAuth(false, 'institution')}
                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <School className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">For Institutions</h3>
                  <p className="text-xs text-slate-500 leading-normal">Empanel your campus, verify rosters, and attract corporate drives.</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Empanel Campus</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              <div 
                onClick={() => onSelectAuth(false, 'student')}
                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">For Students</h3>
                  <p className="text-xs text-slate-500 leading-normal">Build a verified career passport with 100% DPDP data sovereignty.</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Create Passport</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            </div>

            {/* Key Trust Pillars */}
            <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-medium text-slate-600">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Deterministic 7-Parameter Matching</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>TPO Digital Academic Authentication</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>DPDP Act 2023 Consent Gates</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero Fake Mock / Fabricated Data</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Section 1: The Urgent Need for NexusTalent OS (The Problem & The Remedy) */}
      <section id="why-nexustalent" className="py-16 lg:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-100">
              THE STRATEGIC IMPERATIVE
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3 mb-4">
              Why Campus Hiring Requires a Sovereign Operating System
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              Traditional campus placement in India is crippled by information asymmetry, unverified resumes, manual placement office spreadsheets, and uncontrolled student data harvesting.
            </p>
          </div>

          {/* 4 Pillars of Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">1. Credential Inflation & Unverified Claims</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    Self-reported resumes contain fabricated projects, inflated CGPAs, and exaggerated skill claims. Technical interviewers waste up to 60% of their screening bandwidth filtering out unqualified applicants.
                  </p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-indigo-900 font-medium">
                    <strong className="text-indigo-600">NexusTalent Fix:</strong> Every academic score is TPO-authenticated; technical competencies are verified through standardized, proctored subject diagnostic labs.
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">2. Manual TPO Spreadsheet Chaos</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    Placement directors manage thousands of graduating students across uncoordinated Google Sheets, WhatsApp groups, and email chains, leading to communication bottlenecks and eligibility errors.
                  </p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-indigo-900 font-medium">
                    <strong className="text-indigo-600">NexusTalent Fix:</strong> Integrated digital batch registries with automated eligibility filtering, one-click drive allocation, and instant NAAC/NIRF audit exports.
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">3. Uncontrolled Student Data Leakage</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    Commercial job boards monetize student phone numbers and email databases without consent, exposing young graduates to relentless spam, deceptive coaching institutes, and privacy violations.
                  </p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-indigo-900 font-medium">
                    <strong className="text-indigo-600">NexusTalent Fix:</strong> DPDP Act 2023-compliant 3-tier privacy shield. Employers cannot view student identity or contact information without explicit, opt-in consent.
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">4. Post-Offer Renege & Ghosting</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    Between campus offer issuance and day-one onboarding, enterprises suffer a 25–35% renege rate, disrupting project delivery and causing severe quarterly hiring shortfalls.
                  </p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-indigo-900 font-medium">
                    <strong className="text-indigo-600">NexusTalent Fix:</strong> Closed-loop offer verification with real-time acceptance tracking, institutional joining audits, and multi-offer holding prevention.
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Formal Comparison Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-900 text-white p-4 sm:p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Platform Paradigm Comparison</h3>
                <p className="text-xs text-slate-400">Comparing Traditional Placement Models vs. NexusTalent OS</p>
              </div>
              <span className="text-xs font-mono font-bold bg-indigo-600 text-white px-3 py-1 rounded">
                ENTERPRISE STANDARD
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-4 sm:p-5 w-1/3">Evaluation Metric</th>
                    <th className="p-4 sm:p-5 w-1/3 text-slate-500">Legacy Campus Placement</th>
                    <th className="p-4 sm:p-5 w-1/3 text-indigo-700 bg-indigo-50/50">NexusTalent OS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-600">
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Credential Verification</td>
                    <td className="p-4 sm:p-5 text-red-600">Unverified self-declared claims; paper marksheets</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-700 bg-indigo-50/30">TPO-authenticated records & proctored diagnostic labs</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Matching Logic</td>
                    <td className="p-4 sm:p-5 text-red-600">Keyword matching, manual resume filtering, random seeds</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-700 bg-indigo-50/30">Deterministic 7-parameter mathematical compatibility</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Data Sovereignty & Privacy</td>
                    <td className="p-4 sm:p-5 text-red-600">Broad public access; student data sold/broadcasted</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-700 bg-indigo-50/30">Database-enforced candidate consent & DPDP Act compliance</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Placement Office Administration</td>
                    <td className="p-4 sm:p-5 text-red-600">Fragmented Excel sheets, WhatsApp groups, manual tallying</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-700 bg-indigo-50/30">Single-pane campus dashboard with live drive telemetry</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Post-Offer Visibility</td>
                    <td className="p-4 sm:p-5 text-red-600">Zero tracking; high dropouts and ghosting</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-700 bg-indigo-50/30">End-to-end joining milestones with real-time status updates</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>

      {/* Section 2: Stakeholder Workflows & Benefits (Interactive Deep Dives) */}
      <section id="stakeholders" className="py-16 lg:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-100">
              END-TO-END OPERATIONAL PLAYBOOK
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3 mb-4">
              Designed Specifically for Each Campus Stakeholder
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              Explore how NexusTalent OS orchestrates the entire recruitment lifecycle with precision workflows and distinct value propositions.
            </p>
          </div>

          {/* Role Navigation Tabs */}
          <div className="flex justify-center mb-10 overflow-x-auto pb-2 scrollbar-none">
            <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs inline-flex space-x-1">
              <button
                onClick={() => setActiveRoleTab('employer')}
                className={`px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                  activeRoleTab === 'employer'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Enterprise Employers</span>
              </button>

              <button
                onClick={() => setActiveRoleTab('institution')}
                className={`px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                  activeRoleTab === 'institution'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <School className="w-4 h-4" />
                <span>Universities & TPOs</span>
              </button>

              <button
                onClick={() => setActiveRoleTab('student')}
                className={`px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                  activeRoleTab === 'student'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Students & Candidates</span>
              </button>

              <button
                onClick={() => setActiveRoleTab('admin')}
                className={`px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                  activeRoleTab === 'admin'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Super Admin</span>
              </button>
            </div>
          </div>

          {/* Active Tab Showcase */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
            
            {/* Tab Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-8 mb-8 border-b border-slate-200 gap-6">
              <div className="flex items-start space-x-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                  activeRoleTab === 'employer' ? 'bg-indigo-600' :
                  activeRoleTab === 'institution' ? 'bg-emerald-600' :
                  activeRoleTab === 'student' ? 'bg-blue-600' : 'bg-slate-900'
                }`}>
                  <CurrentIcon className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-slate-500">
                      {currentTab.roleBadge}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">{currentTab.roleTitle}</h3>
                  <p className="text-sm text-slate-600 max-w-2xl mt-1">{currentTab.summary}</p>
                </div>
              </div>

              {currentTab.authRole && (
                <button
                  onClick={() => onSelectAuth(false, currentTab.authRole)}
                  className={`px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-sm hover:shadow transition-all shrink-0 flex items-center justify-center space-x-2 cursor-pointer ${
                    activeRoleTab === 'employer' ? 'bg-indigo-600 hover:bg-indigo-700' :
                    activeRoleTab === 'institution' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <span>{currentTab.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Step-by-Step Workflow & Value Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: 5-Step Process */}
              <div className="lg:col-span-7 space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Operational Step-by-Step Execution
                </h4>
                
                {currentTab.steps.map((step, idx) => (
                  <div 
                    key={idx}
                    className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-start space-x-4"
                  >
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                      {step.number}
                    </span>
                    <div className="flex-1">
                      <h5 className="text-sm font-bold text-slate-900 mb-1">{step.title}</h5>
                      <p className="text-xs text-slate-600 leading-relaxed mb-2">{step.description}</p>
                      <div className="text-[11px] font-mono text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded border border-indigo-100 inline-block">
                        <strong>Artifact:</strong> {step.deliverable}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column: Key Value Drivers & Concrete Benefits */}
              <div className="lg:col-span-5 space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Measurable Operational Outcomes
                </h4>

                <div className="grid grid-cols-1 gap-4">
                  {currentTab.benefits.map((ben, idx) => (
                    <div key={idx} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <div className="flex items-center space-x-2 text-emerald-600 mb-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <h5 className="text-sm font-bold text-slate-900">{ben.title}</h5>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{ben.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 text-slate-300 text-xs font-mono">
                  <div className="flex items-center space-x-2 text-indigo-400 mb-2">
                    <Fingerprint className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-wider">Security & Compliance Notice</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    All transactions, requirements, candidate submissions, and interview milestones are protected with immutable server security rules and strict role-based access control (RBAC).
                  </p>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* Section 3: Core Engine & Architecture Highlights */}
      <section id="core-engine" className="py-16 lg:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-100">
              ARCHITECTURAL FOUNDATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3 mb-4">
              Powered by Deterministic Verification & True Data Sovereignty
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              Explore the technical principles powering the platform: zero random ranking, multi-layer cryptographic privacy, and verified academic pipelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="border border-slate-200 rounded-2xl p-6 sm:p-8 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-6">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">Deterministic Matching Engine</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  Evaluates candidate suitability across 7 exact dimensions without stochastic hallucinations or advertising bias:
                </p>
                <ul className="space-y-2 text-xs text-slate-700 font-medium mb-6">
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Skill verification rubric alignment</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Degree discipline & academic program</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Minimum CGPA & zero-backlog criteria</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Graduation year cohort match</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Location mobility & compensation band</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 border-t border-slate-200 text-[11px] font-mono text-indigo-700 font-bold">
                100% Deterministic • Zero Math.random
              </div>
            </div>

            {/* Feature 2 */}
            <div className="border border-slate-200 rounded-2xl p-6 sm:p-8 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-6">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">3-Layer Data Sovereignty</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  Enforces strict data access boundaries adhering strictly to India\'s Digital Personal Data Protection (DPDP) Act:
                </p>
                <div className="space-y-3 text-xs mb-6">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <strong className="text-slate-900 block mb-0.5">Tier 1: Public Summary</strong>
                    <span className="text-slate-500 text-[11px]">Anonymized skill badges, branch discipline, and cohort only.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <strong className="text-slate-900 block mb-0.5">Tier 2: Drive Invitation</strong>
                    <span className="text-slate-500 text-[11px]">Candidate reviews salary CTC, role details, and work location.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <strong className="text-slate-900 block mb-0.5">Tier 3: Unlocked Dossier</strong>
                    <span className="text-slate-500 text-[11px]">Personal contact and transcripts released ONLY upon opt-in consent.</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 text-[11px] font-mono text-emerald-700 font-bold">
                Database-Enforced Privacy Rules
              </div>
            </div>

            {/* Feature 3 */}
            <div className="border border-slate-200 rounded-2xl p-6 sm:p-8 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-6">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">TPO Academic Verification</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  Official university placement cells authenticate every student record, preventing resume manipulation:
                </p>
                <ul className="space-y-2 text-xs text-slate-700 font-medium mb-6">
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    <span>Direct AISHE & NAAC institutional nodes</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    <span>Official TPO marksheet & roll verification</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    <span>Standardized Subject Diagnostic Labs</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    <span>Locked immutable candidate history</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    <span>Direct integration with NIRF filing exports</span>
                  </li>
                </ul>
              </div>
              <div className="pt-4 border-t border-slate-200 text-[11px] font-mono text-blue-700 font-bold">
                Institutional Digital Authentication
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Section 4: Closed-Loop Recruitment Protocol (Interactive Visual Stepper) */}
      <section id="lifecycle" className="py-16 lg:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-100">
              CAMPUS RECRUITMENT PROTOCOL
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3 mb-4">
              The 6-Stage Closed-Loop Campus Lifecycle
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              From Corporate Demand Definition to Verified First-Day Joining—explore how all tripartite actions sync seamlessly across the network.
            </p>
          </div>

          {/* Stepper Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-8">
            {lifecycleStages.map((stage, idx) => (
              <button
                key={idx}
                onClick={() => setActiveLifecycleStep(idx)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  activeLifecycleStep === idx
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`text-[10px] font-mono font-bold block mb-1 ${activeLifecycleStep === idx ? 'text-indigo-200' : 'text-indigo-600'}`}>
                  STAGE {stage.step}
                </span>
                <span className="text-xs font-bold line-clamp-1">{stage.title}</span>
              </button>
            ))}
          </div>

          {/* Active Step Detailed Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-200 gap-4">
              <div className="flex items-center space-x-3">
                <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-mono font-black text-base flex items-center justify-center">
                  {lifecycleStages[activeLifecycleStep].step}
                </span>
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                    Primary Actor: {lifecycleStages[activeLifecycleStep].actor}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                    {lifecycleStages[activeLifecycleStep].title}
                  </h3>
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 self-start sm:self-auto">
                {lifecycleStages[activeLifecycleStep].badge}
              </span>
            </div>

            <p className="text-sm sm:text-base text-slate-700 leading-relaxed mb-6">
              {lifecycleStages[activeLifecycleStep].description}
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-bold text-slate-900 block mb-0.5">Platform Integrity Safeguard</strong>
                <span className="text-xs text-slate-600">{lifecycleStages[activeLifecycleStep].safeguard}</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Section 5: Academic Disciplines & Multi-Stream Scope */}
      <section className="py-16 lg:py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-100">
              NATIONAL EDUCATION COVERAGE
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-3 mb-4">
              Supporting All Higher Education Disciplines
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              NexusTalent OS supports recruitment across all major Indian university streams, accreditation tiers, and professional degree tracks.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-2xl block mb-2">⚙️</span>
              <h4 className="font-bold text-xs text-slate-900 mb-1">Engineering</h4>
              <p className="text-[10px] text-slate-500">CS, IT, Mech, Civil, ECE, AI/ML</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-2xl block mb-2">📊</span>
              <h4 className="font-bold text-xs text-slate-900 mb-1">Management</h4>
              <p className="text-[10px] text-slate-500">MBA, BBA, Marketing, HR, Ops</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-2xl block mb-2">💼</span>
              <h4 className="font-bold text-xs text-slate-900 mb-1">Commerce</h4>
              <p className="text-[10px] text-slate-500">B.Com, M.Com, Finance, FinTech</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-2xl block mb-2">🔬</span>
              <h4 className="font-bold text-xs text-slate-900 mb-1">Sciences</h4>
              <p className="text-[10px] text-slate-500">B.Sc, M.Sc, Data Sci, Biotech</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-2xl block mb-2">🎨</span>
              <h4 className="font-bold text-xs text-slate-900 mb-1">Design & Media</h4>
              <p className="text-[10px] text-slate-500">B.Des, UI/UX, Mass Comm</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-2xl block mb-2">🏥</span>
              <h4 className="font-bold text-xs text-slate-900 mb-1">Healthcare</h4>
              <p className="text-[10px] text-slate-500">Pharma, Nursing, Allied Health</p>
            </div>
          </div>

        </div>
      </section>

      {/* Section 6: Frequently Asked Questions (FAQ) */}
      <section id="faq" className="py-16 lg:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded border border-indigo-100">
              GOVERNANCE & COMMON INQUIRIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Clear answers regarding privacy compliance, institutional empanelment, and deterministic matching standards.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between space-x-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <span className="font-bold text-slate-900 text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${activeFaq === idx ? 'rotate-180 text-indigo-600' : ''}`} />
                </button>
                {activeFaq === idx && (
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/40">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Section 7: Final Executive Onboarding Launchpad */}
      <section className="py-16 lg:py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="max-w-3xl mx-auto text-center mb-14">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-3.5 py-1.5 rounded-full border border-indigo-800">
              NATIONAL TALENT INFRASTRUCTURE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mt-4 mb-4">
              Begin Hiring or Empaneling Today
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Join hundreds of enterprise employers, verified universities, and top-tier candidates already leveraging the NexusTalent operating system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            
            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <Building2 className="w-8 h-8 text-indigo-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Corporate Employers</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Broadcast structured hiring demands, filter candidates deterministically, and hire verified graduates with zero dropouts.
                </p>
              </div>
              <button
                onClick={() => onSelectAuth(false, 'employer')}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Register as Employer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <School className="w-8 h-8 text-emerald-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Academic Institutions</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Empanel your placement cell, authenticate student cohorts, and receive targeted enterprise hiring drives directly.
                </p>
              </div>
              <button
                onClick={() => onSelectAuth(false, 'institution')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Empanel Institution (TPO)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <GraduationCap className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Graduating Students</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Create your verified Career Passport, earn diagnostic skill badges, and access high-package recruitment opportunities.
                </p>
              </div>
              <button
                onClick={() => onSelectAuth(false, 'student')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Create Student Passport</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* Formal Executive Footer */}
      <footer className="bg-slate-950 text-slate-400 text-xs py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-slate-800">
            
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg font-black flex items-center justify-center text-sm">
                  NT
                </div>
                <span className="font-black text-white text-base tracking-tight uppercase">NexusTalent OS</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed mb-4">
                The Sovereign Campus & Talent Exchange Network connecting Indian higher education institutions, students, and corporate talent teams.
              </p>
              <div className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>DPDP Act 2023 Compliant</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">For Stakeholders</h4>
              <ul className="space-y-2 text-[11px]">
                <li><button onClick={() => onSelectAuth(false, 'employer')} className="hover:text-white transition-colors cursor-pointer">Enterprise Hiring OS</button></li>
                <li><button onClick={() => onSelectAuth(false, 'institution')} className="hover:text-white transition-colors cursor-pointer">University TPO Empanelment</button></li>
                <li><button onClick={() => onSelectAuth(false, 'student')} className="hover:text-white transition-colors cursor-pointer">Student Career Passport</button></li>
                <li><button onClick={() => onSelectAuth(true)} className="hover:text-white transition-colors cursor-pointer">Stakeholder Login Portal</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">Technical Architecture</h4>
              <ul className="space-y-2 text-[11px] text-slate-400">
                <li><span>Deterministic Matching Engine</span></li>
                <li><span>3-Layer Data Sovereignty Shield</span></li>
                <li><span>TPO Digital Authentication</span></li>
                <li><span>Standardized Diagnostic Labs</span></li>
                <li><span>Closed-Loop Joining Audit</span></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">Regulatory & Security</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                All data stored securely with Firestore database-level security rules and field immutability constraints. Zero third-party tracker monetization.
              </p>
              <div className="text-[10px] font-mono text-slate-600">
                ISO/IEC 27001 Security Principles • NIRF / NAAC Ready
              </div>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-mono gap-4">
            <div>
              © {new Date().getFullYear()} NexusTalent OS. All rights reserved. National Campus Employment Network.
            </div>
            <div className="flex space-x-4">
              <span>Data Protection</span>
              <span>•</span>
              <span>Terms of Service</span>
              <span>•</span>
              <span>TPO Code of Conduct</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
};

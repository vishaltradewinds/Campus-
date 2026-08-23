import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Building2,
  Briefcase,
  GraduationCap,
  Play,
  RotateCcw,
  ShieldCheck,
  Send,
  Layers,
  Award,
  Zap,
  BookOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const KillerLoopSimulation: React.FC = () => {
  const {
    requirements,
    institutions,
    students,
    campaigns,
    callsForTalent,
    studentOpportunities,
    setActiveRole,
    setSelectedEmployerId,
    setSelectedInstitutionId,
    setSelectedStudentId,
    sendCallForTalent,
    respondToCallForTalent,
    activateInstitutionStudents,
    studentConsentToOpportunity,
    advanceCandidateStage,
  } = useTalentNetwork();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunningAuto, setIsRunningAuto] = useState(false);

  const steps = [
    {
      step: 1,
      title: 'Employer Creates Structured Demand',
      actor: '🏢 Employer (Demand Anchor)',
      desc: 'Apex Global Enterprises defines demand: "200 graduates (Commerce, Management, Sciences & Engineering) with domain proficiency, problem-solving, and communication skills for Bengaluru & Mumbai joining June–August at ₹8–12.5 LPA."',
      role: 'employer',
      actionLabel: '1. Anchor Demand & Initiate Discovery',
      execute: () => {
        setActiveRole('employer');
      },
    },
    {
      step: 2,
      title: 'Talent Network Discovers Institutional Supply',
      actor: '⚡ Talent Discovery Engine',
      desc: 'The engine scans institutional capacity, student counts, and historical placement performance. Matches Apex Institute of Tech (96% fit) and Bhopal State Univ (91% fit).',
      role: 'employer',
      actionLabel: '2. Inspect Institutional Gateways',
      execute: () => {
        setActiveRole('employer');
      },
    },
    {
      step: 3,
      title: 'Employer Issues "Call for Talent"',
      actor: '🏢 Employer → 🏛️ Institution',
      desc: 'The Employer issues a structured Call for Talent to Apex Institute of Technology requesting 150 talent units.',
      role: 'employer',
      actionLabel: '3. Dispatch "Call for Talent"',
      execute: () => {
        const activeCamp = campaigns[0];
        const apexInst = institutions[0];
        if (activeCamp && apexInst) {
          sendCallForTalent(activeCamp.id, [apexInst.id]);
        }
      },
    },
    {
      step: 4,
      title: 'Institution Responds & Activates Eligibility',
      actor: '🏛️ Institution (Supply Gateway)',
      desc: 'Placement Cell at Apex Institute accepts the call ("We can supply 250 verified candidates") and runs the eligibility engine to notify matching 2027 students across relevant academic streams.',
      role: 'institution',
      actionLabel: '4. Accept Call & Dispatch to Students',
      execute: () => {
        setSelectedInstitutionId(institutions[0].id);
        const call = callsForTalent.find((c) => c.institutionId === institutions[0].id) || callsForTalent[0];
        if (call) {
          respondToCallForTalent(
            call.id,
            'accepted',
            'Accepted: Supplying 250 placement-ready 2027 students with verified domain skill benchmarks.',
            250
          );
          const apexStudentIds = students.filter((s) => s.institutionId === institutions[0].id).map((s) => s.id);
          activateInstitutionStudents(call.id, apexStudentIds);
        }
      },
    },
    {
      step: 5,
      title: 'Student Opts-In via Explicit Consent Layer',
      actor: '🎓 Student (Talent Unit & Identity Owner)',
      desc: 'Aarav Sharma receives the invitation on his Career Passport. Institutional eligibility ≠ student consent! Aarav reviews the job details and explicitly consents to apply.',
      role: 'student',
      actionLabel: '5. Student Opts-In & Consents',
      execute: () => {
        setSelectedStudentId(students[0].id);
        const opp = studentOpportunities.find((o) => o.studentId === students[0].id);
        if (opp) {
          studentConsentToOpportunity(opp.id);
        }
      },
    },
    {
      step: 6,
      title: 'Assessment, Shortlisting, Interview & Offer',
      actor: '🏢 Employer ↔ 🎓 Student',
      desc: 'Aarav completes the proctored domain skill benchmark (95% score). Employer shortlists, conducts interviews, and releases a digital offer letter.',
      role: 'employer',
      actionLabel: '6. Issue Offer Letter',
      execute: () => {
        const opp = studentOpportunities.find((o) => o.studentId === students[0].id);
        if (opp) {
          advanceCandidateStage(opp.id, 'offered', {
            offerLetterUrl: '',
          });
        }
      },
    },
    {
      step: 7,
      title: 'Offer Acceptance & Feedback Loop Closure',
      actor: '🎓 Student Placed ↔ 🏛️ Reputation Updated',
      desc: 'Aarav accepts the offer! Placement is confirmed on the unified pipeline. Apex Institute’s historical offer & joining rate in the reputation matrix automatically updates!',
      role: 'student',
      actionLabel: '7. Accept Offer & Complete Loop!',
      execute: () => {
        const opp = studentOpportunities.find((o) => o.studentId === students[0].id);
        if (opp) {
          advanceCandidateStage(opp.id, 'accepted');
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.5 },
          });
        }
      },
    },
  ];

  const handleRunNextStep = () => {
    const nextIdx = (currentStepIndex + 1) % steps.length;
    steps[currentStepIndex].execute();
    setCurrentStepIndex(nextIdx);
  };

  const handleAutoPlay = async () => {
    setIsRunningAuto(true);
    for (let i = 0; i < steps.length; i++) {
      setCurrentStepIndex(i);
      steps[i].execute();
      await new Promise((resolve) => setTimeout(resolve, 1800));
    }
    setIsRunningAuto(false);
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.5 },
    });
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900">
      {/* Simulation Banner */}
      <div className="bg-white p-6 border border-slate-300 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white border border-slate-300 flex items-center justify-center text-3xl text-indigo-600 font-black">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">Three-Sided Recruitment Loop</h1>
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-100 text-indigo-600 border border-slate-300">
                  23-Principle Flow
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-1 max-w-3xl">
                Watch the complete lifecycle: <strong className="text-slate-900">Employer Demand</strong> → <strong className="text-slate-900">Institutional Gateway Discovery</strong> → <strong className="text-slate-900">Call for Talent</strong> → <strong className="text-slate-900">Student Consent & Assessment</strong> → <strong className="text-slate-900">Offer & Placement Feedback Loop</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleAutoPlay}
              disabled={isRunningAuto}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-mono font-black uppercase text-xs transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>{isRunningAuto ? 'Running Full Simulation...' : 'Auto-Run Complete Loop'}</span>
            </button>
          </div>
        </div>

        {/* Step Progress Tracker */}
        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-mono">
            {steps.map((st, idx) => {
              const isCurrent = currentStepIndex === idx;
              const isCompleted = currentStepIndex > idx;
              return (
                <button
                  key={st.step}
                  onClick={() => {
                    setCurrentStepIndex(idx);
                    st.execute();
                  }}
                  className={`p-2.5 text-left transition-all border cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isCompleted
                      ? 'bg-white text-slate-900 border-slate-300'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Step 0{st.step}</span>
                    {isCompleted && <CheckCircle2 className="w-3 h-3 text-indigo-600" />}
                  </div>
                  <div className="text-xs font-bold mt-1 leading-tight line-clamp-1 uppercase">
                    {st.title}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Step Spotlight Card */}
      <div className="bg-white p-6 border border-slate-300 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-indigo-600">
              STAGE 0{steps[currentStepIndex].step} // {steps.length}
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 mt-1">
              {steps[currentStepIndex].title}
            </h2>
            <div className="text-xs font-mono font-bold text-indigo-600 mt-0.5 uppercase">
              Primary Actor: {steps[currentStepIndex].actor}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRunNextStep}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black uppercase text-xs transition-all flex items-center space-x-2 cursor-pointer"
            >
              <span>{steps[currentStepIndex].actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-300 text-slate-600 text-sm leading-relaxed font-sans">
          {steps[currentStepIndex].desc}
        </div>

        {/* Live Network State Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-white p-4 border border-slate-300 space-y-2">
            <div className="flex items-center space-x-2 font-bold uppercase text-slate-900">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              <span>01 // Employer Side</span>
            </div>
            <p className="text-slate-500">
              ACTIVE DEMANDS: <strong className="text-slate-900">{requirements.length}</strong> // VACANCIES: <strong className="text-indigo-600">{requirements.reduce((a, b) => a + b.vacancies, 0)}</strong>
            </p>
            <button
              onClick={() => setActiveRole('employer')}
              className="text-xs text-indigo-600 font-bold hover:underline flex items-center space-x-1 uppercase cursor-pointer"
            >
              <span>Open Employer View</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="bg-white p-4 border border-slate-300 space-y-2">
            <div className="flex items-center space-x-2 font-bold uppercase text-slate-900">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>02 // Institution Side</span>
            </div>
            <p className="text-slate-500">
              ACTIVE CALLS: <strong className="text-slate-900">{callsForTalent.length}</strong> // ACCEPTED: <strong className="text-indigo-600">{callsForTalent.filter((c) => c.status === 'accepted').length}</strong>
            </p>
            <button
              onClick={() => setActiveRole('institution')}
              className="text-xs text-indigo-600 font-bold hover:underline flex items-center space-x-1 uppercase cursor-pointer"
            >
              <span>Open Institution View</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="bg-white p-4 border border-slate-300 space-y-2">
            <div className="flex items-center space-x-2 font-bold uppercase text-slate-900">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>03 // Student Side</span>
            </div>
            <p className="text-slate-500">
              CONSENTED: <strong className="text-slate-900">{studentOpportunities.filter((o) => o.stage !== 'invited' && o.stage !== 'declined').length}</strong> // PLACED: <strong className="text-indigo-600">{studentOpportunities.filter((o) => o.stage === 'accepted' || o.stage === 'joined').length}</strong>
            </p>
            <button
              onClick={() => setActiveRole('student')}
              className="text-xs text-indigo-600 font-bold hover:underline flex items-center space-x-1 uppercase cursor-pointer"
            >
              <span>Open Student View</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

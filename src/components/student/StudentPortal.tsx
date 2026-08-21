import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import {
  GraduationCap,
  Award,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Github,
  Calendar,
  MapPin,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  Code,
  FileText,
  Briefcase,
  Play,
  Check,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StageBadge } from '../common/StatusBadge';
import { StudentOpportunity, StudentAvailability } from '../../types';

export const StudentPortal: React.FC = () => {
  const {
    currentStudent,
    studentOpportunities,
    studentConsentToOpportunity,
    declineOpportunity,
    updateStudentAvailability,
    advanceCandidateStage,
  } = useTalentNetwork();

  const [activeTab, setActiveTab] = useState<'passport' | 'opportunities' | 'assessment_lab'>('opportunities');
  const [selectedAssessmentOpp, setSelectedAssessmentOpp] = useState<StudentOpportunity | null>(null);
  const [assessmentCode, setAssessmentCode] = useState(`def find_pairs_with_sum(arr, target_sum):
    """
    Find all unique pairs in arr that add up to target_sum.
    Time Complexity: O(n), Space Complexity: O(n)
    """
    seen = set()
    output = set()
    for num in arr:
        complement = target_sum - num
        if complement in seen:
            output.add((min(num, complement), max(num, complement)))
        seen.add(num)
    return list(output)`);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [assessmentDoneMsg, setAssessmentDoneMsg] = useState<string | null>(null);

  // Opportunities for current student
  const myOpportunities = studentOpportunities.filter(
    (o) => o.studentId === currentStudent.id
  );

  const pendingInvitations = myOpportunities.filter((o) => o.stage === 'invited');
  const activeApplications = myOpportunities.filter((o) => o.stage !== 'invited' && o.stage !== 'declined');

  const handleLaunchAssessment = (opp: StudentOpportunity) => {
    setSelectedAssessmentOpp(opp);
  };

  const handleCompleteAssessment = () => {
    if (!selectedAssessmentOpp) return;
    setIsSubmittingAssessment(true);
    setTimeout(() => {
      advanceCandidateStage(selectedAssessmentOpp.id, 'assessment_completed', {
        assessmentScore: 94,
        assessmentCompletedAt: new Date().toISOString(),
      });
      setIsSubmittingAssessment(false);
      setSelectedAssessmentOpp(null);
      setAssessmentDoneMsg('Proctored coding assessment submitted successfully! Score: 94% (Top 5th Percentile)');
      setTimeout(() => setAssessmentDoneMsg(null), 5000);
    }, 1200);
  };

  const handleAcceptOffer = (opp: StudentOpportunity) => {
    advanceCandidateStage(opp.id, 'accepted');
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-[#F5F5F5]">
      {/* Student Identity & Career Passport Banner */}
      <div className="bg-[#111111] p-6 border border-[#333333] shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <img
              src={currentStudent.avatar}
              alt={currentStudent.name}
              className="w-16 h-16 object-cover border border-[#333333]"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black uppercase italic tracking-tight text-white">{currentStudent.name}</h1>
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#222222] text-[#CCFF00] border border-[#333333]">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  VERIFIED PASSPORT
                </span>
              </div>
              <p className="text-xs font-mono text-[#888888] mt-1 flex flex-wrap items-center gap-2">
                <span className="uppercase">{currentStudent.program} // {currentStudent.branch}</span>
                <span>//</span>
                <span>CLASS OF {currentStudent.graduationYear}</span>
                <span>//</span>
                <span>{currentStudent.institutionName}</span>
                <span>//</span>
                <span>CGPA: <strong className="text-[#CCFF00]">{currentStudent.cgpa}</strong></span>
              </p>
            </div>
          </div>

          {/* Student Availability Toggle (Student owns their state!) */}
          <div className="bg-[#181818] p-3 border border-[#333333] text-xs font-mono">
            <span className="text-[10px] uppercase text-[#888888] block mb-1">PLACEMENT AVAILABILITY:</span>
            <select
              value={currentStudent.availability}
              onChange={(e) => updateStudentAvailability(e.target.value as StudentAvailability)}
              aria-label="Placement Availability"
              className="w-full bg-[#111111] text-white font-bold text-xs px-2.5 py-1.5 border border-[#333333] focus:border-[#CCFF00] focus:outline-none cursor-pointer"
            >
              <option value="actively_seeking">🟢 ACTIVELY SEEKING</option>
              <option value="open_to_offers">🟡 OPEN TO OFFERS</option>
              <option value="not_currently_available">🔴 NOT AVAILABLE / PLACED</option>
            </select>
          </div>
        </div>

        {/* Student Navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-[#222222] flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'opportunities'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>01 // OPPORTUNITIES & CONSENT</span>
            {pendingInvitations.length > 0 && (
              <span className="px-1.5 py-0.2 bg-black text-[#CCFF00] font-bold text-[10px] ml-1">
                {pendingInvitations.length} NEW
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('passport')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'passport'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>02 // CAREER IDENTITY & EVIDENCE</span>
          </button>

          <button
            onClick={() => setActiveTab('assessment_lab')}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'assessment_lab'
                ? 'bg-[#CCFF00] text-black'
                : 'bg-[#181818] text-[#888888] hover:text-white border border-[#222222]'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>03 // CODING LAB BENCHMARK</span>
          </button>
        </div>
      </div>

      {assessmentDoneMsg && (
        <div className="bg-[#181818] border-l-4 border-[#CCFF00] border-y border-r border-[#333333] text-white px-4 py-3 flex items-center space-x-2 text-xs font-mono font-bold">
          <CheckCircle2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
          <span>{assessmentDoneMsg}</span>
        </div>
      )}

      {/* TAB 1: OPPORTUNITIES & CONSENT GATEWAY */}
      {activeTab === 'opportunities' && (
        <div className="space-y-6">
          {/* Pending Invitations requiring Explicit Consent */}
          {pendingInvitations.length > 0 && (
            <div className="bg-[#181818] border-l-4 border-l-[#CCFF00] border-[#333333] p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-[#CCFF00]" />
                <h3 className="text-sm font-black uppercase text-white font-mono">
                  Incoming Recruitment Invitations (Explicit Consent Required)
                </h3>
              </div>
              <p className="text-xs text-[#888888] font-sans">
                <strong className="text-white">Key Network Principle:</strong> Institutional eligibility ≠ Student consent.
                Your college verified your eligibility, but you retain full ownership of where your passport is submitted.
              </p>

              <div className="space-y-3">
                {pendingInvitations.map((opp) => (
                  <div
                    key={opp.id}
                    className="bg-[#111111] p-5 border border-[#333333] flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-base uppercase text-white">{opp.employerName}</span>
                        <span className="px-2 py-0.5 text-xs font-mono font-bold bg-[#222222] text-[#CCFF00] border border-[#333333]">
                          {opp.matchScore}% MATCH
                        </span>
                      </div>
                      <h4 className="text-xs font-mono font-bold text-[#CCFF00] uppercase mt-1">{opp.role}</h4>
                      <p className="text-xs font-mono text-[#888888] mt-1 flex flex-wrap items-center gap-3">
                        <span>PACKAGE: <strong className="text-white">{opp.salaryLPA}</strong></span>
                        <span>//</span>
                        <span>LOCATIONS: <strong className="text-white">{opp.locations.join(', ')}</strong></span>
                      </p>

                      {/* Match Alignment */}
                      <div className="mt-2 text-[11px] font-mono text-[#888888]">
                        <strong className="text-[#CCFF00]">WHY MATCHED: </strong> {opp.alignmentReasons?.join(' // ') || opp.matchBreakdown?.aiRationale || 'Strong verified skill alignment'}
                      </div>
                    </div>

                    {/* Explicit Consent Actions */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        id={`opt-in-btn-${opp.id}`}
                        onClick={() => studentConsentToOpportunity(opp.id)}
                        className="px-4 py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Opt-In & Consent to Apply</span>
                      </button>
                      <button
                        onClick={() => declineOpportunity(opp.id)}
                        className="px-3 py-2 bg-[#222222] hover:bg-rose-950 hover:text-rose-400 text-[#888888] font-mono font-bold uppercase text-xs border border-[#333333] transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Application Stages & Tracking */}
          <div className="bg-[#111111] p-6 border border-[#333333]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00]">
                  01 // APPLICATION PROGRESS
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                  <span>My Active Recruitment Stages</span>
                </h3>
                <p className="text-xs text-[#888888] mt-0.5 font-sans">
                  Real-time transparent stage tracking synced across Employer and Institution portals
                </p>
              </div>
            </div>

            {activeApplications.length === 0 ? (
              <div className="p-8 text-center bg-[#181818] border border-[#333333] text-[#888888] text-xs font-mono">
                No active recruitment applications yet. Opt-in to invitations above or explore matched roles.
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
                            COMPENSATION: <strong className="text-white">{opp.salaryLPA}</strong> // LOCATIONS: {opp.locations.join(', ')}
                          </p>
                        </div>

                        {/* Interactive Next-Action Trigger */}
                        <div className="flex items-center space-x-2">
                          {isAssessmentPending && (
                            <button
                              onClick={() => handleLaunchAssessment(opp)}
                              className="px-4 py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Take Coding Assessment</span>
                            </button>
                          )}

                          {isOffered && (
                            <button
                              id="accept-offer-btn"
                              onClick={() => handleAcceptOffer(opp)}
                              className="px-5 py-2.5 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Accept Digital Offer & Confirm Placement</span>
                            </button>
                          )}

                          {isJoined && (
                            <span className="px-3 py-1.5 bg-[#222222] text-[#CCFF00] font-mono font-bold uppercase text-xs flex items-center space-x-1 border border-[#333333]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Placed & Joining Confirmed</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Recruitment Step Progress Bar */}
                      <div className="mt-4 pt-3 border-t border-[#222222] grid grid-cols-5 gap-2 text-center text-[10px] font-mono font-bold uppercase">
                        <div className="p-1.5 bg-[#222222] text-[#CCFF00] border border-[#333333]">
                          1. Consented ✓
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
                          4. Interviews
                        </div>
                        <div
                          className={`p-1.5 border ${
                            ['offered', 'accepted', 'joined'].includes(opp.stage)
                              ? 'bg-[#CCFF00] text-black font-black'
                              : 'bg-[#181818] text-[#666666] border-[#222222]'
                          }`}
                        >
                          5. Offer & Joined
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

      {/* TAB 2: VERIFIED CAREER PASSPORT */}
      {activeTab === 'passport' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Skills & Badges */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#111111] p-6 border border-[#333333]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00] mb-1">
                02 // VERIFIED COMPETENCY
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white mb-4 flex items-center space-x-2">
                <span>Verified Skill Benchmarks</span>
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
                          {sk.badge} BADGE
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-2 text-xs font-mono">
                        <span className="text-[#888888]">BENCHMARK:</span>
                        <strong className="text-[#CCFF00]">{sk.score}% ({sk.percentile}th Percentile)</strong>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#282828] text-[9px] font-mono text-[#888888] flex justify-between uppercase">
                      <span>Authority: {sk.verifiedBy}</span>
                      <span>Verified: {sk.verifiedDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence Projects */}
            <div className="bg-[#111111] p-6 border border-[#333333]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00] mb-1">
                02 // REPOSITORY ARTIFACTS
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white mb-4 flex items-center space-x-2">
                <span>Verified Engineering Projects & Repositories</span>
              </h3>

              <div className="space-y-4">
                {currentStudent.projects.map((proj) => (
                  <div key={proj.id} className="p-4 border border-[#333333] bg-[#181818]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="font-mono font-bold text-sm text-white uppercase">{proj.title}</h4>
                      {proj.githubUrl && (
                        <a
                          href={proj.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-xs font-mono text-[#CCFF00] hover:underline uppercase"
                        >
                          <Github className="w-3.5 h-3.5" />
                          <span>View Repo</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-[#CCCCCC] mt-1.5 font-sans">{proj.description}</p>
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
                          VERIFIED CODE SCORE: {proj.verifiedScore}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar: Academic & Preferences */}
          <div className="space-y-6">
            <div className="bg-[#111111] p-6 border border-[#333333] space-y-4">
              <h3 className="text-base font-black uppercase text-white flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-[#CCFF00]" />
                <span>Academic Record</span>
              </h3>

              <div className="text-xs font-mono space-y-2.5 text-[#888888]">
                <div className="flex justify-between py-1.5 border-b border-[#222222]">
                  <span>INSTITUTION:</span>
                  <strong className="text-white text-right">{currentStudent.institutionName}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#222222]">
                  <span>DEGREE // BRANCH:</span>
                  <strong className="text-white text-right">{currentStudent.program} {currentStudent.branch}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#222222]">
                  <span>GRADUATION:</span>
                  <strong className="text-white">CLASS OF {currentStudent.graduationYear}</strong>
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
                  <span className="text-[10px] uppercase text-[#888888] block mb-1">PREFERRED LOCATIONS:</span>
                  <div className="flex flex-wrap gap-1">
                    {currentStudent.preferences.preferredLocations.map((l, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[#181818] text-white border border-[#333333] text-[10px]">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between py-1.5 border-t border-[#222222]">
                  <span>MIN TARGET CTC:</span>
                  <strong className="text-[#CCFF00] font-bold">₹{currentStudent.preferences.expectedSalaryMinLPA} LPA</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROCTORED CODING LAB / ASSESSMENT MODAL */}
      {(activeTab === 'assessment_lab' || selectedAssessmentOpp) && (
        <div className="bg-[#111111] p-6 border border-[#333333] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#CCFF00] mb-1">
                03 // TECHNICAL ASSESSMENT
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center space-x-2">
                <span>Proctored Coding & Diagnostic Lab</span>
              </h3>
              <p className="text-xs text-[#888888] mt-0.5 font-sans">
                Complete technical benchmarks to verify skill competency and advance in active recruitment campaigns
              </p>
            </div>
            {selectedAssessmentOpp && (
              <span className="text-xs font-mono font-bold px-3 py-1 bg-[#222222] text-[#CCFF00] border border-[#333333]">
                ACTIVE: {selectedAssessmentOpp.employerName} ({selectedAssessmentOpp.role})
              </span>
            )}
          </div>

          <div className="bg-[#0A0A0A] overflow-hidden border border-[#333333]">
            <div className="bg-[#181818] px-4 py-2.5 flex items-center justify-between border-b border-[#333333] text-xs font-mono">
              <span className="text-[#CCFF00] font-bold">solution.py (Python 3.11 Proctored Environment)</span>
              <span className="text-[10px] bg-[#222222] text-rose-400 px-2 py-0.5 border border-rose-900 uppercase">
                🔴 WebCam & Screen Proctored Active
              </span>
            </div>
            <textarea
              rows={10}
              value={assessmentCode}
              onChange={(e) => setAssessmentCode(e.target.value)}
              className="w-full bg-[#0A0A0A] text-[#F5F5F5] font-mono text-xs p-4 focus:outline-none focus:ring-0 leading-relaxed border-none"
            />
            <div className="bg-[#181818] p-4 border-t border-[#333333] flex items-center justify-between font-mono">
              <span className="text-xs text-[#888888]">TEST CASES: <strong className="text-white">14/14 PASSED</strong> // EXECUTION: <strong className="text-[#CCFF00]">12ms</strong></span>
              <button
                onClick={handleCompleteAssessment}
                disabled={isSubmittingAssessment}
                className="px-5 py-2 bg-[#CCFF00] hover:bg-[#b8e600] disabled:opacity-50 text-black font-mono font-black uppercase text-xs transition-all cursor-pointer flex items-center space-x-1.5"
              >
                {isSubmittingAssessment ? (
                  <span>Evaluating Vectors...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Submit & Verify Solution</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { getInstitutionMatchesForRequirement as getInstitutionMatches, getStudentMatchesForRequirement as getStudentMatches } from '../lib/matching';
import { OperationType, handleFirestoreError } from '../lib/firebaseUtils';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, where, Timestamp, getDoc, limit, documentId } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
  UserRole,
  Employer,
  Institution,
  StudentCareerPassport,
  HiringRequirement,
  RecruitmentCampaign,
  CallForTalent,
  StudentConsentOpportunity,
  InstitutionalReputationEntry,
  CallStatus,
  RecruitmentStage,
  InstitutionSupplyMatch,
  StudentCandidateMatch,
  CampaignConsentPermission,
  ConsentAuditRecord,
  StudentGlobalPrivacySettings,
} from '../types';

interface TalentNetworkContextType {
  selectedEmployerId: string; setSelectedEmployerId: (id: string) => void;
  selectedInstitutionId: string; setSelectedInstitutionId: (id: string) => void;
  selectedStudentId: string; setSelectedStudentId: (id: string) => void;
  currentEmployer: Employer; currentInstitution: Institution; currentStudent: StudentCareerPassport;
  employers: Employer[]; institutions: Institution[]; students: StudentCareerPassport[];
  requirements: HiringRequirement[]; campaigns: RecruitmentCampaign[]; callsForTalent: CallForTalent[];
  studentOpportunities: StudentConsentOpportunity[]; reputationMatrix: InstitutionalReputationEntry[];
  getInstitutionMatchesForRequirement: (req: HiringRequirement) => InstitutionSupplyMatch[];
  getStudentMatchesForRequirement: (req: HiringRequirement) => StudentCandidateMatch[];
  createRequirementAndCampaign: (reqData: Omit<HiringRequirement, 'id' | 'createdAt' | 'employerId' | 'employerName'>) => { requirement: HiringRequirement; campaign: RecruitmentCampaign };
  sendCallForTalent: (campaignId: string, institutionIds: string[], vacanciesPerInst?: number) => void;
  respondToCallForTalent: (callId: string, status: CallStatus, responseNotes: string, offeredCandidatesCount?: number, counterDaysExtension?: number) => void;
  activateInstitutionStudents: (callId: string, studentIds: string[]) => void;
  submitStudentConsent: (opportunityId: string, consented: boolean) => void;
  studentConsentToOpportunity: (opportunityId: string) => void; declineOpportunity: (opportunityId: string) => void;
  toggleCampaignConsent: (campaignId: string, approved: boolean, reason?: string) => void;
  updateCampaignConsentScope: (campaignId: string, scopeKey: keyof Pick<CampaignConsentPermission, 'academicDataShared' | 'skillBenchmarksShared' | 'projectReposShared' | 'contactInfoShared'>, value: boolean) => void;
  updateGlobalPrivacySettings: (settings: Partial<StudentGlobalPrivacySettings>) => void;
  grantAllCampaignConsents: () => void; revokeAllCampaignConsents: () => void;
  advanceCandidateStage: (opportunityId: string, nextStage: RecruitmentStage, meta?: { assessmentScore?: number; interviewFeedback?: string; offerLetterUrl?: string }) => void;
  publishInstitutionAvailability: (institutionId: string, batchYear: number, branch: string, count: number, description: string) => void;
  updateStudentAvailability: (studentIdOrAvailability: string, maybeAvailability?: StudentCareerPassport['availability']) => void;
  addVerifiedSkillToStudent: (studentId: string, skill: { name: string; category: any; score: number; badge: any; verifiedBy: string }) => void;
  updateEmployerVerification: (employerId: string, status: 'pending' | 'verified' | 'rejected', notes?: string, verifiedByAdmin?: boolean) => void;
  updateInstitutionEmpanelment: (institutionId: string, status: 'pending' | 'empanelled' | 'rejected', tier?: 'Tier-1 High Assurance' | 'Tier-2 Verified' | 'Tier-3 Provisional', notes?: string) => void;
  updateStudentInstitutionVerification: (studentId: string, status: 'pending' | 'verified' | 'rejected', notes?: string) => void;
  updateStudentPlatformVerification: (studentId: string, status: 'pending' | 'verified' | 'rejected', notes?: string) => void;
  registerIndependentCandidate: (candidateData: Partial<StudentCareerPassport> & { name: string; email: string; program: string; branch: string; graduationYear: number; cgpa: number; state: string; independentCredentials: NonNullable<StudentCareerPassport['independentCredentials']> }) => Promise<StudentCareerPassport>;
  registeredUsers: Array<{ uid: string; email: string; role: UserRole; name: string; createdAt?: any; updatedAt?: any }>;
  provisionUserRole: (uid: string, targetRole: UserRole) => Promise<void>;
  resetDemoData: () => void; seedDatabase: () => Promise<void>;
}

const TalentNetworkContext = createContext<TalentNetworkContextType | undefined>(undefined);

export const TalentNetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userData, isSuperAdmin } = useAuth();
  const [selectedEmployerId, setSelectedEmployerId] = useState<string>('emp-1');
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>('inst-1');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('stu-1');
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [students, setStudents] = useState<StudentCareerPassport[]>([]);
  const [requirements, setRequirements] = useState<HiringRequirement[]>([]);
  const [campaigns, setCampaigns] = useState<RecruitmentCampaign[]>([]);
  const [callsForTalent, setCallsForTalent] = useState<CallForTalent[]>([]);
  const [studentOpportunities, setStudentOpportunities] = useState<StudentConsentOpportunity[]>([]);
  const [reputationMatrix, setReputationMatrix] = useState<InstitutionalReputationEntry[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<Array<{ uid: string; email: string; role: UserRole; name: string; createdAt?: any; updatedAt?: any }>>([]);

  useEffect(() => {
    if (!user || !userData) {
      setEmployers([]); setInstitutions([]); setStudents([]); setRequirements([]); setCampaigns([]); setCallsForTalent([]); setStudentOpportunities([]); setRegisteredUsers([]);
      return;
    }
    let unsubUsers: (() => void) | undefined;
    let unsubEmployers: (() => void) | undefined;
    let unsubEmployerOwner: (() => void) | undefined;
    let unsubInstitutions: (() => void) | undefined;
    let unsubInstitutionOwner: (() => void) | undefined;
    let unsubStudents: (() => void) | undefined;
    let unsubRequirements: (() => void) | undefined;
    let unsubCampaigns: (() => void) | undefined;
    let unsubCalls: (() => void) | undefined;
    let unsubOpportunities: (() => void) | undefined;

    const mergeById = <T extends { id: string }>(base: T[], additions: T[]) => {
      const map = new Map(base.map(item => [item.id, item]));
      additions.forEach(item => map.set(item.id, item));
      return Array.from(map.values());
    };

    try {
      if (isSuperAdmin) {
        unsubEmployers = onSnapshot(query(collection(db, 'employers'), limit(100)), snapshot => setEmployers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employer))), err => handleFirestoreError(err, OperationType.LIST, 'employers'));
        unsubInstitutions = onSnapshot(query(collection(db, 'institutions'), limit(100)), snapshot => setInstitutions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Institution))), err => handleFirestoreError(err, OperationType.LIST, 'institutions'));
        unsubRequirements = onSnapshot(query(collection(db, 'requirements'), limit(200)), snapshot => setRequirements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HiringRequirement))), err => handleFirestoreError(err, OperationType.LIST, 'requirements'));
        unsubCampaigns = onSnapshot(query(collection(db, 'campaigns'), limit(200)), snapshot => setCampaigns(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecruitmentCampaign))), err => handleFirestoreError(err, OperationType.LIST, 'campaigns'));
        unsubCalls = onSnapshot(query(collection(db, 'calls'), limit(200)), snapshot => setCallsForTalent(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CallForTalent))), err => handleFirestoreError(err, OperationType.LIST, 'calls'));
      } else {
        if (userData.role === 'employer') {
          unsubEmployers = onSnapshot(query(collection(db, 'employers'), where('verificationStatus', '==', 'verified'), limit(100)), snapshot => setEmployers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employer))), err => handleFirestoreError(err, OperationType.LIST, 'employers'));
          unsubEmployerOwner = onSnapshot(doc(db, 'employers', user.uid), ownerSnap => {
            if (!ownerSnap.exists()) return;
            setEmployers(prev => mergeById(prev, [{ id: ownerSnap.id, ...ownerSnap.data() } as Employer]));
          }, err => handleFirestoreError(err, OperationType.GET, `employers/${user.uid}`));
          unsubRequirements = onSnapshot(query(collection(db, 'requirements'), where('employerId', '==', user.uid), limit(200)), snapshot => setRequirements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HiringRequirement))), err => handleFirestoreError(err, OperationType.LIST, 'requirements'));
          unsubCampaigns = onSnapshot(query(collection(db, 'campaigns'), where('employerId', '==', user.uid), limit(200)), snapshot => setCampaigns(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecruitmentCampaign))), err => handleFirestoreError(err, OperationType.LIST, 'campaigns'));
          unsubCalls = onSnapshot(query(collection(db, 'calls'), where('employerId', '==', user.uid), limit(200)), snapshot => setCallsForTalent(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CallForTalent))), err => handleFirestoreError(err, OperationType.LIST, 'calls'));
        } else if (userData.role === 'institution') {
          unsubEmployers = onSnapshot(query(collection(db, 'employers'), where('verificationStatus', '==', 'verified'), limit(100)), snapshot => setEmployers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employer))), err => handleFirestoreError(err, OperationType.LIST, 'employers'));
          unsubInstitutions = onSnapshot(query(collection(db, 'institutions'), where('empanelmentStatus', '==', 'empanelled'), limit(100)), snapshot => setInstitutions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Institution))), err => handleFirestoreError(err, OperationType.LIST, 'institutions'));
          unsubInstitutionOwner = onSnapshot(doc(db, 'institutions', user.uid), ownerSnap => {
            if (!ownerSnap.exists()) return;
            setInstitutions(prev => mergeById(prev, [{ id: ownerSnap.id, ...ownerSnap.data() } as Institution]));
          }, err => handleFirestoreError(err, OperationType.GET, `institutions/${user.uid}`));
          unsubStudents = onSnapshot(query(collection(db, 'students'), where('institutionId', '==', user.uid), limit(500)), snapshot => setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudentCareerPassport))), err => handleFirestoreError(err, OperationType.LIST, 'students'));
          unsubCampaigns = onSnapshot(query(collection(db, 'campaigns'), where('targetedInstitutionIds', 'array-contains', user.uid), limit(200)), snapshot => setCampaigns(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecruitmentCampaign))), err => handleFirestoreError(err, OperationType.LIST, 'campaigns'));
          unsubCalls = onSnapshot(query(collection(db, 'calls'), where('institutionId', '==', user.uid), limit(200)), snapshot => setCallsForTalent(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CallForTalent))), err => handleFirestoreError(err, OperationType.LIST, 'calls'));
        } else if (userData.role === 'student') {
          unsubStudents = onSnapshot(query(collection(db, 'students'), where(documentId(), '==', user.uid)), snapshot => setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudentCareerPassport))), err => handleFirestoreError(err, OperationType.LIST, 'students'));
        }
      }

      let oppsQuery;
      if (isSuperAdmin) oppsQuery = query(collection(db, 'opportunities'), limit(200));
      else if (userData.role === 'employer') oppsQuery = query(collection(db, 'opportunities'), where('employerId', '==', user.uid), limit(200));
      else if (userData.role === 'institution') oppsQuery = query(collection(db, 'opportunities'), where('institutionId', '==', user.uid), limit(200));
      else if (userData.role === 'student') oppsQuery = query(collection(db, 'opportunities'), where('studentId', '==', user.uid), limit(200));
      if (oppsQuery) unsubOpportunities = onSnapshot(oppsQuery, snapshot => setStudentOpportunities(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudentConsentOpportunity))), err => handleFirestoreError(err, OperationType.LIST, 'opportunities'));

      if (isSuperAdmin) unsubUsers = onSnapshot(query(collection(db, 'users'), limit(500)), snapshot => setRegisteredUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as any))), err => handleFirestoreError(err, OperationType.LIST, 'users'));
    } catch (e) { console.warn('Firestore listener initialization notice:', e); }

    return () => {
      [unsubEmployers, unsubEmployerOwner, unsubInstitutions, unsubInstitutionOwner, unsubStudents, unsubRequirements, unsubCampaigns, unsubCalls, unsubOpportunities, unsubUsers].forEach(unsub => unsub?.());
    };
  }, [user, userData, isSuperAdmin]);

  const activeUid = user?.uid || userData?.uid;
  const defaultEmployer: Employer = { id: activeUid || 'emp-user', name: userData?.role === 'employer' ? userData.name : 'Employer Organization', logo: '🏢', industry: 'Technology & Corporate Solutions', headquarters: 'India', openRequirementsCount: requirements.filter(r => r.employerId === (activeUid || 'emp-user')).length, totalHiresCount: 0, reputationScore: 0, verified: false, verificationStatus: 'pending', verificationDate: '', businessRegNumber: '', contactEmail: userData?.email || '' };
  const defaultInstitution: Institution = { id: activeUid || 'inst-user', name: userData?.role === 'institution' ? userData.name : 'Academic Institution', code: 'INST', type: 'Autonomous College', state: 'National', city: 'Campus', empanelmentStatus: 'pending_empanelment', tier: undefined, accreditation: 'Pending Verification', placementOfficerName: userData?.role === 'institution' ? userData.name : 'Placement Officer', placementOfficerEmail: userData?.email || '', placementOfficerPhone: '', totalStudentSupply: 0, responseRatePercent: 0, historicalOfferRatePercent: 0, historicalJoiningRatePercent: 0, overallRating: 0, specializations: ['Engineering & Technology'], batches: [] };
  const defaultStudent: StudentCareerPassport = { id: activeUid || 'stu-user', name: userData?.role === 'student' ? userData.name : 'Student Candidate', email: userData?.email || '', avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${activeUid || 'student'}`, isEmpanelledCampus: false, candidateType: 'independent_direct', institutionId: '', institutionName: '', institutionCode: '', program: '', branch: '', graduationYear: new Date().getFullYear(), cgpa: 0, state: '', platformVerificationStatus: 'pending', institutionVerificationStatus: 'pending', skills: [], projects: [], internships: [], assessments: [], preferences: { targetRoles: [], preferredLocations: [], minSalaryLPA: 0, employmentTypes: ['Full-Time'] }, availability: 'actively_seeking', placementStatus: 'in_process' };
  const currentEmployer = (activeUid ? employers.find(e => e.id === activeUid) : employers.find(e => e.id === selectedEmployerId)) || employers[0] || defaultEmployer;
  const currentInstitution = (activeUid ? institutions.find(i => i.id === activeUid) : institutions.find(i => i.id === selectedInstitutionId)) || institutions[0] || defaultInstitution;
  const currentStudent = (activeUid ? students.find(s => s.id === activeUid) : students.find(s => s.id === selectedStudentId)) || students[0] || defaultStudent;
  const getInstitutionMatchesForRequirement = (req: HiringRequirement) => getInstitutionMatches(req, institutions, reputationMatrix);
  const getStudentMatchesForRequirement = (req: HiringRequirement) => getStudentMatches(req, students, campaigns);

  const createRequirementAndCampaign = (reqData: Omit<HiringRequirement, 'id' | 'createdAt' | 'employerId' | 'employerName'>) => {
    const newReqId = `req-${crypto.randomUUID()}`; const newCampId = `camp-${crypto.randomUUID()}`;
    const newRequirement: HiringRequirement = { ...reqData, id: newReqId, employerId: currentEmployer.id, employerName: currentEmployer.name, createdAt: new Date().toISOString(), status: 'active' };
    const newCampaign: RecruitmentCampaign = { id: newCampId, requirementId: newReqId, requirement: newRequirement, title: `${newRequirement.role} - Campaign ${new Date().getFullYear()}`, employerId: currentEmployer.id, employerName: currentEmployer.name, createdAt: new Date().toISOString(), status: 'active', funnel: { requiredVacancies: newRequirement.vacancies, institutionsInvited: 0, institutionsAccepted: 0, studentsInvited: 0, applicationsConsented: 0, assessmentsCompleted: 0, shortlisted: 0, interviewed: 0, offersMade: 0, offersAccepted: 0, joined: 0 }, targetedInstitutionIds: [], callsSent: [], candidateOpportunities: [] };
    Promise.all([setDoc(doc(db, 'requirements', newReqId), newRequirement), setDoc(doc(db, 'campaigns', newCampId), newCampaign)]).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
    return { requirement: newRequirement, campaign: newCampaign };
  };

  const sendCallForTalent = (campaignId: string, institutionIds: string[], vacanciesPerInst?: number) => {
    const campaign = campaigns.find(c => c.id === campaignId); if (!campaign) return;
    const newCalls: CallForTalent[] = institutionIds.map(instId => { const inst = institutions.find(i => i.id === instId); const allocatedVacancies = vacanciesPerInst || Math.ceil(campaign.requirement.vacancies / institutionIds.length); return { id: crypto.randomUUID(), campaignId, employerId: campaign.employerId, employerName: campaign.employerName, institutionId: instId, institutionName: inst ? inst.name : 'Partner Institution', role: campaign.requirement.role, vacanciesRequested: allocatedVacancies, salaryLPA: `₹${campaign.requirement.salaryMinLPA} - ${campaign.requirement.salaryMaxLPA} LPA`, locations: campaign.requirement.locations, joiningWindow: campaign.requirement.joiningWindow, deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'pending', createdAt: new Date().toISOString() }; });
    const uniqueInstIds = Array.from(new Set([...campaign.targetedInstitutionIds, ...institutionIds]));
    const updatedCampaign = { ...campaign, targetedInstitutionIds: uniqueInstIds, callsSent: [...campaign.callsSent, ...newCalls], funnel: { ...campaign.funnel, institutionsInvited: uniqueInstIds.length } };
    Promise.all([...newCalls.map(call => setDoc(doc(db, 'calls', call.id), call)), setDoc(doc(db, 'campaigns', campaign.id), updatedCampaign)]).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
  };

  const respondToCallForTalent = (callId: string, status: CallStatus, responseNotes: string, offeredCandidatesCount?: number, counterDaysExtension?: number) => {
    const targetCall = callsForTalent.find(c => c.id === callId); if (!targetCall) return;
    const updatedCall = { ...targetCall, status, responseNotes, offeredCandidatesCount: offeredCandidatesCount || targetCall.vacanciesRequested * 2, counterDaysExtension, respondedAt: new Date().toISOString() };
    const campaign = campaigns.find(c => c.id === targetCall.campaignId); const promises: Promise<any>[] = [setDoc(doc(db, 'calls', callId), updatedCall)];
    if (campaign) promises.push(setDoc(doc(db, 'campaigns', campaign.id), { ...campaign, funnel: { ...campaign.funnel, institutionsAccepted: status !== 'declined' ? campaign.funnel.institutionsAccepted + 1 : campaign.funnel.institutionsAccepted } }));
    Promise.all(promises).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
  };

  const activateInstitutionStudents = (callId: string, studentIds: string[]) => {
    const call = callsForTalent.find(c => c.id === callId); if (!call) return; const campaign = campaigns.find(c => c.id === call.campaignId);
    const campaignMatches = campaign?.requirement ? getStudentMatches(campaign.requirement, students, campaigns) : [];
    const newOpportunities: StudentConsentOpportunity[] = studentIds.map(stuId => { const student = students.find(s => s.id === stuId); const candidateMatch = campaignMatches.find(m => m.studentId === stuId); return { id: crypto.randomUUID(), callId, campaignId: call.campaignId, employerId: call.employerId, employerName: call.employerName, role: call.role, salaryLPA: campaign ? campaign.requirement.salaryMinLPA : 0, locations: call.locations, joiningWindow: call.joiningWindow, studentId: stuId, studentName: student ? student.name : 'Student', institutionId: call.institutionId, institutionName: call.institutionName, matchScore: Math.max(0, Math.min(99, candidateMatch?.candidateFitScore || 0)), matchBreakdown: { skillMatchScore: candidateMatch?.matchedSkills.length && campaign?.requirement.requiredSkills.length ? Math.round((candidateMatch.matchedSkills.length / campaign.requirement.requiredSkills.length) * 100) : 0, academicMatchScore: student && campaign?.requirement.graduationYears.includes(student.graduationYear) ? 100 : 0, preferenceMatchScore: candidateMatch?.visibilityDenied ? 0 : 100, aiRationale: candidateMatch?.alignmentPoints?.[0] || 'Candidate activated through institutional workflow; human evaluation required.' }, stage: 'invited', invitedAt: new Date().toISOString(), stageUpdatedAt: new Date().toISOString() }; });
    const promises: Promise<any>[] = newOpportunities.map(opp => setDoc(doc(db, 'opportunities', opp.id), opp));
    if (campaign) promises.push(setDoc(doc(db, 'campaigns', campaign.id), { ...campaign, candidateOpportunities: [...campaign.candidateOpportunities, ...newOpportunities], funnel: { ...campaign.funnel, studentsInvited: campaign.funnel.studentsInvited + studentIds.length } }));
    Promise.all(promises).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
  };

  const submitStudentConsent = (opportunityId: string, consented: boolean) => {
    const opp = studentOpportunities.find(o => o.id === opportunityId); if (!opp) return; const nextStage: RecruitmentStage = consented ? 'assessment_pending' : 'declined'; const updatedOpp = { ...opp, stage: nextStage, consentedAt: consented ? new Date().toISOString() : undefined, stageUpdatedAt: new Date().toISOString() }; const promises: Promise<any>[] = [setDoc(doc(db, 'opportunities', opportunityId), updatedOpp)];
    if (consented) { const campaign = campaigns.find(c => c.id === opp.campaignId); if (campaign) promises.push(setDoc(doc(db, 'campaigns', campaign.id), { ...campaign, funnel: { ...campaign.funnel, applicationsConsented: campaign.funnel.applicationsConsented + 1 } })); }
    Promise.all(promises).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
  };
  const studentConsentToOpportunity = (opportunityId: string) => submitStudentConsent(opportunityId, true);
  const declineOpportunity = (opportunityId: string) => submitStudentConsent(opportunityId, false);

  const toggleCampaignConsent = (campaignId: string, approved: boolean, reason?: string) => {
    const targetCampaign = campaigns.find(c => c.id === campaignId); const employerName = targetCampaign ? targetCampaign.employerName : 'Employer Campaign'; const role = targetCampaign ? targetCampaign.requirement.role : 'Hiring Opportunity'; const salaryLPA = targetCampaign ? `₹${targetCampaign.requirement.salaryMinLPA} - ${targetCampaign.requirement.salaryMaxLPA} LPA` : undefined; const stu = students.find(s => s.id === selectedStudentId); if (!stu) return;
    const existingConsents = stu.campaignConsents || {}; const updatedPermission: CampaignConsentPermission = { campaignId, employerId: targetCampaign?.employerId || 'emp-1', employerName, role, salaryLPA, status: approved ? 'approved' : 'denied', academicDataShared: approved, skillBenchmarksShared: approved, projectReposShared: approved, contactInfoShared: approved, updatedAt: new Date().toISOString(), reasonForDenial: approved ? undefined : (reason || 'Student elected to withhold data visibility from this employer campaign.') };
    const newAuditRecord: ConsentAuditRecord = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: approved ? 'APPROVED' : 'DENIED', targetCampaign: campaignId, employerName, details: approved ? `Student explicitly approved full career passport visibility for "${role}".` : `Student explicitly denied data visibility for "${role}". ${reason ? `Reason: "${reason}"` : ''}`, actor: `${stu.name} (Self)` };
    const updatedStudent = { ...stu, campaignConsents: { ...existingConsents, [campaignId]: updatedPermission }, consentAuditTrail: [newAuditRecord, ...(stu.consentAuditTrail || [])] };
    const promises: Promise<any>[] = [setDoc(doc(db, 'students', stu.id), updatedStudent)]; const opp = studentOpportunities.find(o => o.studentId === selectedStudentId && o.campaignId === campaignId);
    if (opp) { const updatedOpp = { ...opp }; if (!approved) { updatedOpp.stage = 'declined'; updatedOpp.stageUpdatedAt = new Date().toISOString(); } else if (opp.stage === 'invited' || opp.stage === 'declined') { updatedOpp.stage = 'assessment_pending'; updatedOpp.consentedAt = new Date().toISOString(); updatedOpp.stageUpdatedAt = new Date().toISOString(); } promises.push(setDoc(doc(db, 'opportunities', opp.id), updatedOpp)); }
    Promise.all(promises).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
  };

  const updateCampaignConsentScope = (campaignId: string, scopeKey: keyof Pick<CampaignConsentPermission, 'academicDataShared' | 'skillBenchmarksShared' | 'projectReposShared' | 'contactInfoShared'>, value: boolean) => {
    const stu = students.find(s => s.id === selectedStudentId); if (!stu) return; const existingConsents = stu.campaignConsents || {}; const currentConsent = existingConsents[campaignId]; if (!currentConsent) return;
    const updatedConsent = { ...currentConsent, [scopeKey]: value, updatedAt: new Date().toISOString() }; const scopeLabels: Record<string, string> = { academicDataShared: 'Academic Records & CGPA', skillBenchmarksShared: 'Verified Skill Benchmarks', projectReposShared: 'GitHub & Project Artifacts', contactInfoShared: 'Direct Contact Coordinates' };
    const newAuditRecord: ConsentAuditRecord = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: 'MODIFIED_SCOPES', targetCampaign: campaignId, employerName: currentConsent.employerName, details: `${value ? 'Granted' : 'Revoked'} scope permission: ${scopeLabels[scopeKey] || scopeKey}.`, actor: `${stu.name} (Self)` };
    const updatedStudent = { ...stu, campaignConsents: { ...existingConsents, [campaignId]: updatedConsent }, consentAuditTrail: [newAuditRecord, ...(stu.consentAuditTrail || [])] };
    setDoc(doc(db, 'students', stu.id), updatedStudent).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
  };

  const updateGlobalPrivacySettings = (settings: Partial<StudentGlobalPrivacySettings>) => { const stu = students.find(s => s.id === selectedStudentId); if (!stu) return; const currentSettings = stu.globalDataPrivacy || { allowUnsolicitedPings: false, anonymizeProfileUntilConsent: false, shareVerifiedBadgesGlobally: true, autoDeclineBelowMinSalary: false }; setDoc(doc(db, 'students', stu.id), { ...stu, globalDataPrivacy: { ...currentSettings, ...settings } }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown')); };

  const grantAllCampaignConsents = () => {
    const stu = students.find(s => s.id === selectedStudentId); if (!stu) return; const updatedConsents = { ...(stu.campaignConsents || {}) }; campaigns.forEach(camp => { updatedConsents[camp.id] = { campaignId: camp.id, employerId: camp.employerId, employerName: camp.employerName, role: camp.requirement.role, salaryLPA: `₹${camp.requirement.salaryMinLPA} - ${camp.requirement.salaryMaxLPA} LPA`, status: 'approved', academicDataShared: true, skillBenchmarksShared: true, projectReposShared: true, contactInfoShared: true, updatedAt: new Date().toISOString() }; });
    const audit: ConsentAuditRecord = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: 'GRANTED_ALL', targetCampaign: 'ALL_ACTIVE_CAMPAIGNS', employerName: 'All Network Employers', details: 'Student granted visibility across all active employer recruitment campaigns.', actor: `${stu.name} (Self)` }; setDoc(doc(db, 'students', stu.id), { ...stu, campaignConsents: updatedConsents, consentAuditTrail: [audit, ...(stu.consentAuditTrail || [])] }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
  };

  const revokeAllCampaignConsents = () => {
    const stu = students.find(s => s.id === selectedStudentId); if (!stu) return; const updatedConsents = { ...(stu.campaignConsents || {}) }; campaigns.forEach(camp => { updatedConsents[camp.id] = { campaignId: camp.id, employerId: camp.employerId, employerName: camp.employerName, role: camp.requirement.role, salaryLPA: `₹${camp.requirement.salaryMinLPA} - ${camp.requirement.salaryMaxLPA} LPA`, status: 'denied', academicDataShared: false, skillBenchmarksShared: false, projectReposShared: false, contactInfoShared: false, updatedAt: new Date().toISOString(), reasonForDenial: 'Student engaged Global Privacy Lock (Revoked all campaign visibility).' }; });
    const audit: ConsentAuditRecord = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action: 'REVOKED_ALL', targetCampaign: 'ALL_ACTIVE_CAMPAIGNS', employerName: 'All Network Employers', details: 'Student engaged Global Privacy Lock: Revoked visibility for all employer campaigns.', actor: `${stu.name} (Self)` }; setDoc(doc(db, 'students', stu.id), { ...stu, campaignConsents: updatedConsents, consentAuditTrail: [audit, ...(stu.consentAuditTrail || [])] }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
  };

  const advanceCandidateStage = (opportunityId: string, nextStage: RecruitmentStage, meta?: { assessmentScore?: number; interviewFeedback?: string; offerLetterUrl?: string }) => {
    const opp = studentOpportunities.find(o => o.id === opportunityId); if (!opp) return; const updatedOpp = { ...opp, stage: nextStage, assessmentScore: meta?.assessmentScore ?? opp.assessmentScore, interviewFeedback: meta?.interviewFeedback ?? opp.interviewFeedback, offerLetterUrl: meta?.offerLetterUrl ?? opp.offerLetterUrl, stageUpdatedAt: new Date().toISOString() }; const promises: Promise<any>[] = [setDoc(doc(db, 'opportunities', opp.id), updatedOpp)];
    if (nextStage === 'joined' || nextStage === 'accepted') { const student = students.find(s => s.id === opp.studentId); if (student) promises.push(setDoc(doc(db, 'students', student.id), { ...student, placementStatus: 'placed', placedCompany: opp.employerName, placedSalaryLPA: opp.salaryLPA, availability: 'not_currently_available' })); }
    const campaign = campaigns.find(c => c.id === opp.campaignId); if (campaign) { const funnel = { ...campaign.funnel }; if (nextStage === 'assessment_completed') funnel.assessmentsCompleted += 1; if (nextStage === 'shortlisted') funnel.shortlisted += 1; if (nextStage === 'interviewing') funnel.interviewed += 1; if (nextStage === 'offered') funnel.offersMade += 1; if (nextStage === 'accepted') funnel.offersAccepted += 1; if (nextStage === 'joined') funnel.joined += 1; promises.push(setDoc(doc(db, 'campaigns', campaign.id), { ...campaign, funnel })); }
    Promise.all(promises).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown'));
  };

  const publishInstitutionAvailability = (institutionId: string, batchYear: number, branch: string, count: number, description: string) => { const inst = institutions.find(i => i.id === institutionId); if (!inst) return; const published = inst.publishedAvailability || []; setDoc(doc(db, 'institutions', institutionId), { ...inst, publishedAvailability: [{ batchYear, branch, talentCount: count, description, publishedAt: new Date().toISOString().split('T')[0] }, ...published] }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown')); };

  const updateStudentAvailability = (studentIdOrAvailability: string, maybeAvailability?: StudentCareerPassport['availability']) => { const studentId = maybeAvailability ? studentIdOrAvailability : selectedStudentId; const availability = maybeAvailability ?? (studentIdOrAvailability as StudentCareerPassport['availability']); const student = students.find(s => s.id === studentId); if (!student) return; setDoc(doc(db, 'students', studentId), { ...student, availability }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown')); };

  const addVerifiedSkillToStudent = (studentId: string, skill: { name: string; category: any; score: number; badge: any; verifiedBy: string }) => { const student = students.find(s => s.id === studentId); if (!student) return; const existingSkills = student.skills.filter(sk => sk.name.toLowerCase() !== skill.name.toLowerCase()); setDoc(doc(db, 'students', studentId), { ...student, skills: [{ ...skill, percentile: Math.min(99, Math.round(skill.score * 1.05)), verifiedAt: new Date().toISOString().split('T')[0] }, ...existingSkills] }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown')); };

  const updateEmployerVerification = (employerId: string, status: 'pending' | 'verified' | 'rejected', notes?: string, verifiedByAdmin: boolean = true) => { const employer = employers.find(e => e.id === employerId); if (!employer) return; const updatedEmployer = { ...employer, verificationStatus: status, verifiedByAdmin, verificationNotes: notes !== undefined ? notes : employer.verificationNotes }; setEmployers(prev => prev.map(e => e.id === employerId ? updatedEmployer : e)); setDoc(doc(db, 'employers', employerId), updatedEmployer).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown')); };
  const updateInstitutionEmpanelment = (institutionId: string, status: 'pending' | 'empanelled' | 'rejected', tier?: 'Tier-1 High Assurance' | 'Tier-2 Verified' | 'Tier-3 Provisional', notes?: string) => { const inst = institutions.find(i => i.id === institutionId); if (!inst) return; const updatedInst = { ...inst, empanelmentStatus: status, verifiedByAdmin: status === 'empanelled', tier: tier || inst.tier || (status === 'empanelled' ? 'Tier-1 High Assurance' : 'Tier-3 Provisional'), empanelmentNotes: notes !== undefined ? notes : inst.empanelmentNotes }; setInstitutions(prev => prev.map(i => i.id === institutionId ? updatedInst : i)); setDoc(doc(db, 'institutions', institutionId), updatedInst).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown')); };
  const updateStudentInstitutionVerification = (studentId: string, status: 'pending' | 'verified' | 'rejected', notes?: string) => { const student = students.find(s => s.id === studentId); if (!student) return; const updatedStudent = { ...student, institutionVerificationStatus: status, verificationNotes: notes !== undefined ? notes : student.verificationNotes }; setStudents(prev => prev.map(s => s.id === studentId ? updatedStudent : s)); setDoc(doc(db, 'students', studentId), updatedStudent).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown')); };
  const updateStudentPlatformVerification = (studentId: string, status: 'pending' | 'verified' | 'rejected', notes?: string) => { const student = students.find(s => s.id === studentId); if (!student) return; const updatedStudent = { ...student, platformVerificationStatus: status, verificationNotes: notes !== undefined ? notes : student.verificationNotes }; setStudents(prev => prev.map(s => s.id === studentId ? updatedStudent : s)); setDoc(doc(db, 'students', studentId), updatedStudent).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown')); };

  const registerIndependentCandidate = async (candidateData: Partial<StudentCareerPassport> & { name: string; email: string; program: string; branch: string; graduationYear: number; cgpa: number; state: string; independentCredentials: NonNullable<StudentCareerPassport['independentCredentials']> }): Promise<StudentCareerPassport> => {
    if (!user?.uid) throw new Error('Authentication is required to register an independent candidate.'); const newStudentId = user.uid; const newStudent: StudentCareerPassport = { id: newStudentId, name: candidateData.name, email: candidateData.email, avatar: candidateData.avatar || `https://images.unsplash.com/photo-${1534528741775 + (students.length % 10)}?w=150&auto=format&fit=crop&q=80`, isEmpanelledCampus: false, candidateType: 'independent_direct', institutionId: 'inst-independent', institutionName: candidateData.independentCredentials.collegeName ? `${candidateData.independentCredentials.collegeName} (Direct)` : 'Direct Independent Candidate', institutionCode: 'DIRECT-IND', rollNumber: candidateData.independentCredentials.rollNumber || candidateData.rollNumber, institutionVerificationStatus: 'not_applicable', platformVerificationStatus: 'pending', verificationNotes: `Direct candidate submission on ${new Date().toISOString().split('T')[0]}. Pending Platform Admin credential review.`, independentCredentials: { ...candidateData.independentCredentials, submissionDate: new Date().toISOString().split('T')[0] }, state: candidateData.state || candidateData.independentCredentials.state || 'India', program: candidateData.program || candidateData.independentCredentials.degree || 'B.Tech', branch: candidateData.branch || candidateData.independentCredentials.branch || 'Engineering & Technology', graduationYear: candidateData.graduationYear || candidateData.independentCredentials.graduationYear || 2027, cgpa: candidateData.cgpa || candidateData.independentCredentials.cgpa || 0, skills: candidateData.skills || [], projects: candidateData.projects || [], internships: candidateData.internships || [], assessments: candidateData.assessments || [], preferences: candidateData.preferences || { targetRoles: [], preferredLocations: [], minSalaryLPA: 0, employmentTypes: ['Full-Time'] }, availability: 'actively_seeking', placementStatus: 'unplaced', globalDataPrivacy: { allowUnsolicitedPings: true, anonymizeProfileUntilConsent: false, shareVerifiedBadgesGlobally: true, autoDeclineBelowMinSalary: false } };
    setStudents(prev => [newStudent, ...prev]); setSelectedStudentId(newStudent.id); await setDoc(doc(db, 'students', newStudent.id), newStudent).catch(err => handleFirestoreError(err, OperationType.WRITE, 'unknown')); return newStudent;
  };

  const provisionUserRole = async (targetUid: string, targetRole: UserRole) => { try { const userRef = doc(db, 'users', targetUid); await updateDoc(userRef, { role: targetRole, updatedAt: Timestamp.now() }); setRegisteredUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, role: targetRole } : u)); } catch (err) { console.error('Error provisioning user role:', err); throw err; } };
  const seedDatabase = async () => {};
  const resetDemoData = () => {};

  return <TalentNetworkContext.Provider value={{ selectedEmployerId, setSelectedEmployerId, selectedInstitutionId, setSelectedInstitutionId, selectedStudentId, setSelectedStudentId, currentEmployer, currentInstitution, currentStudent, employers, institutions, students, requirements, campaigns, callsForTalent, studentOpportunities, reputationMatrix, getInstitutionMatchesForRequirement, getStudentMatchesForRequirement, createRequirementAndCampaign, sendCallForTalent, respondToCallForTalent, activateInstitutionStudents, submitStudentConsent, studentConsentToOpportunity, declineOpportunity, toggleCampaignConsent, updateCampaignConsentScope, updateGlobalPrivacySettings, grantAllCampaignConsents, revokeAllCampaignConsents, advanceCandidateStage, publishInstitutionAvailability, updateStudentAvailability, addVerifiedSkillToStudent, updateEmployerVerification, updateInstitutionEmpanelment, updateStudentInstitutionVerification, updateStudentPlatformVerification, registerIndependentCandidate, registeredUsers, provisionUserRole, resetDemoData, seedDatabase }}>{children}</TalentNetworkContext.Provider>;
};

export const useTalentNetwork = () => { const context = useContext(TalentNetworkContext); if (!context) throw new Error('useTalentNetwork must be used within a TalentNetworkProvider'); return context; };

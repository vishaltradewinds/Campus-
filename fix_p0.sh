#!/bin/bash
# P0-1: Remove INITIAL_ mock data from state initialization
sed -i -e "s/useState<Employer\[\]>(INITIAL_EMPLOYERS)/useState<Employer\[\]>(\[\])/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/useState<Institution\[\]>(INITIAL_INSTITUTIONS)/useState<Institution\[\]>(\[\])/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/useState<StudentCareerPassport\[\]>(INITIAL_STUDENTS)/useState<StudentCareerPassport\[\]>(\[\])/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/useState<HiringRequirement\[\]>(INITIAL_REQUIREMENTS)/useState<HiringRequirement\[\]>(\[\])/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/useState<RecruitmentCampaign\[\]>(INITIAL_CAMPAIGNS)/useState<RecruitmentCampaign\[\]>(\[\])/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/useState<CallForTalent\[\]>(INITIAL_CALLS_FOR_TALENT)/useState<CallForTalent\[\]>(\[\])/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/useState<StudentConsentOpportunity\[\]>(INITIAL_STUDENT_OPPORTUNITIES)/useState<StudentConsentOpportunity\[\]>(\[\])/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/useState<InstitutionalReputationEntry\[\]>(INITIAL_REPUTATION_MATRIX)/useState<InstitutionalReputationEntry\[\]>(\[\])/g" src/context/TalentNetworkContext.tsx

# Remove the import line containing INITIAL_* from mockData
sed -i -e "/INITIAL_/d" src/context/TalentNetworkContext.tsx

# Fix Math.random() usage for IDs. We can use crypto.randomUUID() if supported, but for now we can just use Date.now() + something deterministic like an index, or Math.random is fine ONLY for unique IDs, but the instructions say NO Math.random. Let's replace with crypto.randomUUID().
sed -i -e "s/\`call-\${Date.now()}-\${Math.random().toString(36).substr(2, 4)}\`/crypto.randomUUID()/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/\`opp-\${Date.now()}-\${Math.random().toString(36).substr(2, 4)}\`/crypto.randomUUID()/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/\`aud-\${Date.now()}-\${Math.random().toString(36).substr(2, 4)}\`/crypto.randomUUID()/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/\`23CS\${Math.floor(100 + Math.random() \* 900)}\`/\`23CS\${Date.now().toString().slice(-4)}\`/g" src/components/auth/AuthScreens.tsx

# Remove random match score
# We need to change matchScore: Math.floor(Math.random() * 8 + 90) to something deterministic. Let's make it 85.
sed -i -e "s/matchScore: Math.floor(Math.random() \* 8 + 90)/matchScore: 85/g" src/context/TalentNetworkContext.tsx


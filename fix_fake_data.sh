#!/bin/bash
# AuthScreens.tsx fixes
sed -i -e "s/verified: true/verified: false/g" src/components/auth/AuthScreens.tsx
sed -i -e "s/verificationStatus: 'verified'/verificationStatus: 'pending_verification'/g" src/components/auth/AuthScreens.tsx
sed -i -e "s/tier: 'platinum'/tier: undefined/g" src/components/auth/AuthScreens.tsx
sed -i -e "s/empanelmentStatus: 'empanelled'/empanelmentStatus: 'pending_verification'/g" src/components/auth/AuthScreens.tsx

# TalentNetworkContext.tsx fixes
sed -i -e "s/verified: true/verified: false/g" src/context/TalentNetworkContext.tsx
sed -i -e "s/tier: 'platinum'//g" src/context/TalentNetworkContext.tsx


#!/bin/bash
# EmployerPortal.tsx
sed -i -e "s/offerLetterUrl: 'https:\/\/example.com\/offers\/release.pdf'/offerLetterUrl: null/g" src/components/employer/EmployerPortal.tsx

# AuthScreens.tsx
sed -i -e "s/companyCareersUrl || 'https:\/\/example.com\/careers'/companyCareersUrl || ''/g" src/components/auth/AuthScreens.tsx

# SuperAdminPortal.tsx
sed -i -e "s/href={selectedStudentModal.independentCredentials.portfolioUrl || 'https:\/\/github.com'}/href={selectedStudentModal.independentCredentials.portfolioUrl || '#'}/g" src/components/admin/SuperAdminPortal.tsx
sed -i -e "s/{selectedStudentModal.independentCredentials.portfolioUrl || 'github.com\/candidate'}/{selectedStudentModal.independentCredentials.portfolioUrl || 'Not provided'}/g" src/components/admin/SuperAdminPortal.tsx

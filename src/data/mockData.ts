import {
  Employer,
  Institution,
  StudentCareerPassport,
  HiringRequirement,
  RecruitmentCampaign,
  CallForTalent,
  StudentConsentOpportunity,
  InstitutionalReputationEntry,
} from '../types';

export const INITIAL_EMPLOYERS: Employer[] = [
  {
    id: 'emp-1',
    name: 'Tata Consultancy Services (TCS)',
    logo: '🏢',
    industry: 'Enterprise IT, Cloud & Digital Transformation',
    headquarters: 'Mumbai, Maharashtra',
    openRequirementsCount: 4,
    totalHiresCount: 2840,
    reputationScore: 4.9,
    verified: true,
    verificationStatus: 'verified',
    tier: 'platinum',
    verificationDate: '2026-01-15',
    verifiedByAdmin: 'National Placement Governance Board',
    businessRegNumber: 'CIN-L22210MH1995PLC084781',
    gstinOrCin: '27AAACT2879P1ZU',
    websiteUrl: 'https://tcs.com/careers',
    contactEmail: 'campus.recruitment@tcs.com'
  },
  {
    id: 'emp-2',
    name: 'Infosys Limited',
    logo: '🌐',
    industry: 'Next-Gen IT Services & Digital Engineering',
    headquarters: 'Bengaluru, Karnataka',
    openRequirementsCount: 3,
    totalHiresCount: 2150,
    reputationScore: 4.8,
    verified: true,
    verificationStatus: 'verified',
    tier: 'platinum',
    verificationDate: '2026-02-10',
    verifiedByAdmin: 'National Placement Governance Board',
    businessRegNumber: 'CIN-L85110KA1981PLC013115',
    gstinOrCin: '29AAACI4747N1ZQ',
    websiteUrl: 'https://infosys.com/careers',
    contactEmail: 'campus.talent@infosys.com'
  },
  {
    id: 'emp-3',
    name: 'Zoho Corporation',
    logo: '⚡',
    industry: 'Cloud SaaS, Enterprise Applications & Products',
    headquarters: 'Chennai, Tamil Nadu',
    openRequirementsCount: 2,
    totalHiresCount: 920,
    reputationScore: 4.9,
    verified: true,
    verificationStatus: 'verified',
    tier: 'platinum',
    verificationDate: '2026-03-01',
    verifiedByAdmin: 'National Placement Governance Board',
    businessRegNumber: 'CIN-U72900TN2010PTC078120',
    gstinOrCin: '33AABCZ4567M1ZX',
    websiteUrl: 'https://zohocorp.com/careers',
    contactEmail: 'campus@zohocorp.com'
  },
  {
    id: 'emp-4',
    name: 'Razorpay Software',
    logo: '💳',
    industry: 'FinTech, Payments Gateway & Financial Infrastructure',
    headquarters: 'Bengaluru, Karnataka',
    openRequirementsCount: 2,
    totalHiresCount: 460,
    reputationScore: 4.9,
    verified: true,
    verificationStatus: 'verified',
    tier: 'gold',
    verificationDate: '2026-03-12',
    verifiedByAdmin: 'National Placement Governance Board',
    businessRegNumber: 'CIN-U72200KA2013PTC097389',
    gstinOrCin: '29AAGCR4321Q1Z4',
    websiteUrl: 'https://razorpay.com/jobs',
    contactEmail: 'university-talent@razorpay.com'
  },
  {
    id: 'emp-5',
    name: 'L&T Technology Services (LTTS)',
    logo: '🏗️',
    industry: 'Core Engineering, Automotive & Industrial IoT',
    headquarters: 'Vadodara / Mumbai',
    openRequirementsCount: 3,
    totalHiresCount: 1340,
    reputationScore: 4.8,
    verified: true,
    verificationStatus: 'verified',
    tier: 'gold',
    verificationDate: '2026-04-05',
    verifiedByAdmin: 'National Placement Governance Board',
    businessRegNumber: 'CIN-L72900MH2012PLC232169',
    gstinOrCin: '27AABCL3456K1Z9',
    websiteUrl: 'https://ltts.com/careers',
    contactEmail: 'talent.campus@ltts.com'
  },
  {
    id: 'emp-6',
    name: 'Swiggy (Bundl Technologies)',
    logo: '🛵',
    industry: 'Hyperlocal Consumer Tech & AI Logistics',
    headquarters: 'Bengaluru, Karnataka',
    openRequirementsCount: 2,
    totalHiresCount: 380,
    reputationScore: 4.8,
    verified: true,
    verificationStatus: 'verified',
    tier: 'gold',
    verificationDate: '2026-04-10',
    verifiedByAdmin: 'National Placement Governance Board',
    businessRegNumber: 'CIN-U74110KA2013PTC096530',
    gstinOrCin: '29AAGCB9876R1Z2',
    websiteUrl: 'https://swiggy.com/careers',
    contactEmail: 'campus.tech@swiggy.in'
  }
];

export const INITIAL_INSTITUTIONS: Institution[] = [
  {
    id: 'inst-1',
    name: 'Indian Institute of Technology Bombay (IITB)',
    code: 'IITB-MUM',
    type: 'Central University',
    state: 'Maharashtra',
    city: 'Mumbai',
    empanelmentStatus: 'empanelled',
    tier: 'Tier 1',
    accreditation: 'NIRF #3 • NAAC A++',
    placementOfficerName: 'Prof. K. Ramesh (Head, T&P)',
    placementOfficerEmail: 'tpo@iitb.ac.in',
    placementOfficerPhone: '+91 22 2576 7096',
    totalStudentSupply: 2200,
    responseRatePercent: 99,
    historicalOfferRatePercent: 94,
    historicalJoiningRatePercent: 98,
    overallRating: 5.0,
    specializations: ['Computer Science & Engineering', 'Data Science & AI', 'Electrical Engineering', 'Mechanical Engineering'],
    batches: [
      {
        batchYear: 2027,
        program: 'B.Tech / M.Tech',
        totalStudents: 1400,
        placementSeeking: 1250,
        verifiedCount: 1250,
        assessmentReady: 1200,
        highMatchCount: 980,
        branches: [
          { branchName: 'Computer Science & Engineering', totalStudents: 220, placementSeeking: 210, verifiedCount: 210, assessmentReady: 210, highMatchCount: 195 },
          { branchName: 'Data Science & Artificial Intelligence', totalStudents: 140, placementSeeking: 135, verifiedCount: 135, assessmentReady: 135, highMatchCount: 130 },
          { branchName: 'Electrical Engineering', totalStudents: 260, placementSeeking: 240, verifiedCount: 240, assessmentReady: 230, highMatchCount: 180 },
          { branchName: 'Mechanical Engineering', totalStudents: 280, placementSeeking: 250, verifiedCount: 250, assessmentReady: 240, highMatchCount: 160 }
        ]
      }
    ]
  },
  {
    id: 'inst-2',
    name: 'National Institute of Technology Karnataka (NITK)',
    code: 'NITK-SUR',
    type: 'Institute of Technology',
    state: 'Karnataka',
    city: 'Surathkal / Mangaluru',
    empanelmentStatus: 'empanelled',
    tier: 'Tier 1',
    accreditation: 'NIRF #12 • NAAC A+',
    placementOfficerName: 'Dr. Suresh Babu (Career Development Centre)',
    placementOfficerEmail: 'placements@nitk.edu.in',
    placementOfficerPhone: '+91 824 247 4000',
    totalStudentSupply: 1800,
    responseRatePercent: 97,
    historicalOfferRatePercent: 91,
    historicalJoiningRatePercent: 96,
    overallRating: 4.9,
    specializations: ['Information Technology', 'Computer Science & Engg', 'Electronics & Communication', 'Mechanical Engg'],
    batches: [
      {
        batchYear: 2027,
        program: 'B.Tech',
        totalStudents: 1200,
        placementSeeking: 1100,
        verifiedCount: 1100,
        assessmentReady: 1050,
        highMatchCount: 820,
        branches: [
          { branchName: 'Computer Science & Engineering', totalStudents: 200, placementSeeking: 190, verifiedCount: 190, assessmentReady: 190, highMatchCount: 175 },
          { branchName: 'Information Technology', totalStudents: 180, placementSeeking: 175, verifiedCount: 175, assessmentReady: 170, highMatchCount: 160 },
          { branchName: 'Electronics & Communication', totalStudents: 220, placementSeeking: 205, verifiedCount: 205, assessmentReady: 195, highMatchCount: 150 }
        ]
      }
    ]
  },
  {
    id: 'inst-3',
    name: 'Delhi Technological University (DTU)',
    code: 'DTU-DEL',
    type: 'State Engineering College',
    state: 'Delhi NCR',
    city: 'New Delhi',
    empanelmentStatus: 'empanelled',
    tier: 'Tier 1',
    accreditation: 'NIRF #29 • NAAC A+',
    placementOfficerName: 'Prof. Rajesh Rohilla (Head Placement)',
    placementOfficerEmail: 'tpo@dtu.ac.in',
    placementOfficerPhone: '+91 11 2787 1018',
    totalStudentSupply: 2600,
    responseRatePercent: 96,
    historicalOfferRatePercent: 88,
    historicalJoiningRatePercent: 94,
    overallRating: 4.8,
    specializations: ['Software Engineering', 'Computer Science', 'Mathematics & Computing', 'Information Technology'],
    batches: [
      {
        batchYear: 2027,
        program: 'B.Tech',
        totalStudents: 1600,
        placementSeeking: 1480,
        verifiedCount: 1480,
        assessmentReady: 1400,
        highMatchCount: 1100,
        branches: [
          { branchName: 'Computer Science & Engineering', totalStudents: 320, placementSeeking: 310, verifiedCount: 310, assessmentReady: 300, highMatchCount: 280 },
          { branchName: 'Software Engineering', totalStudents: 240, placementSeeking: 230, verifiedCount: 230, assessmentReady: 225, highMatchCount: 210 },
          { branchName: 'Information Technology', totalStudents: 240, placementSeeking: 235, verifiedCount: 235, assessmentReady: 230, highMatchCount: 215 }
        ]
      }
    ]
  },
  {
    id: 'inst-4',
    name: 'RV College of Engineering (RVCE)',
    code: 'RVCE-BLR',
    type: 'Autonomous College',
    state: 'Karnataka',
    city: 'Bengaluru',
    empanelmentStatus: 'empanelled',
    tier: 'Tier 1',
    accreditation: 'Autonomous • NAAC A++',
    placementOfficerName: 'Dr. D. Ranganath (Dean - Placements)',
    placementOfficerEmail: 'placement@rvce.edu.in',
    placementOfficerPhone: '+91 80 6717 8000',
    totalStudentSupply: 1950,
    responseRatePercent: 98,
    historicalOfferRatePercent: 92,
    historicalJoiningRatePercent: 95,
    overallRating: 4.9,
    specializations: ['Computer Science & Engineering', 'AI & Machine Learning', 'Electronics & Communication', 'Data Science'],
    batches: [
      {
        batchYear: 2027,
        program: 'B.Tech / B.E.',
        totalStudents: 1300,
        placementSeeking: 1220,
        verifiedCount: 1220,
        assessmentReady: 1180,
        highMatchCount: 940,
        branches: [
          { branchName: 'Computer Science & Engineering', totalStudents: 280, placementSeeking: 270, verifiedCount: 270, assessmentReady: 265, highMatchCount: 250 },
          { branchName: 'AI & Machine Learning', totalStudents: 180, placementSeeking: 175, verifiedCount: 175, assessmentReady: 170, highMatchCount: 160 },
          { branchName: 'Electronics & Communication', totalStudents: 240, placementSeeking: 220, verifiedCount: 220, assessmentReady: 210, highMatchCount: 170 }
        ]
      }
    ]
  },
  {
    id: 'inst-5',
    name: 'College of Engineering Guindy - Anna University',
    code: 'CEG-CHE',
    type: 'State Engineering College',
    state: 'Tamil Nadu',
    city: 'Chennai',
    empanelmentStatus: 'empanelled',
    tier: 'Tier 1',
    accreditation: 'NIRF #14 • NAAC A++',
    placementOfficerName: 'Dr. T. Kalaiselvan (Director, CUIC)',
    placementOfficerEmail: 'cuic.annauniv@gmail.com',
    placementOfficerPhone: '+91 44 2235 7004',
    totalStudentSupply: 2400,
    responseRatePercent: 95,
    historicalOfferRatePercent: 89,
    historicalJoiningRatePercent: 93,
    overallRating: 4.8,
    specializations: ['Computer Science & Engineering', 'Information Technology', 'Electronics & Comm', 'Mechanical Engg'],
    batches: [
      {
        batchYear: 2027,
        program: 'B.E. / B.Tech',
        totalStudents: 1500,
        placementSeeking: 1380,
        verifiedCount: 1380,
        assessmentReady: 1320,
        highMatchCount: 990,
        branches: [
          { branchName: 'Computer Science & Engineering', totalStudents: 280, placementSeeking: 270, verifiedCount: 270, assessmentReady: 260, highMatchCount: 245 },
          { branchName: 'Information Technology', totalStudents: 220, placementSeeking: 210, verifiedCount: 210, assessmentReady: 205, highMatchCount: 190 }
        ]
      }
    ]
  },
  {
    id: 'inst-6',
    name: 'COEP Technological University',
    code: 'COEP-PUN',
    type: 'State Engineering College',
    state: 'Maharashtra',
    city: 'Pune',
    empanelmentStatus: 'empanelled',
    tier: 'Tier 1',
    accreditation: 'State University • NAAC A+',
    placementOfficerName: 'Dr. Uttam Chaskar (TPO)',
    placementOfficerEmail: 'placement@coep.ac.in',
    placementOfficerPhone: '+91 20 2550 7000',
    totalStudentSupply: 1700,
    responseRatePercent: 96,
    historicalOfferRatePercent: 87,
    historicalJoiningRatePercent: 94,
    overallRating: 4.8,
    specializations: ['Computer Engineering', 'Data Science & AI', 'Mechanical Engg', 'Instrumentation'],
    batches: [
      {
        batchYear: 2027,
        program: 'B.Tech',
        totalStudents: 1100,
        placementSeeking: 1020,
        verifiedCount: 1020,
        assessmentReady: 980,
        highMatchCount: 780,
        branches: [
          { branchName: 'Computer Engineering', totalStudents: 220, placementSeeking: 210, verifiedCount: 210, assessmentReady: 205, highMatchCount: 190 },
          { branchName: 'Data Science & AI', totalStudents: 140, placementSeeking: 135, verifiedCount: 135, assessmentReady: 130, highMatchCount: 120 }
        ]
      }
    ]
  }
];

export const INITIAL_STUDENTS: StudentCareerPassport[] = [
  {
    id: 'stu-1',
    name: 'Rahul Sharma',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    email: 'rahul.sharma@iitb.ac.in',
    isEmpanelledCampus: true,
    candidateType: 'empanelled_campus',
    institutionId: 'inst-1',
    institutionName: 'Indian Institute of Technology Bombay (IITB)',
    institutionCode: 'IITB-MUM',
    rollNumber: '23D070042',
    institutionVerificationStatus: 'verified',
    platformVerificationStatus: 'verified',
    program: 'B.Tech',
    branch: 'Computer Science & Engineering',
    graduationYear: 2027,
    cgpa: 9.2,
    state: 'Maharashtra',
    placementStatus: 'in_process',
    availability: 'actively_seeking',
    skills: [
      { name: 'Data Structures & Algorithms', category: 'technical', score: 96, percentile: 98, badge: 'Gold', verifiedAt: '2026-06-15', verifiedBy: 'Proctored Coding Diagnostic Lab' },
      { name: 'Java & Spring Boot', category: 'technical', score: 92, percentile: 94, badge: 'Gold', verifiedAt: '2026-06-20', verifiedBy: 'Proctored Assessment Benchmark' },
      { name: 'React & TypeScript', category: 'technical', score: 90, percentile: 92, badge: 'Gold', verifiedAt: '2026-07-02', verifiedBy: 'Full-Stack Practical Evaluation' },
      { name: 'System Design & Distributed Systems', category: 'technical', score: 88, percentile: 90, badge: 'Silver', verifiedAt: '2026-07-15', verifiedBy: 'Architecture Benchmark' },
      { name: 'SQL & Database Architecture', category: 'technical', score: 94, percentile: 95, badge: 'Gold', verifiedAt: '2026-07-22', verifiedBy: 'Relational Database Benchmark' }
    ],
    projects: [
      {
        id: 'proj-1',
        title: 'High-Throughput Distributed Cache System',
        description: 'Built a multi-threaded, raft-consensus key-value cache engine in Java capable of handling 50k RPS with sub-5ms latencies.',
        technologies: ['Java', 'Spring Boot', 'Redis', 'Docker', 'Raft Consensus'],
        githubUrl: 'https://github.com/rahul-sharma/distributed-cache',
        verifiedScore: 94
      },
      {
        id: 'proj-2',
        title: 'FinTech Payment Settlement Microservice',
        description: 'Designed an idempotent UPI payment reconciliation pipeline supporting retry queues, DLQ handling, and instant settlement ledger.',
        technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Kafka', 'Docker'],
        githubUrl: 'https://github.com/rahul-sharma/payment-settlement-engine',
        verifiedScore: 91
      }
    ],
    internships: [
      {
        id: 'intern-1',
        company: 'Razorpay Software',
        role: 'Software Engineering Intern',
        duration: 'May 2026 - July 2026 (3 Mos)',
        summary: 'Optimized merchant webhook delivery engine reducing failure retries by 34% across 2M daily webhooks.',
        verified: true
      }
    ],
    assessments: [
      { id: 'ass-1', title: 'National Engineering Coding Benchmark (DSA)', category: 'Technical', score: 96, date: '2026-06-15', percentile: 98 },
      { id: 'ass-2', title: 'Full-Stack Architecture & Microservices', category: 'Domain', score: 91, date: '2026-07-10', percentile: 94 }
    ],
    preferences: {
      targetRoles: ['Software Development Engineer (SDE)', 'Backend Engineer', 'Full-Stack Developer'],
      preferredLocations: ['Bengaluru', 'Mumbai', 'Hyderabad', 'Pune'],
      minSalaryLPA: 12,
      expectedSalaryMinLPA: 16,
      employmentTypes: ['Full-Time']
    },
    globalDataPrivacy: {
      allowUnsolicitedPings: true,
      anonymizeProfileUntilConsent: false,
      shareVerifiedBadgesGlobally: true,
      autoDeclineBelowMinSalary: true
    }
  },
  {
    id: 'stu-2',
    name: 'Priya Venkatesh',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    email: 'priya.v@rvce.edu.in',
    isEmpanelledCampus: true,
    candidateType: 'empanelled_campus',
    institutionId: 'inst-4',
    institutionName: 'RV College of Engineering (RVCE)',
    institutionCode: 'RVCE-BLR',
    rollNumber: '1RV23CS118',
    institutionVerificationStatus: 'verified',
    platformVerificationStatus: 'verified',
    program: 'B.Tech',
    branch: 'Computer Science & Engineering',
    graduationYear: 2027,
    cgpa: 8.95,
    state: 'Karnataka',
    placementStatus: 'in_process',
    availability: 'actively_seeking',
    skills: [
      { name: 'Data Structures & Algorithms', category: 'technical', score: 91, percentile: 93, badge: 'Gold', verifiedAt: '2026-05-18', verifiedBy: 'Proctored Coding Diagnostic Lab' },
      { name: 'Python & FastApi', category: 'technical', score: 94, percentile: 96, badge: 'Gold', verifiedAt: '2026-06-12', verifiedBy: 'Subject Diagnostic Lab' },
      { name: 'Cloud Infrastructure & AWS', category: 'technical', score: 87, percentile: 89, badge: 'Silver', verifiedAt: '2026-07-05', verifiedBy: 'AWS Cloud Benchmark' },
      { name: 'React & Frontend Architecture', category: 'technical', score: 90, percentile: 92, badge: 'Gold', verifiedAt: '2026-07-18', verifiedBy: 'Frontend Practical Benchmark' }
    ],
    projects: [
      {
        id: 'proj-3',
        title: 'Intelligent Real-Time Log Aggregator',
        description: 'Constructed an event-driven telemetry log streaming pipeline processing 10k logs/sec with automated anomaly detection alerts.',
        technologies: ['Python', 'FastAPI', 'Elasticsearch', 'Kafka', 'Docker'],
        githubUrl: 'https://github.com/priya-v/log-streaming-engine',
        verifiedScore: 92
      }
    ],
    internships: [
      {
        id: 'intern-2',
        company: 'Infosys Limited',
        role: 'Digital Specialist Intern',
        duration: 'June 2026 - August 2026 (2 Mos)',
        summary: 'Implemented automated CI/CD container health observability dashboard using OpenTelemetry & Grafana.',
        verified: true
      }
    ],
    assessments: [
      { id: 'ass-3', title: 'National Engineering Coding Benchmark (DSA)', category: 'Technical', score: 91, date: '2026-05-18', percentile: 93 }
    ],
    preferences: {
      targetRoles: ['Software Engineer', 'Full-Stack Developer', 'Cloud Engineer'],
      preferredLocations: ['Bengaluru', 'Chennai', 'Hyderabad'],
      minSalaryLPA: 10,
      expectedSalaryMinLPA: 14,
      employmentTypes: ['Full-Time']
    },
    globalDataPrivacy: {
      allowUnsolicitedPings: true,
      anonymizeProfileUntilConsent: false,
      shareVerifiedBadgesGlobally: true,
      autoDeclineBelowMinSalary: true
    }
  },
  {
    id: 'stu-3',
    name: 'Aditya Verma',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    email: 'aditya.verma@dtu.ac.in',
    isEmpanelledCampus: true,
    candidateType: 'empanelled_campus',
    institutionId: 'inst-3',
    institutionName: 'Delhi Technological University (DTU)',
    institutionCode: 'DTU-DEL',
    rollNumber: '2K23/SE/014',
    institutionVerificationStatus: 'verified',
    platformVerificationStatus: 'verified',
    program: 'B.Tech',
    branch: 'Software Engineering',
    graduationYear: 2027,
    cgpa: 8.7,
    state: 'Delhi NCR',
    placementStatus: 'in_process',
    availability: 'actively_seeking',
    skills: [
      { name: 'C++ & Algorithms', category: 'technical', score: 93, percentile: 95, badge: 'Gold', verifiedAt: '2026-06-01', verifiedBy: 'Proctored Coding Diagnostic Lab' },
      { name: 'Golang & Microservices', category: 'technical', score: 89, percentile: 91, badge: 'Silver', verifiedAt: '2026-06-25', verifiedBy: 'Subject Diagnostic Lab' },
      { name: 'PostgreSQL & Query Optimization', category: 'technical', score: 91, percentile: 93, badge: 'Gold', verifiedAt: '2026-07-14', verifiedBy: 'Database Benchmark' }
    ],
    projects: [
      {
        id: 'proj-4',
        title: 'Distributed Job Scheduler Engine',
        description: 'Engineered a resilient cron & recurring task scheduler in Go with leader election and automatic failover handling.',
        technologies: ['Go', 'PostgreSQL', 'Redis', 'Docker', 'gRPC'],
        githubUrl: 'https://github.com/aditya-verma/go-scheduler',
        verifiedScore: 90
      }
    ],
    internships: [],
    assessments: [
      { id: 'ass-4', title: 'National Coding & Systems Benchmark', category: 'Technical', score: 93, date: '2026-06-01', percentile: 95 }
    ],
    preferences: {
      targetRoles: ['Backend Software Engineer', 'SRE / Systems Engineer'],
      preferredLocations: ['Delhi NCR', 'Bengaluru', 'Gurugram', 'Noida'],
      minSalaryLPA: 9,
      expectedSalaryMinLPA: 12,
      employmentTypes: ['Full-Time']
    },
    globalDataPrivacy: {
      allowUnsolicitedPings: true,
      anonymizeProfileUntilConsent: false,
      shareVerifiedBadgesGlobally: true,
      autoDeclineBelowMinSalary: true
    }
  },
  {
    id: 'stu-4',
    name: 'Ananya Deshmukh',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    email: 'ananya.deshmukh@coep.ac.in',
    isEmpanelledCampus: true,
    candidateType: 'empanelled_campus',
    institutionId: 'inst-6',
    institutionName: 'COEP Technological University',
    institutionCode: 'COEP-PUN',
    rollNumber: '112303045',
    institutionVerificationStatus: 'verified',
    platformVerificationStatus: 'verified',
    program: 'B.Tech',
    branch: 'Data Science & AI',
    graduationYear: 2027,
    cgpa: 8.85,
    state: 'Maharashtra',
    placementStatus: 'in_process',
    availability: 'actively_seeking',
    skills: [
      { name: 'Python & Machine Learning', category: 'technical', score: 95, percentile: 97, badge: 'Gold', verifiedAt: '2026-05-20', verifiedBy: 'AI/ML Skill Benchmark' },
      { name: 'Data Structures & Algorithms', category: 'technical', score: 88, percentile: 90, badge: 'Silver', verifiedAt: '2026-06-10', verifiedBy: 'Coding Diagnostic Lab' },
      { name: 'PyTorch & Neural Networks', category: 'technical', score: 92, percentile: 94, badge: 'Gold', verifiedAt: '2026-07-01', verifiedBy: 'Deep Learning Practical Lab' }
    ],
    projects: [
      {
        id: 'proj-5',
        title: 'Conversational Legal Document Analysis Agent',
        description: 'Created a Retrieval-Augmented Generation (RAG) assistant for analyzing Indian corporate contracts and extracting compliance risk clauses.',
        technologies: ['Python', 'PyTorch', 'FastAPI', 'LangChain', 'ChromaDB'],
        githubUrl: 'https://github.com/ananya-d/legal-rag-ai',
        verifiedScore: 93
      }
    ],
    internships: [],
    assessments: [],
    preferences: {
      targetRoles: ['AI/ML Engineer', 'Data Scientist', 'Software Engineer'],
      preferredLocations: ['Pune', 'Mumbai', 'Bengaluru', 'Hyderabad'],
      minSalaryLPA: 10,
      expectedSalaryMinLPA: 15,
      employmentTypes: ['Full-Time']
    },
    globalDataPrivacy: {
      allowUnsolicitedPings: true,
      anonymizeProfileUntilConsent: false,
      shareVerifiedBadgesGlobally: true,
      autoDeclineBelowMinSalary: true
    }
  },
  {
    id: 'stu-5',
    name: 'Karthik Sundaram',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    email: 'karthik.s@ceg.annauniv.edu',
    isEmpanelledCampus: true,
    candidateType: 'empanelled_campus',
    institutionId: 'inst-5',
    institutionName: 'College of Engineering Guindy - Anna University',
    institutionCode: 'CEG-CHE',
    rollNumber: '2023103562',
    institutionVerificationStatus: 'verified',
    platformVerificationStatus: 'verified',
    program: 'B.E.',
    branch: 'Computer Science & Engineering',
    graduationYear: 2027,
    cgpa: 8.65,
    state: 'Tamil Nadu',
    placementStatus: 'in_process',
    availability: 'actively_seeking',
    skills: [
      { name: 'Java & Microservices', category: 'technical', score: 91, percentile: 93, badge: 'Gold', verifiedAt: '2026-06-08', verifiedBy: 'Enterprise Java Benchmark' },
      { name: 'Data Structures & Algorithms', category: 'technical', score: 89, percentile: 91, badge: 'Silver', verifiedAt: '2026-06-28', verifiedBy: 'Proctored Diagnostic Lab' },
      { name: 'PostgreSQL & Redis', category: 'technical', score: 88, percentile: 90, badge: 'Silver', verifiedAt: '2026-07-16', verifiedBy: 'Database Benchmark' }
    ],
    projects: [
      {
        id: 'proj-6',
        title: 'Core Banking Ledger & Transaction Engine',
        description: 'Developed an ACID-compliant double-entry ledger engine in Java Spring Boot with distributed locking and audit trail.',
        technologies: ['Java', 'Spring Boot', 'PostgreSQL', 'Redis', 'Docker'],
        githubUrl: 'https://github.com/karthik-s/banking-ledger',
        verifiedScore: 90
      }
    ],
    internships: [],
    assessments: [],
    preferences: {
      targetRoles: ['Software Engineer', 'Backend Developer', 'FinTech Engineer'],
      preferredLocations: ['Chennai', 'Bengaluru', 'Hyderabad'],
      minSalaryLPA: 8.5,
      expectedSalaryMinLPA: 12,
      employmentTypes: ['Full-Time']
    },
    globalDataPrivacy: {
      allowUnsolicitedPings: true,
      anonymizeProfileUntilConsent: false,
      shareVerifiedBadgesGlobally: true,
      autoDeclineBelowMinSalary: true
    }
  }
];

export const INITIAL_REQUIREMENTS: HiringRequirement[] = [
  {
    id: 'req-1',
    employerId: 'emp-4',
    employerName: 'Razorpay Software',
    role: 'Graduate Software Development Engineer (SDE-1)',
    vacancies: 25,
    education: ['B.Tech', 'B.E.', 'M.Tech', 'MCA'],
    graduationYears: [2027],
    branches: ['Computer Science & Engineering', 'Information Technology', 'Data Science & AI', 'Electronics & Communication'],
    requiredSkills: ['Data Structures & Algorithms', 'Java & Spring Boot', 'SQL & Database Architecture', 'System Design & Distributed Systems'],
    experienceLevel: 'Fresher / Campus Graduate (2027 Batch)',
    locations: ['Bengaluru', 'Remote / Hybrid'],
    salaryMinLPA: 14,
    salaryMaxLPA: 22,
    joiningWindow: 'July 2027 (Pre-Placement Internship from Jan 2027)',
    assessmentRequirements: ['Online Coding & Problem Solving (90 Mins)', 'System Design & Core CS Fundamentals'],
    selectionProcess: ['Online Proctored Coding Test', 'Technical Interview 1 (DSA & Problem Solving)', 'Technical Interview 2 (Projects & Architecture)', 'HR & Culture Fit'],
    candidateProfileSummary: 'Targeting high-aptitude fresh engineers passionate about building world-class financial technology and payment gateways.',
    createdAt: '2026-08-01T09:00:00Z',
    status: 'active'
  },
  {
    id: 'req-2',
    employerId: 'emp-3',
    employerName: 'Zoho Corporation',
    role: 'Product Development Engineer (SaaS Applications)',
    vacancies: 40,
    education: ['B.Tech', 'B.E.', 'BCA', 'MCA', 'B.Sc Computer Science'],
    graduationYears: [2027],
    branches: ['Computer Science & Engineering', 'Information Technology', 'Electronics & Communication', 'All Engineering Streams'],
    requiredSkills: ['Data Structures & Algorithms', 'Java & Spring Boot', 'React & TypeScript', 'SQL & Database Architecture'],
    experienceLevel: 'Campus Graduate / Fresher (2027)',
    locations: ['Chennai', 'Tenkasi', 'Bengaluru'],
    salaryMinLPA: 8.5,
    salaryMaxLPA: 14,
    joiningWindow: 'June 2027',
    assessmentRequirements: ['Zoho Advanced Programming Round (C/Java)', 'Complex Application Design'],
    selectionProcess: ['Round 1: Basic Programming & Aptitude', 'Round 2: Advanced Coding & DSA', 'Round 3: Application Development (CLI / Web)', 'Round 4: Technical & HR'],
    candidateProfileSummary: 'Passionate coders with pure problem-solving drive to engineer scalable enterprise SaaS products used by 100M+ users globally.',
    createdAt: '2026-08-05T10:00:00Z',
    status: 'active'
  },
  {
    id: 'req-3',
    employerId: 'emp-1',
    employerName: 'Tata Consultancy Services (TCS)',
    role: 'TCS Digital & Prime Specialist Engineer',
    vacancies: 150,
    education: ['B.Tech', 'B.E.', 'M.Tech', 'MCA'],
    graduationYears: [2027],
    branches: ['Computer Science & Engineering', 'Information Technology', 'AI & Data Science', 'Electronics & Communication', 'Electrical Engineering'],
    requiredSkills: ['Data Structures & Algorithms', 'Python & FastApi', 'Java & Spring Boot', 'Cloud Infrastructure & AWS'],
    experienceLevel: 'Campus Graduate (2027 Batch)',
    locations: ['Bengaluru', 'Mumbai', 'Hyderabad', 'Pune', 'Chennai', 'Delhi NCR'],
    salaryMinLPA: 9,
    salaryMaxLPA: 13.5,
    joiningWindow: 'July - August 2027',
    assessmentRequirements: ['TCS National Qualifier Test (Advanced Coding & Cognitive)'],
    selectionProcess: ['TCS National Coding Test', 'Technical Interview (Coding & Projects)', 'Management & HR Discussion'],
    candidateProfileSummary: 'High-performing engineering talent for TCS Next-Gen Digital Lab building Cloud, AI, and enterprise banking architectures.',
    createdAt: '2026-08-10T11:00:00Z',
    status: 'active'
  }
];

export const INITIAL_CAMPAIGNS: RecruitmentCampaign[] = [
  {
    id: 'camp-1',
    requirementId: 'req-1',
    requirement: INITIAL_REQUIREMENTS[0],
    title: 'Razorpay Campus Drive 2027 - Graduate SDE-1',
    employerId: 'emp-4',
    employerName: 'Razorpay Software',
    createdAt: '2026-08-01T09:30:00Z',
    status: 'active',
    funnel: {
      requiredVacancies: 25,
      institutionsInvited: 4,
      institutionsAccepted: 4,
      studentsInvited: 120,
      applicationsConsented: 85,
      assessmentsCompleted: 78,
      shortlisted: 32,
      interviewed: 24,
      offersMade: 18,
      offersAccepted: 16,
      joined: 0
    },
    targetedInstitutionIds: ['inst-1', 'inst-2', 'inst-3', 'inst-4'],
    callsSent: [],
    candidateOpportunities: []
  },
  {
    id: 'camp-2',
    requirementId: 'req-2',
    requirement: INITIAL_REQUIREMENTS[1],
    title: 'Zoho Product Hiring Drive 2027',
    employerId: 'emp-3',
    employerName: 'Zoho Corporation',
    createdAt: '2026-08-05T10:30:00Z',
    status: 'active',
    funnel: {
      requiredVacancies: 40,
      institutionsInvited: 5,
      institutionsAccepted: 5,
      studentsInvited: 210,
      applicationsConsented: 165,
      assessmentsCompleted: 152,
      shortlisted: 65,
      interviewed: 48,
      offersMade: 35,
      offersAccepted: 32,
      joined: 0
    },
    targetedInstitutionIds: ['inst-1', 'inst-2', 'inst-4', 'inst-5', 'inst-6'],
    callsSent: [],
    candidateOpportunities: []
  },
  {
    id: 'camp-3',
    requirementId: 'req-3',
    requirement: INITIAL_REQUIREMENTS[2],
    title: 'TCS Prime & Digital National Campus Drive 2027',
    employerId: 'emp-1',
    employerName: 'Tata Consultancy Services (TCS)',
    createdAt: '2026-08-10T11:30:00Z',
    status: 'active',
    funnel: {
      requiredVacancies: 150,
      institutionsInvited: 6,
      institutionsAccepted: 6,
      studentsInvited: 450,
      applicationsConsented: 380,
      assessmentsCompleted: 340,
      shortlisted: 180,
      interviewed: 140,
      offersMade: 95,
      offersAccepted: 88,
      joined: 0
    },
    targetedInstitutionIds: ['inst-1', 'inst-2', 'inst-3', 'inst-4', 'inst-5', 'inst-6'],
    callsSent: [],
    candidateOpportunities: []
  }
];

export const INITIAL_CALLS_FOR_TALENT: CallForTalent[] = [
  {
    id: 'call-1',
    campaignId: 'camp-1',
    employerId: 'emp-4',
    employerName: 'Razorpay Software',
    institutionId: 'inst-1',
    institutionName: 'Indian Institute of Technology Bombay (IITB)',
    role: 'Graduate Software Development Engineer (SDE-1)',
    vacanciesRequested: 8,
    salaryLPA: '₹14 - 22 LPA',
    locations: ['Bengaluru', 'Remote / Hybrid'],
    joiningWindow: 'July 2027',
    deadline: '2026-09-15',
    status: 'accepted',
    responseNotes: 'Approved by IIT Bombay T&P Cell. Batch of 2027 B.Tech CSE & EE eligible with 8.0+ CGPA.',
    offeredCandidatesCount: 35,
    createdAt: '2026-08-01T10:00:00Z',
    respondedAt: '2026-08-02T14:30:00Z'
  },
  {
    id: 'call-2',
    campaignId: 'camp-1',
    employerId: 'emp-4',
    employerName: 'Razorpay Software',
    institutionId: 'inst-4',
    institutionName: 'RV College of Engineering (RVCE)',
    role: 'Graduate Software Development Engineer (SDE-1)',
    vacanciesRequested: 6,
    salaryLPA: '₹14 - 22 LPA',
    locations: ['Bengaluru', 'Remote / Hybrid'],
    joiningWindow: 'July 2027',
    deadline: '2026-09-15',
    status: 'accepted',
    responseNotes: 'Accepted. Test slot scheduled for RVCE 2027 batch.',
    offeredCandidatesCount: 28,
    createdAt: '2026-08-01T10:00:00Z',
    respondedAt: '2026-08-03T11:00:00Z'
  },
  {
    id: 'call-3',
    campaignId: 'camp-2',
    employerId: 'emp-3',
    employerName: 'Zoho Corporation',
    institutionId: 'inst-5',
    institutionName: 'College of Engineering Guindy - Anna University',
    role: 'Product Development Engineer (SaaS Applications)',
    vacanciesRequested: 15,
    salaryLPA: '₹8.5 - 14 LPA',
    locations: ['Chennai', 'Tenkasi', 'Bengaluru'],
    joiningWindow: 'June 2027',
    deadline: '2026-09-20',
    status: 'accepted',
    responseNotes: 'Anna University Placement Cell confirmed on-campus coding round.',
    offeredCandidatesCount: 65,
    createdAt: '2026-08-05T11:00:00Z',
    respondedAt: '2026-08-06T15:00:00Z'
  }
];

export const INITIAL_STUDENT_OPPORTUNITIES: StudentConsentOpportunity[] = [
  {
    id: 'opp-1',
    callId: 'call-1',
    campaignId: 'camp-1',
    employerId: 'emp-4',
    employerName: 'Razorpay Software',
    role: 'Graduate Software Development Engineer (SDE-1)',
    salaryLPA: 18,
    locations: ['Bengaluru', 'Hybrid'],
    joiningWindow: 'July 2027',
    studentId: 'stu-1',
    studentName: 'Rahul Sharma',
    institutionId: 'inst-1',
    institutionName: 'Indian Institute of Technology Bombay (IITB)',
    matchScore: 96,
    matchBreakdown: {
      skillMatchScore: 97,
      academicMatchScore: 95,
      preferenceMatchScore: 96,
      aiRationale: 'Exceptional fit with high DSA diagnostic scores, prior FinTech webhook intern experience, and strong Java/Distributed Systems competencies.'
    },
    alignmentReasons: [
      'Top 2% proctored coding score in DSA and Java',
      'Completed software intern project at Razorpay',
      'Target salary ₹16 LPA matches offer range (₹14-22 LPA)'
    ],
    stage: 'interviewing',
    assessmentScore: 96,
    interviewFeedback: 'Cleared Technical Round 1 (Binary Tree & Cache concurrency problem). Technical Round 2 scheduled.',
    invitedAt: '2026-08-02T10:00:00Z',
    consentedAt: '2026-08-02T11:30:00Z',
    stageUpdatedAt: '2026-08-15T16:00:00Z'
  },
  {
    id: 'opp-2',
    callId: 'call-2',
    campaignId: 'camp-1',
    employerId: 'emp-4',
    employerName: 'Razorpay Software',
    role: 'Graduate Software Development Engineer (SDE-1)',
    salaryLPA: 16,
    locations: ['Bengaluru', 'Hybrid'],
    joiningWindow: 'July 2027',
    studentId: 'stu-2',
    studentName: 'Priya Venkatesh',
    institutionId: 'inst-4',
    institutionName: 'RV College of Engineering (RVCE)',
    matchScore: 92,
    matchBreakdown: {
      skillMatchScore: 93,
      academicMatchScore: 91,
      preferenceMatchScore: 92,
      aiRationale: 'Strong coding aptitude, 8.95 CGPA, and solid cloud observability and full-stack credentials.'
    },
    alignmentReasons: [
      'Verified 91% in DSA Proctored Benchmark',
      'RVCE 2027 B.Tech CSE with 8.95 CGPA',
      'Bengaluru location preference match'
    ],
    stage: 'shortlisted',
    assessmentScore: 91,
    invitedAt: '2026-08-03T10:00:00Z',
    consentedAt: '2026-08-03T14:00:00Z',
    stageUpdatedAt: '2026-08-14T11:00:00Z'
  },
  {
    id: 'opp-3',
    callId: 'call-3',
    campaignId: 'camp-2',
    employerId: 'emp-3',
    employerName: 'Zoho Corporation',
    role: 'Product Development Engineer (SaaS Applications)',
    salaryLPA: 12,
    locations: ['Chennai', 'Bengaluru'],
    joiningWindow: 'June 2027',
    studentId: 'stu-5',
    studentName: 'Karthik Sundaram',
    institutionId: 'inst-5',
    institutionName: 'College of Engineering Guindy - Anna University',
    matchScore: 91,
    matchBreakdown: {
      skillMatchScore: 92,
      academicMatchScore: 90,
      preferenceMatchScore: 91,
      aiRationale: 'Solid Java Spring Boot ledger project, high algorithms score, and Chennai base alignment.'
    },
    alignmentReasons: [
      'Anna University CEG CSE 2027 Batch',
      'High core Java & Database design benchmarks',
      'Chennai home location match'
    ],
    stage: 'assessment_completed',
    assessmentScore: 89,
    invitedAt: '2026-08-06T10:00:00Z',
    consentedAt: '2026-08-06T12:00:00Z',
    stageUpdatedAt: '2026-08-16T10:00:00Z'
  }
];

export const INITIAL_REPUTATION_MATRIX: InstitutionalReputationEntry[] = [
  {
    institutionId: 'inst-1',
    institutionName: 'Indian Institute of Technology Bombay (IITB)',
    roleCategory: 'Core Software & AI Systems',
    eligibleSample: 210,
    applicants: 195,
    offerRatePercent: 94,
    joiningRatePercent: 98,
    skillAccuracyPercent: 97,
    benchmarkScore: 98,
    notableStrength: 'Exceptional algorithmic foundations, low attrition, and immediate production readiness.'
  },
  {
    institutionId: 'inst-2',
    institutionName: 'National Institute of Technology Karnataka (NITK)',
    roleCategory: 'Software & Cloud Engineering',
    eligibleSample: 190,
    applicants: 175,
    offerRatePercent: 91,
    joiningRatePercent: 96,
    skillAccuracyPercent: 94,
    benchmarkScore: 94,
    notableStrength: 'Strong distributed systems and practical full-stack engineering skills.'
  },
  {
    institutionId: 'inst-3',
    institutionName: 'Delhi Technological University (DTU)',
    roleCategory: 'Software Engineering & Microservices',
    eligibleSample: 310,
    applicants: 280,
    offerRatePercent: 88,
    joiningRatePercent: 94,
    skillAccuracyPercent: 92,
    benchmarkScore: 91,
    notableStrength: 'High competitive programming aptitude and microservices competency.'
  },
  {
    institutionId: 'inst-4',
    institutionName: 'RV College of Engineering (RVCE)',
    roleCategory: 'Product Engineering & Full-Stack',
    eligibleSample: 270,
    applicants: 250,
    offerRatePercent: 92,
    joiningRatePercent: 95,
    skillAccuracyPercent: 95,
    benchmarkScore: 93,
    notableStrength: 'Fast onboarding in high-growth tech hubs and industry-aligned coursework.'
  },
  {
    institutionId: 'inst-5',
    institutionName: 'College of Engineering Guindy - Anna University',
    roleCategory: 'Enterprise SaaS & Backend',
    eligibleSample: 270,
    applicants: 245,
    offerRatePercent: 89,
    joiningRatePercent: 93,
    skillAccuracyPercent: 93,
    benchmarkScore: 90,
    notableStrength: 'Strong engineering fundamentals and enterprise Java capabilities.'
  },
  {
    institutionId: 'inst-6',
    institutionName: 'COEP Technological University',
    roleCategory: 'AI, Data Science & Core Systems',
    eligibleSample: 210,
    applicants: 190,
    offerRatePercent: 87,
    joiningRatePercent: 94,
    skillAccuracyPercent: 91,
    benchmarkScore: 89,
    notableStrength: 'High analytical rigor and solid ML pipeline development capabilities.'
  }
];

export interface DomainAssessmentTemplate {
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

export const DOMAIN_ASSESSMENTS: DomainAssessmentTemplate[] = [
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

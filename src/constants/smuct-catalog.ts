export interface SmuctDepartmentCatalogEntry {
  deptCode: string;
  deptFull: string;
  deptAliases?: string[];
  programs: Array<{ name: string; shortName: string }>;
}

export const SMUCT_FACULTY_ALIASES: Record<string, string[]> = {
  ET: [
    "FACULTY OF ENGINEERING & TECHNOLOGY",
    "Faculty of Engineering & Technology (E&T)",
    "Faculty of Engineering & Technology",
    "Engineering & Technology",
    "Engineering & Tech",
    "E&T",
    "ET",
    "FET",
  ],
  DT: [
    "FACULTY OF DESIGN & TECHNOLOGY",
    "Faculty of Design & Technology (D&T)",
    "Faculty of Design & Technology",
    "Design & Technology",
    "Design & Tech",
    "D&T",
    "DT",
    "FDT",
  ],
  FOB: [
    "FACULTY OF BUSINESS",
    "Faculty of Business (FOB)",
    "Faculty of Business",
    "Business & Management",
    "Business",
    "FOB",
  ],
  HSS: [
    "FACULTY OF HUMANITIES & SOCIAL SCIENCES",
    "Faculty of Humanities & Social Sciences (H&SS)",
    "Faculty of Humanities & Social Sciences",
    "Humanities & Social Sciences",
    "H&SS",
    "HSS",
    "FHSS",
  ],
  FPA: [
    "FACULTY OF FINE & PERFORMING ARTS",
    "Faculty of Fine & Performing Arts (F&PA)",
    "Faculty of Fine & Performing Arts",
    "Fine & Performing Arts",
    "F&PA",
    "FPA",
    "FFPA",
  ],
};

export const SMUCT_PROGRAM_CATALOG: SmuctDepartmentCatalogEntry[] = [
  {
    deptCode: "CSE",
    deptFull: "Computer Science and Engineering",
    deptAliases: ["computer science"],
    programs: [
      { name: "B.Sc (Hons) in Computer Science and Engineering", shortName: "B.Sc CSE" },
    ],
  },
  {
    deptCode: "CSIT",
    deptFull: "Computer Science and Information Technology",
    deptAliases: ["information technology"],
    programs: [
      { name: "B.Sc (Hons) in Computer Science and Information Technology", shortName: "B.Sc CSIT" },
    ],
  },
  {
    deptCode: "FDT",
    deptFull: "Fashion Design and Technology",
    deptAliases: ["fashion design"],
    programs: [
      { name: "BA (Hons) in Fashion Design and Technology", shortName: "B.A. FDT" },
      { name: "M.A. in Fashion Design", shortName: "M.A. FD" },
    ],
  },
  {
    deptCode: "AMMT",
    deptFull: "Apparel Manufacturing Management and Technology",
    deptAliases: ["apparel"],
    programs: [
      { name: "BA (Hons) in Apparel Manufacturing Management and Technology", shortName: "B.A. AMMT" },
      { name: "MBA in Product & Fashion Merchandizing", shortName: "MBA (PFM)" },
    ],
  },
  {
    deptCode: "IA",
    deptFull: "Interior Architecture",
    deptAliases: ["interior design"],
    programs: [
      { name: "BA (Hons) in Interior Architecture", shortName: "B.A. IA" },
      { name: "M.A. in Interior Design", shortName: "M.A. ID" },
    ],
  },
  {
    deptCode: "GDM",
    deptFull: "Graphic Design and Multimedia",
    deptAliases: ["graphic design"],
    programs: [
      { name: "BA (Hons) in Graphic Design and Multimedia", shortName: "B.A. GDM" },
      { name: "M.A. in Graphic Design and Multimedia", shortName: "M.A. GDM" },
    ],
  },
  {
    deptCode: "ARCH",
    deptFull: "Architecture",
    programs: [{ name: "Bachelor of Architecture", shortName: "B.Arch" }],
  },
  {
    deptCode: "BBA",
    deptFull: "Business Administration",
    deptAliases: ["business"],
    programs: [
      { name: "Bachelor of Business Administration (BBA)", shortName: "BBA" },
      { name: "Masters of Business Administration (MBA)", shortName: "MBA" },
      { name: "Executive Master of Business Administration (EMBA)", shortName: "EMBA" },
    ],
  },
  {
    deptCode: "ENG",
    deptFull: "English",
    programs: [
      { name: "BA (Hons) in English (Language & Literature)", shortName: "B.A. ENG" },
      { name: "MA in English", shortName: "M.A. ENG" },
    ],
  },
  {
    deptCode: "LAW",
    deptFull: "Law",
    deptAliases: ["llb", "llm"],
    programs: [
      { name: "Bachelor of Laws (LLB)", shortName: "LL.B" },
      { name: "Master of Laws (LLM)", shortName: "LL.M" },
    ],
  },
  {
    deptCode: "SOC",
    deptFull: "Sociology & Anthropology",
    deptAliases: ["sociology", "anthropology"],
    programs: [
      { name: "BSS (Hons) in Sociology & Anthropology", shortName: "BSS SOC" },
      { name: "MSS in Sociology & Anthropology", shortName: "MSS SOC" },
    ],
  },
  {
    deptCode: "BAN",
    deptFull: "Bangla",
    programs: [
      { name: "BA (Hons) in Bangla", shortName: "B.A. BAN" },
      { name: "MA in Bangla", shortName: "M.A. BAN" },
    ],
  },
  {
    deptCode: "G&P",
    deptFull: "Government & Politics",
    deptAliases: ["government and politics", "gp"],
    programs: [
      { name: "BSS (Hons) in Government & Politics", shortName: "BSS G&P" },
      { name: "MSS in Government & Politics", shortName: "MSS G&P" },
    ],
  },
  {
    deptCode: "IS",
    deptFull: "Islamic Studies",
    programs: [
      { name: "BA (Hons) in Islamic Studies", shortName: "B.A. IS" },
      { name: "MA in Islamic Studies", shortName: "M.A. IS" },
    ],
  },
  {
    deptCode: "FA",
    deptFull: "Fine Arts",
    deptAliases: ["fine art"],
    programs: [
      { name: "Bachelor of Fine Arts (Hons) Drawing & Painting", shortName: "BFA" },
      { name: "Master of Fine Arts", shortName: "MFA" },
    ],
  },
  {
    deptCode: "MUS",
    deptFull: "Music",
    programs: [
      { name: "Bachelor of Music (Hons) Rabindra, Nazrul, Classical", shortName: "B.Mus" },
      { name: "Master of Music in Rabindra, Nazrul, Classical", shortName: "M.Mus" },
    ],
  },
  {
    deptCode: "DAN",
    deptFull: "Dance",
    programs: [
      { name: "Bachelor of Music (Hons) in Dance", shortName: "B.Dance" },
      { name: "Master of Music in Dance", shortName: "M.Dance" },
    ],
  },
];

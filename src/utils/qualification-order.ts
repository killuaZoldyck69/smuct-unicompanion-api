/**
 * Qualification Hierarchy & Order in Bangladesh (Academic & Professional Standard):
 * Highest to Lowest (Reverse-Chronological):
 * 1. Ph.D. / Doctorate
 * 2. M.Phil.
 * 3. Master's Degree (e.g., M.Sc., MBA, M.A.)
 * 4. Postgraduate Diploma (PGD)
 * 5. Bachelor's Degree (e.g., B.Sc. Engg., B.Sc. Hons, BBA)
 * 6. Higher Secondary Certificate (H.S.C)
 * 7. Secondary School Certificate (S.S.C)
 */

export function getQualificationRank(degreeTitle: string): number {
  if (!degreeTitle || typeof degreeTitle !== "string") return 99;

  const text = degreeTitle.trim().toLowerCase();
  const clean = text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ");
  const tokens = clean.split(/\s+/).filter(Boolean);

  // 1. Ph.D. / Doctorate
  if (
    tokens.includes("phd") ||
    tokens.includes("dphil") ||
    tokens.includes("doctorate") ||
    text.includes("ph.d") ||
    text.includes("d.phil") ||
    text.includes("doctor of philosophy") ||
    text.includes("post-doc") ||
    text.includes("postdoc")
  ) {
    return 1;
  }

  // 2. M.Phil.
  if (
    tokens.includes("mphil") ||
    text.includes("m.phil") ||
    text.includes("master of philosophy")
  ) {
    return 2;
  }

  // 3. Master's Degree (e.g. M.Sc., MBA, M.A., M.Engg., M.Tech, M.Ed, LL.M.)
  if (
    tokens.includes("msc") ||
    tokens.includes("ms") ||
    tokens.includes("mba") ||
    tokens.includes("emba") ||
    tokens.includes("ma") ||
    tokens.includes("mcom") ||
    tokens.includes("mtech") ||
    tokens.includes("mengg") ||
    tokens.includes("meng") ||
    tokens.includes("med") ||
    tokens.includes("llm") ||
    tokens.includes("march") ||
    tokens.includes("mpharm") ||
    tokens.includes("mfa") ||
    text.includes("m.sc") ||
    text.includes("m.s.") ||
    text.includes("m.a.") ||
    text.includes("m.com") ||
    text.includes("m.tech") ||
    text.includes("m.engg") ||
    text.includes("m.eng") ||
    text.includes("ll.m") ||
    text.includes("m.ed") ||
    text.includes("master") ||
    text.includes("masters") ||
    text.includes("post-graduation") ||
    text.includes("postgraduation")
  ) {
    return 3;
  }

  // 4. Postgraduate Diploma (PGD)
  if (
    tokens.includes("pgd") ||
    tokens.includes("pgdiploma") ||
    text.includes("p.g.d") ||
    text.includes("pgd") ||
    text.includes("post graduate diploma") ||
    text.includes("postgraduate diploma") ||
    text.includes("pg diploma")
  ) {
    return 4;
  }

  // 5. Bachelor's Degree (e.g. B.Sc. Engg., B.Sc. Hons, BBA, B.A., LL.B., B.Arch)
  if (
    tokens.includes("bsc") ||
    tokens.includes("bs") ||
    tokens.includes("bba") ||
    tokens.includes("ba") ||
    tokens.includes("bcom") ||
    tokens.includes("btech") ||
    tokens.includes("bengg") ||
    tokens.includes("beng") ||
    tokens.includes("bed") ||
    tokens.includes("llb") ||
    tokens.includes("barch") ||
    tokens.includes("bpharm") ||
    tokens.includes("bfa") ||
    tokens.includes("mbbs") ||
    tokens.includes("bds") ||
    text.includes("b.sc") ||
    text.includes("b.s.") ||
    text.includes("b.a.") ||
    text.includes("b.com") ||
    text.includes("b.tech") ||
    text.includes("b.engg") ||
    text.includes("b.eng") ||
    text.includes("ll.b") ||
    text.includes("b.ed") ||
    text.includes("bachelor") ||
    text.includes("bachelors") ||
    text.includes("undergraduate") ||
    text.includes("graduation") ||
    text.includes("honours") ||
    text.includes("hons")
  ) {
    return 5;
  }

  // 6. Higher Secondary Certificate (H.S.C)
  if (
    tokens.includes("hsc") ||
    tokens.includes("alim") ||
    text.includes("h.s.c") ||
    text.includes("higher secondary") ||
    text.includes("intermediate") ||
    text.includes("a level") ||
    text.includes("a-level") ||
    text.includes("a levels") ||
    text.includes("12th")
  ) {
    return 6;
  }

  // 7. Secondary School Certificate (S.S.C)
  if (
    tokens.includes("ssc") ||
    tokens.includes("dakhil") ||
    tokens.includes("matric") ||
    tokens.includes("matriculation") ||
    text.includes("s.s.c") ||
    text.includes("secondary school") ||
    text.includes("o level") ||
    text.includes("o-level") ||
    text.includes("o levels") ||
    text.includes("10th")
  ) {
    return 7;
  }

  // General Diploma
  if (tokens.includes("diploma") || text.includes("diploma")) {
    return 8;
  }

  return 9;
}

function extractYear(val: any): number {
  if (typeof val === "number" && val >= 1950 && val <= 2099) return val;
  if (typeof val === "string") {
    const match = val.match(/\b(19\d{2}|20\d{2})\b/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
}

export function sortQualifications<T>(
  items: T[],
  getDegree: (item: T) => string,
  getYearOrDetails?: (item: T) => any
): T[] {
  if (!Array.isArray(items) || items.length <= 1) return items ? [...items] : [];

  return [...items].sort((a, b) => {
    const degA = getDegree(a) || "";
    const degB = getDegree(b) || "";

    const rankA = getQualificationRank(degA);
    const rankB = getQualificationRank(degB);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    if (getYearOrDetails) {
      const yearA = extractYear(getYearOrDetails(a)) || extractYear(degA);
      const yearB = extractYear(getYearOrDetails(b)) || extractYear(degB);
      if (yearA && yearB && yearA !== yearB) {
        return yearB - yearA;
      }
    }

    return 0;
  });
}

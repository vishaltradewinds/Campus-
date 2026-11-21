export interface JoinedEvidence {
  id: string;
  studentId: string;
  institutionId: string;
  stage: string;
  employerId?: string;
  joinedAt?: string;
  joinedSalaryLPA?: number;
  offerRecordId?: string;
}

export function buildPlacementExtract(institutionId: string, opportunities: JoinedEvidence[], startDate: string, endDateExclusive: string) {
  const start = Date.parse(startDate), end = Date.parse(endDateExclusive);
  if (!institutionId || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('Invalid report scope');
  const rows = new Map<string, JoinedEvidence>();
  let missingEvidence = 0;
  for (const o of opportunities) {
    if (o.institutionId !== institutionId || o.stage !== 'joined') continue;
    const joined = Date.parse(o.joinedAt || '');
    if (!Number.isFinite(joined) || !o.id || !o.studentId || !o.offerRecordId || !o.employerId || typeof o.joinedSalaryLPA !== 'number' || !Number.isFinite(o.joinedSalaryLPA) || o.joinedSalaryLPA < 0) {
      missingEvidence++;
      continue;
    }
    if (joined >= start && joined < end) rows.set(o.id, o);
  }
  const recorded = Array.from(rows.values()).sort((a,b) => a.id.localeCompare(b.id));
  const uniqueStudents = new Set(recorded.map(o => o.studentId)).size;
  return { recorded, uniqueStudents, missingEvidence, reportStatus: 'LIMITED_OPERATIONAL_EXTRACT' as const };
}

// Quote all values, escape embedded quotes, and neutralize spreadsheet formula prefixes.
export function toSafeCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>) {
  return rows.map(row => row.map(value => {
    let s = String(value ?? '');
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}

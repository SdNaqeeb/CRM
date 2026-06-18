import { MockExamItem, MockExamResultItem } from '../services/api';

// ─── Subject & Class inference ───────────────────────────────────────────────

const PHYSICS_KEYWORDS = [
  'electric charges', 'electrostatic', 'current electricity', 'magnetic effects',
  'electromagnetic', 'ray optics', 'wave optics', 'dual nature', 'atoms', 'nuclei',
  'semiconductor', 'oscillations', 'waves', 'gravitation', 'laws of motion',
  'work energy', 'thermodynamics', 'kinetic theory',
];

const MATHS_KEYWORDS = [
  'real numbers', 'polynomials', 'probability', 'relations', 'functions',
  'inverse trig', 'matrices', 'determinants', 'coordinate geometry',
  'linear eq', 'number systems', 'arithmetic progressions', 'quadratic',
  'statistics', 'permutation', 'combination', 'binomial', 'limits',
  'derivatives', 'integrals', 'vectors', 'three dimensional', 'linear programming',
];

// Chapters that only appear in Class 12 syllabi
const CLASS12_KEYWORDS = [
  'relations and functions', 'inverse trig', 'matrices', 'determinants',
  'continuity', 'differentiability', 'integrals', 'differential equations',
  'linear programming', 'solutions', 'electrochemistry', 'chemical kinetics',
  'surface chemistry', 'p-block', 'd and f-block', 'coordination',
  'haloalkanes', 'aldehydes', 'amines', 'biomolecules', 'polymers',
  'electric charges', 'electrostatic', 'current electricity', 'magnetic effects',
  'electromagnetic induction', 'alternating current', 'ray optics', 'wave optics',
  'dual nature', 'atoms', 'nuclei', 'semiconductor',
];

function chapterText(item: MockExamItem): string {
  // Replace underscores with spaces to handle SNAKE_CASE chapter names
  return [...item.chapters, item.description ?? ''].join(' ').toLowerCase().replace(/_/g, ' ');
}

export type Subject = 'Maths' | 'Science' | 'Physics';

export function inferSubject(item: MockExamItem): Subject {
  // Check chapters first — most reliable, handles Physics chapters mislabelled under "Science" titles
  const chapterTxt = chapterText(item);
  if (PHYSICS_KEYWORDS.some(kw => chapterTxt.includes(kw))) return 'Physics';
  if (MATHS_KEYWORDS.some(kw => chapterTxt.includes(kw))) return 'Maths';

  // Fall back to title keywords
  const title = (item.title ?? '').toLowerCase().replace(/_/g, ' ');
  if (/physics/.test(title)) return 'Physics';
  if (/math/.test(title)) return 'Maths';
  if (/science/.test(title)) return 'Science';

  return 'Science';
}

export function inferClass(item: MockExamItem, results?: MockExamResultItem[]): string {
  const fromResults = results?.find(r => r.class_name)?.class_name;
  if (fromResults) return fromResults;
  const text = chapterText(item);
  if (CLASS12_KEYWORDS.some(kw => text.includes(kw))) return 'Class 12';
  return 'Class 10';
}

// ─── Programme-level KPIs ────────────────────────────────────────────────────

export interface ProgrammeKPIs {
  totalExams: number;
  examsWithSubmissions: number;
  totalSubmissions: number;
  weightedAvgScore: number | null;
  zeroSubExamCodes: string[];
}

export function computeProgrammeKPIs(exams: MockExamItem[]): ProgrammeKPIs {
  const active = exams.filter(e => e.total_submissions > 0);
  const totalSubs = active.reduce((s, e) => s + e.total_submissions, 0);

  let weightedSum = 0;
  let weightedTotal = 0;
  for (const e of active) {
    if (e.average_score !== null) {
      weightedSum += e.average_score * e.total_submissions;
      weightedTotal += e.total_submissions;
    }
  }

  return {
    totalExams: exams.length,
    examsWithSubmissions: active.length,
    totalSubmissions: totalSubs,
    weightedAvgScore: weightedTotal > 0 ? weightedSum / weightedTotal : null,
    zeroSubExamCodes: exams
      .filter(e => e.total_submissions === 0)
      .map(e => e.homework_code ?? String(e.homework_id)),
  };
}

// ─── Subject breakdown ────────────────────────────────────────────────────────

export interface SubjectBreakdown {
  subject: Subject;
  examCount: number;
  submissions: number;
  weightedAvg: number | null;
  examAverages: number[];   // sorted asc — used for box plot
}

export function computeSubjectBreakdown(exams: MockExamItem[]): SubjectBreakdown[] {
  const map = new Map<Subject, {
    count: number; subs: number;
    weightedSum: number; weightedTotal: number; avgs: number[];
  }>();

  for (const exam of exams) {
    if (exam.total_submissions === 0) continue;
    const subject = inferSubject(exam);
    if (!map.has(subject)) {
      map.set(subject, { count: 0, subs: 0, weightedSum: 0, weightedTotal: 0, avgs: [] });
    }
    const e = map.get(subject)!;
    e.count++;
    e.subs += exam.total_submissions;
    if (exam.average_score !== null) {
      e.weightedSum += exam.average_score * exam.total_submissions;
      e.weightedTotal += exam.total_submissions;
      e.avgs.push(exam.average_score);
    }
  }

  return Array.from(map.entries()).map(([subject, d]) => ({
    subject,
    examCount: d.count,
    submissions: d.subs,
    weightedAvg: d.weightedTotal > 0 ? d.weightedSum / d.weightedTotal : null,
    examAverages: [...d.avgs].sort((a, b) => a - b),
  }));
}

// ─── Box plot stats ───────────────────────────────────────────────────────────

export interface BoxStats {
  min: number; q1: number; median: number; q3: number; max: number; mean: number;
}

export function computeBoxStats(sorted: number[]): BoxStats | null {
  if (!sorted.length) return null;
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const lo = sorted.slice(0, mid);
  const hi = sorted.slice(n % 2 === 0 ? mid : mid + 1);
  const q1 = lo.length ? lo[Math.floor(lo.length / 2)] : sorted[0];
  const q3 = hi.length ? hi[Math.floor(hi.length / 2)] : sorted[n - 1];
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  return { min: sorted[0], q1, median, q3, max: sorted[n - 1], mean };
}

// ─── Per-exam summary stats ───────────────────────────────────────────────────

export interface ExamSummaryStats {
  n: number;
  avg: number;
  median: number;
  passRate: number;        // 0–100
  needsReviewCount: number;
  perfectCount: number;
  medianTimeMins: number;
  passThresholdPct: number;
}

export function computeExamSummaryStats(
  results: MockExamResultItem[],
  passThresholdPct = 40,
): ExamSummaryStats {
  const empty: ExamSummaryStats = {
    n: 0, avg: 0, median: 0, passRate: 0,
    needsReviewCount: 0, perfectCount: 0, medianTimeMins: 0, passThresholdPct,
  };
  if (!results.length) return empty;

  // score is already a 0-100 percentage from the API
  const pcts = results
    .map(r => r.score)
    .sort((a, b) => a - b);
  const times = [...results.map(r => r.time_spent_seconds)].sort((a, b) => a - b);
  const n = results.length;
  const mid = Math.floor(n / 2);

  const avg = pcts.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (pcts[mid - 1] + pcts[mid]) / 2 : pcts[mid];
  const medianTimeSecs = n % 2 === 0 ? (times[mid - 1] + times[mid]) / 2 : times[mid];
  const needsReviewCount = pcts.filter(p => p < passThresholdPct).length;
  const perfectCount = pcts.filter(p => p === 100).length;

  return {
    n,
    avg,
    median,
    passRate: ((n - needsReviewCount) / n) * 100,
    needsReviewCount,
    perfectCount,
    medianTimeMins: medianTimeSecs / 60,
    passThresholdPct,
  };
}

// ─── Score-band distribution ──────────────────────────────────────────────────

export interface ScoreBand {
  label: string;
  min: number;
  max: number;
  count: number;
  pct: number;
  color: string;
}

const BANDS: { label: string; min: number; max: number; color: string }[] = [
  { label: '90–100', min: 90, max: 100, color: '#10B981' },
  { label: '75–89',  min: 75, max: 89,  color: '#34D399' },
  { label: '60–74',  min: 60, max: 74,  color: '#F59E0B' },
  { label: '40–59',  min: 40, max: 59,  color: '#FB923C' },
  { label: '<40',    min: 0,  max: 39,  color: '#F43F5E' },
];

export function computeScoreBands(results: MockExamResultItem[]): ScoreBand[] {
  const n = results.length;
  return BANDS.map(b => {
    const count = results.filter(r => r.score >= b.min && r.score <= b.max).length;
    return { ...b, count, pct: n > 0 ? (count / n) * 100 : 0 };
  });
}

// ─── Section averages ─────────────────────────────────────────────────────────

export interface SectionAverage {
  section: string;
  avg: number;
  count: number;
}

export function computeSectionAverages(results: MockExamResultItem[]): SectionAverage[] {
  const map = new Map<string, { sum: number; count: number }>();
  for (const r of results) {
    const sec = r.section_name ?? 'Unknown';
    if (!map.has(sec)) map.set(sec, { sum: 0, count: 0 });
    const e = map.get(sec)!;
    e.sum += r.score;
    e.count++;
  }
  return Array.from(map.entries())
    .map(([section, d]) => ({ section, avg: d.sum / d.count, count: d.count }))
    .sort((a, b) => a.section.localeCompare(b.section));
}

// ─── Cross-exam scores (scatter: same student, two exams) ─────────────────────

export interface CrossExamScore {
  studentId: number;
  studentName: string;
  score1Pct: number;
  score2Pct: number;
}

export function computeCrossExamScores(
  results1: MockExamResultItem[],
  results2: MockExamResultItem[],
): CrossExamScore[] {
  const map2 = new Map(results2.map(r => [r.student_id, r]));
  return results1
    .filter(r => map2.has(r.student_id))
    .map(r => {
      const r2 = map2.get(r.student_id)!;
      return {
        studentId: r.student_id,
        studentName: r.student_name,
        score1Pct: r.score,
        score2Pct: r2.score,
      };
    });
}

// ─── Time vs score scatter data ───────────────────────────────────────────────

export interface TimeScorePoint {
  studentName: string;
  section: string;
  scorePercent: number;
  timeMins: number;
  unanswered: number;
}

export function computeTimeScoreData(results: MockExamResultItem[]): TimeScorePoint[] {
  return results.map(r => ({
    studentName: r.student_name,
    section: r.section_name ?? '?',
    scorePercent: r.score,
    timeMins: r.time_spent_seconds / 60,
    unanswered: r.unanswered,
  }));
}

// ─── Integrity flags ──────────────────────────────────────────────────────────

export interface IntegrityFlag {
  studentName: string;
  section: string;
  scorePercent: number;
  timeMins: number;
  unanswered: number;
}

export function flagFastPerfect(
  results: MockExamResultItem[],
  maxTimeSecs = 150,
  minScorePct = 97,
): IntegrityFlag[] {
  return results
    .filter(r => r.time_spent_seconds <= maxTimeSecs && r.score >= minScorePct)
    .map(r => ({
      studentName: r.student_name,
      section: r.section_name ?? '?',
      scorePercent: r.score,
      timeMins: r.time_spent_seconds / 60,
      unanswered: r.unanswered,
    }))
    .sort((a, b) => a.timeMins - b.timeMins);
}

export function flagRushedAbandoned(
  results: MockExamResultItem[],
  maxTimeSecs = 72,
  maxScorePct = 50,
): IntegrityFlag[] {
  return results
    .filter(r => r.time_spent_seconds <= maxTimeSecs && r.score < maxScorePct)
    .map(r => ({
      studentName: r.student_name,
      section: r.section_name ?? '?',
      scorePercent: r.score,
      timeMins: r.time_spent_seconds / 60,
      unanswered: r.unanswered,
    }))
    .sort((a, b) => a.timeMins - b.timeMins);
}

// ─── Needs-review watch-list ──────────────────────────────────────────────────

export interface NeedsReviewStudent {
  studentName: string;
  section: string;
  scorePercent: number;
}

export function computeNeedsReview(
  results: MockExamResultItem[],
  passThresholdPct = 40,
): NeedsReviewStudent[] {
  return results
    .filter(r => r.score < passThresholdPct)
    .map(r => ({
      studentName: r.student_name,
      section: r.section_name ?? '?',
      scorePercent: r.score,
    }))
    .sort((a, b) => a.scorePercent - b.scorePercent);
}

// ─── Section × subject averages (Figure 4) ───────────────────────────────────

export interface SectionSubjectRow {
  section: string;
  [subject: string]: number | string;
}

export function computeSectionSubjectAverages(
  pairs: { results: MockExamResultItem[]; subject: string }[],
): SectionSubjectRow[] {
  const sMap = new Map<string, Record<string, { sum: number; n: number }>>();
  for (const { results, subject } of pairs) {
    for (const r of results) {
      const sec = r.section_name ?? '?';
      if (!sMap.has(sec)) sMap.set(sec, {});
      const d = sMap.get(sec)!;
      if (!d[subject]) d[subject] = { sum: 0, n: 0 };
      d[subject].sum += r.score;
      d[subject].n++;
    }
  }
  return Array.from(sMap.entries())
    .map(([section, d]) => {
      const row: SectionSubjectRow = { section };
      for (const [subj, { sum, n }] of Object.entries(d)) {
        row[subj] = Math.round((sum / n) * 10) / 10;
      }
      return row;
    })
    .sort((a, b) => String(a.section).localeCompare(String(b.section)));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function scorePct(r: MockExamResultItem): number {
  return r.score;
}

export function fmtPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function fmtTimeMins(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

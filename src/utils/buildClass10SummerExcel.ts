import ExcelJS from 'exceljs';
import { examAPI, dashboardAPI, MockExamItem } from '../services/api';

function normalizeClassCode(value?: string | null): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  const numberMatch = trimmed.match(/\d+/);
  return numberMatch ? numberMatch[0] : trimmed.replace(/^class\s+/i, '');
}

function normalizeSectionName(value?: string | null): string {
  if (!value) return '';
  return String(value).trim().replace(/^section\s+/i, '');
}

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

const PURPLE = 'FF7C3AED';
const PURPLE_SOFT = 'FFEDE4FC';
const BLUE = 'FF3B82F6';
const GRAY_SOFT = 'FFF1F5F9';
const TEXT_MUTED = 'FF64748B';

function inferSubject(exam: MockExamItem): 'Physics' | 'Maths' | 'Science' {
  const chapterTxt = [...(exam.chapters || []), exam.description ?? '']
    .join(' ').toLowerCase().replace(/_/g, ' ');
  if (PHYSICS_KEYWORDS.some(kw => chapterTxt.includes(kw))) return 'Physics';
  if (MATHS_KEYWORDS.some(kw => chapterTxt.includes(kw))) return 'Maths';
  const title = (exam.title ?? '').toLowerCase().replace(/_/g, ' ');
  if (/physics/.test(title)) return 'Physics';
  if (/math/.test(title)) return 'Maths';
  return 'Science';
}

function periodFromDate(dateStr: string | null): 'before' | 'after' | null {
  if (!dateStr) return null;
  const month = dateStr.slice(5, 7);
  if (month === '04') return 'before';
  if (month === '06') return 'after';
  return null;
}

export interface StudentRow {
  name: string;
  username: string | null;
  rollNumber: string | null;
  section: string;
  maths: { before: number | null; after: number | null };
  science: { before: number | null; after: number | null };
}

export interface SubjectStats {
  avgBefore: number | null;
  avgAfter: number | null;
  gain: number | null;
  pctImproved: number | null;
}

export interface SummerComparisonData {
  sections: string[];
  bySection: Record<string, StudentRow[]>;
  allStudents: StudentRow[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const CACHE_PREFIX = 'class10SummerComparison_v6_';
// In-memory cache avoids re-parsing localStorage repeatedly within the same session.
const memoryCache: Record<string, SummerComparisonData> = {};

function cacheKey(teacherUsername: string, classFilter: string, sectionFilter: string): string {
  return `${CACHE_PREFIX}${teacherUsername}_${classFilter}_${sectionFilter}`;
}

function readCache(key: string): SummerComparisonData | null {
  if (memoryCache[key] && Date.now() - memoryCache[key].fetchedAt < CACHE_TTL_MS) {
    return memoryCache[key];
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: SummerComparisonData = JSON.parse(raw);
    if (Date.now() - parsed.fetchedAt >= CACHE_TTL_MS) return null;
    memoryCache[key] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: SummerComparisonData) {
  memoryCache[key] = data;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore storage failures (e.g. quota exceeded, private browsing)
  }
}

async function fetchSummerComparisonData(
  teacherUsername: string,
  classFilter: string,
  sectionFilter: string,
): Promise<SummerComparisonData> {
  const examsRes = await examAPI.getMockExams(teacherUsername, 200);
  const allExams = examsRes.items || [];

  const relevantExams = allExams.filter(e => {
    if (e.total_submissions <= 0) return false;
    const subject = inferSubject(e);
    if (subject !== 'Maths' && subject !== 'Science') return false;
    return periodFromDate(e.date_assigned) !== null;
  });

  const students: Record<number, StudentRow> = {};

  for (const exam of relevantExams) {
    const subject = inferSubject(exam);
    const period = periodFromDate(exam.date_assigned);
    if (!period) continue;
    const subjKey = subject === 'Maths' ? 'maths' : 'science';

    const res = await examAPI.getMockExamResults(exam.homework_id, 500);
    const items = res.items || [];
    for (const r of items) {
      if (classFilter !== 'All' && String(r.class_name) !== classFilter) continue;
      const section = r.section_name;
      if (!section) continue;
      if (sectionFilter !== 'All' && section !== sectionFilter) continue;
      const key = r.student_id;
      students[key] = students[key] || {
        name: r.student_name,
        username: r.username,
        rollNumber: r.roll_number,
        section,
        maths: { before: null, after: null },
        science: { before: null, after: null },
      };
      const existing = students[key][subjKey][period];
      // If a student has two attempts in the same subject/period (rare retake), keep the higher score.
      students[key][subjKey][period] = existing === null ? r.score : Math.max(existing, r.score);
    }
  }

  // Fill in students from the full roster who never attempted a relevant exam,
  // so every enrolled student in the class/section shows up (with blank scores).
  try {
    const dashboard = await dashboardAPI.getTeacherDashboardByUsername(teacherUsername);
    for (const stu of dashboard.students || []) {
      if (students[stu.student_id]) continue;
      const classCode = normalizeClassCode(stu.grade);
      if (classFilter !== 'All' && classCode !== classFilter) continue;
      const section = normalizeSectionName(stu.section);
      if (!section) continue;
      if (sectionFilter !== 'All' && section !== sectionFilter) continue;

      students[stu.student_id] = {
        name: stu.full_name,
        username: stu.username ?? null,
        rollNumber: null,
        section,
        maths: { before: null, after: null },
        science: { before: null, after: null },
      };
    }
  } catch {
    // If the roster fetch fails, fall back to exam-attempt-only data.
  }

  const bySection: Record<string, StudentRow[]> = {};
  for (const sid in students) {
    const s = students[sid];
    bySection[s.section] = bySection[s.section] || [];
    bySection[s.section].push(s);
  }

  const sections = Object.keys(bySection).sort();

  return { sections, bySection, allStudents: Object.values(students), fetchedAt: Date.now() };
}

export async function getSummerComparisonData(
  teacherUsername: string,
  classFilter: string = '10',
  sectionFilter: string = 'All',
  forceRefresh = false,
): Promise<SummerComparisonData> {
  const key = cacheKey(teacherUsername, classFilter, sectionFilter);
  if (!forceRefresh) {
    const cached = readCache(key);
    if (cached) return cached;
  }
  const data = await fetchSummerComparisonData(teacherUsername, classFilter, sectionFilter);
  writeCache(key, data);
  return data;
}

export function subjectStats(rows: StudentRow[], subjKey: 'maths' | 'science'): SubjectStats {
  const withBoth = rows.filter(r => r[subjKey].before !== null && r[subjKey].after !== null);
  if (withBoth.length === 0) {
    return { avgBefore: null, avgAfter: null, gain: null, pctImproved: null };
  }
  const avgBefore = withBoth.reduce((sum, r) => sum + r[subjKey].before!, 0) / withBoth.length;
  const avgAfter = withBoth.reduce((sum, r) => sum + r[subjKey].after!, 0) / withBoth.length;
  const improvedCount = withBoth.filter(r => r[subjKey].after! > r[subjKey].before!).length;
  return {
    avgBefore,
    avgAfter,
    gain: avgBefore !== 0 ? ((avgAfter - avgBefore) / avgBefore) * 100 : null,
    pctImproved: improvedCount / withBoth.length,
  };
}

function titleCell(ws: ExcelJS.Worksheet, row: number, lastCol: number, text: string, opts?: { subtitle?: boolean }) {
  ws.mergeCells(row, 1, row, lastCol);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = opts?.subtitle
    ? { italic: true, size: 11, color: { argb: TEXT_MUTED } }
    : { bold: true, size: 14, color: { argb: PURPLE } };
  cell.alignment = { vertical: 'middle' };
}

function styleHeaderRow(ws: ExcelJS.Worksheet, row: number, lastCol: number, fillArgb: string = PURPLE) {
  for (let c = 1; c <= lastCol; c++) {
    const cell = ws.getCell(row, c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  }
}

function buildSummarySheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  classLabel: string,
  sections: string[],
  bySection: Record<string, StudentRow[]>,
  allStudents: StudentRow[],
) {
  const ws = wb.addWorksheet(sheetName);
  const lastCol = 8;

  titleCell(ws, 1, lastCol, `${classLabel} — Summer Diagnostic: Before vs After (Consolidated Summary)`);
  titleCell(ws, 2, lastCol, `April diagnostic vs June re-test · Smart Learners platform · ${sections.length === 1 ? `Section ${sections[0]}` : `All ${sections.length} sections`} on one sheet`, { subtitle: true });
  ws.addRow([]);

  ws.mergeCells(4, 1, 4, 2);
  ws.mergeCells(4, 3, 4, 5);
  ws.mergeCells(4, 6, 4, 8);
  ws.getCell(4, 3).value = 'MATHS';
  ws.getCell(4, 6).value = 'SCIENCE';
  [3, 6].forEach(c => {
    const cell = ws.getCell(4, c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getCell(4, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_SOFT } };

  const headerRow = ['Section', 'Students', 'Avg Before', 'Avg After', '% Gain', 'Avg Before', 'Avg After', '% Gain'];
  ws.getRow(5).values = headerRow;
  styleHeaderRow(ws, 5, lastCol);

  let r = 6;
  for (const section of sections) {
    const sectionRows = bySection[section];
    const maths = subjectStats(sectionRows, 'maths');
    const science = subjectStats(sectionRows, 'science');
    ws.getRow(r).values = [
      `Sec ${section}`, sectionRows.length,
      maths.avgBefore, maths.avgAfter, maths.gain,
      science.avgBefore, science.avgAfter, science.gain,
    ];
    [3, 4, 5, 6, 7, 8].forEach(c => { ws.getCell(r, c).numFmt = '0.#'; });
    r++;
  }

  const allMaths = subjectStats(allStudents, 'maths');
  const allScience = subjectStats(allStudents, 'science');
  const allRow = ws.getRow(r);
  allRow.values = [
    `${classLabel.toUpperCase()} — ALL`, allStudents.length,
    allMaths.avgBefore, allMaths.avgAfter, allMaths.gain,
    allScience.avgBefore, allScience.avgAfter, allScience.gain,
  ];
  [3, 4, 5, 6, 7, 8].forEach(c => { allRow.getCell(c).numFmt = '0.#'; });
  for (let c = 1; c <= lastCol; c++) {
    const cell = ws.getCell(r, c);
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PURPLE_SOFT } };
  }
  r += 2;

  titleCell(ws, r, lastCol, 'Notes: Averages and % Gain are calculated only for students who have BOTH the April and June scores for that subject. "Students" is the total roll in each section. Full student-by-student marks are in the section tabs.', { subtitle: true });

  ws.columns = [
    { width: 16 }, { width: 11 }, { width: 12 }, { width: 12 }, { width: 10 },
    { width: 12 }, { width: 12 }, { width: 10 },
  ];
  ws.views = [{ state: 'frozen', ySplit: 5 }];
}

function buildMasterListSheet(
  wb: ExcelJS.Workbook,
  classLabel: string,
  sections: string[],
  bySection: Record<string, StudentRow[]>,
) {
  const ws = wb.addWorksheet('Master List');
  const lastCol = 7;
  const sectionsLabel = sections.length === 1
    ? `Section ${sections[0]}`
    : `Sections ${sections[0]}–${sections[sections.length - 1]}`;

  titleCell(ws, 1, lastCol, `${classLabel} — Master List (all sections combined)`);
  titleCell(ws, 2, lastCol, `Every student from ${sectionsLabel} in one list · April vs June · Smart Learners platform`, { subtitle: true });
  ws.addRow([]);

  ws.getRow(4).values = ['Section', 'Roll No', 'Student Name', 'Maths — Before (Apr)', 'Maths — After (Jun)', 'Science — Before (Apr)', 'Science — After (Jun)'];
  styleHeaderRow(ws, 4, lastCol);

  let r = 5;
  for (const section of sections) {
    const sectionRows = [...bySection[section]].sort(
      (a, b) => (Number(a.rollNumber) || 0) - (Number(b.rollNumber) || 0) || a.name.localeCompare(b.name)
    );
    for (const s of sectionRows) {
      const roll = s.rollNumber !== null && s.rollNumber !== '' && !Number.isNaN(Number(s.rollNumber))
        ? Number(s.rollNumber)
        : s.rollNumber;
      ws.getRow(r).values = [section, roll, s.name, s.maths.before, s.maths.after, s.science.before, s.science.after];
      r++;
    }
  }

  ws.columns = [
    { width: 10 }, { width: 9 }, { width: 26 }, { width: 20 }, { width: 20 }, { width: 22 }, { width: 22 },
  ];
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

function buildSectionSheet(wb: ExcelJS.Workbook, section: string, rows: StudentRow[]) {
  const ws = wb.addWorksheet(`Section ${section}`);
  const lastCol = 6;

  ws.getRow(1).values = ['Roll No', 'Student Name', 'Maths — Before Summer (Apr)', 'Maths — After Summer (Jun)', 'Science — Before Summer (Apr)', 'Science — After Summer (Jun)'];
  styleHeaderRow(ws, 1, lastCol);

  const sorted = [...rows].sort(
    (a, b) => (Number(a.rollNumber) || 0) - (Number(b.rollNumber) || 0) || a.name.localeCompare(b.name)
  );
  let r = 2;
  for (const s of sorted) {
    ws.getRow(r).values = [s.rollNumber ?? '', s.name, s.maths.before, s.maths.after, s.science.before, s.science.after];
    r++;
  }

  ws.columns = [
    { width: 8 }, { width: 26 }, { width: 24 }, { width: 24 }, { width: 26 }, { width: 26 },
  ];
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function downloadSummerComparisonExcel(
  teacherUsername: string,
  classFilter: string = '10',
  sectionFilter: string = 'All',
): Promise<void> {
  const { sections, bySection, allStudents } = await getSummerComparisonData(teacherUsername, classFilter, sectionFilter);

  if (sections.length === 0) {
    throw new Error('No matching Maths/Science results found for April or June with the selected filters.');
  }

  const classLabel = classFilter === 'All' ? 'All Classes' : `Class ${classFilter}`;
  const wb = new ExcelJS.Workbook();

  buildSummarySheet(wb, `${classLabel} Summary`.slice(0, 31), classLabel, sections, bySection, allStudents);
  buildMasterListSheet(wb, classLabel, sections, bySection);
  for (const section of sections) {
    buildSectionSheet(wb, section, bySection[section]);
  }

  const fileNameParts = [
    `Class${classFilter === 'All' ? 'All' : classFilter}`,
    sectionFilter === 'All' ? null : `Section${sectionFilter}`,
    'Summer_Comparison.xlsx',
  ].filter(Boolean);
  const fileName = fileNameParts.join('_');

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Run once to build a per-student Excel workbook: one tab per Class 10 section,
// listing each student's Maths/Science scores before summer (April) and after
// summer (June). Run manually whenever the underlying exam data needs refreshing.
// Usage: node scripts/buildClass10SummerExcel.js

const axios = require('axios');
const path = require('path');
const XLSX = require('xlsx');

const BASE_URL = 'https://crm.smartlearners.ai/backend-api';
const USERNAME = 'debo97062';
const OUT_FILE = path.join(__dirname, '../Class10_Summer_Comparison.xlsx');

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

function inferSubject(exam) {
  const chapterTxt = [...(exam.chapters || []), exam.description ?? '']
    .join(' ').toLowerCase().replace(/_/g, ' ');
  if (PHYSICS_KEYWORDS.some(kw => chapterTxt.includes(kw))) return 'Physics';
  if (MATHS_KEYWORDS.some(kw => chapterTxt.includes(kw))) return 'Maths';
  const title = (exam.title ?? '').toLowerCase().replace(/_/g, ' ');
  if (/physics/.test(title)) return 'Physics';
  if (/math/.test(title)) return 'Maths';
  return 'Science';
}

function periodFromDate(dateStr) {
  if (!dateStr) return null;
  const month = dateStr.slice(5, 7);
  if (month === '04') return 'before';
  if (month === '06') return 'after';
  return null;
}

async function main() {
  console.log(`Fetching mock exams for ${USERNAME}...`);
  const examsRes = await axios.post(`${BASE_URL}/api/external-data/mock-exams/by-username`, {
    username: USERNAME,
    limit: 200,
  });
  const allExams = examsRes.data.items || [];

  const relevantExams = allExams.filter(e => {
    if (e.total_submissions <= 0) return false;
    const subject = inferSubject(e);
    if (subject !== 'Maths' && subject !== 'Science') return false;
    return periodFromDate(e.date_assigned) !== null;
  });
  console.log(`Found ${allExams.length} exams total, ${relevantExams.length} relevant (Maths/Science, April or June).`);

  // studentId -> { name, rollNumber, section, maths: {before, after}, science: {before, after} }
  const students = {};

  for (let i = 0; i < relevantExams.length; i++) {
    const exam = relevantExams[i];
    const subject = inferSubject(exam);
    const period = periodFromDate(exam.date_assigned);
    const subjKey = subject === 'Maths' ? 'maths' : 'science';
    process.stdout.write(`[${i + 1}/${relevantExams.length}] Fetching results for exam ${exam.homework_id} (${exam.homework_code ?? '?'}, ${subject}, ${period})...`);
    try {
      const res = await axios.post(`${BASE_URL}/api/external-data/mock-exams/results/by-homework-id`, {
        homework_id: exam.homework_id,
        limit: 500,
      });
      const items = res.data.items || [];
      let kept = 0;
      for (const r of items) {
        if (String(r.class_name) !== '10') continue;
        const section = r.section_name;
        if (!section) continue;
        // Section O only has usable Science data — exclude it from Maths.
        if (section === 'O' && subject === 'Maths') continue;

        const key = r.student_id;
        students[key] = students[key] || {
          name: r.student_name,
          rollNumber: r.roll_number,
          section,
          maths: { before: null, after: null },
          science: { before: null, after: null },
        };
        const existing = students[key][subjKey][period];
        // If a student has two attempts in the same subject/period (rare retake), keep the higher score.
        students[key][subjKey][period] = existing === null ? r.score : Math.max(existing, r.score);
        kept++;
      }
      console.log(` ${items.length} results, ${kept} kept (class 10${subject === 'Maths' ? ', non-O' : ''}).`);
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 150));
  }

  // Group students by section
  const bySection = {};
  for (const sid in students) {
    const s = students[sid];
    bySection[s.section] = bySection[s.section] || [];
    bySection[s.section].push(s);
  }

  const sections = Object.keys(bySection).sort();
  const wb = XLSX.utils.book_new();

  for (const section of sections) {
    const rows = bySection[section]
      .sort((a, b) => (Number(a.rollNumber) || 0) - (Number(b.rollNumber) || 0) || a.name.localeCompare(b.name))
      .map(s => ({
        'Roll No': s.rollNumber ?? '',
        'Student Name': s.name,
        'Maths — Before Summer (Apr)': s.maths.before ?? '',
        'Maths — After Summer (Jun)': s.maths.after ?? '',
        'Science — Before Summer (Apr)': s.science.before ?? '',
        'Science — After Summer (Jun)': s.science.after ?? '',
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 }, { wch: 26 }, { wch: 24 }, { wch: 24 }, { wch: 26 }, { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, `Section ${section}`);
  }

  XLSX.writeFile(wb, OUT_FILE);
  console.log(`\nDone! Written to ${OUT_FILE} (${sections.length} section tabs).`);
}

main().catch(err => { console.error(err); process.exit(1); });

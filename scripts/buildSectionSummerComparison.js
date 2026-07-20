// Run once to build the static "before vs after summer" section comparison data.
// Usage: node scripts/buildSectionSummerComparison.js
//
// Class 10 (excluding section O) sat Math + Science mock exams before summer
// (April) and after summer (June). Since no further exams of this kind will
// be run, we precompute per-section averages here instead of recomputing on
// every page load.

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://crm.smartlearners.ai/backend-api';
const USERNAME = 'debo97062';
const OUT_FILE = path.join(__dirname, '../src/data/sectionSummerComparison.json');

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

  // section -> subject -> period -> { sum, n }
  const agg = {};

  for (let i = 0; i < relevantExams.length; i++) {
    const exam = relevantExams[i];
    const subject = inferSubject(exam);
    const period = periodFromDate(exam.date_assigned);
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

        agg[section] = agg[section] || {};
        agg[section][subject] = agg[section][subject] || {};
        agg[section][subject][period] = agg[section][subject][period] || { sum: 0, n: 0 };
        agg[section][subject][period].sum += r.score;
        agg[section][subject][period].n += 1;
        kept++;
      }
      console.log(` ${items.length} results, ${kept} kept (class 10${subject === 'Maths' ? ', non-O' : ''}).`);
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 150));
  }

  const sections = Object.keys(agg).sort().map(section => {
    const entry = { section };
    for (const subjectKey of [['Maths', 'maths'], ['Science', 'science']]) {
      const [subj, outKey] = subjectKey;
      const before = agg[section][subj]?.before;
      const after = agg[section][subj]?.after;
      entry[outKey] = {
        before: before ? Math.round((before.sum / before.n) * 10) / 10 : null,
        beforeN: before ? before.n : 0,
        after: after ? Math.round((after.sum / after.n) * 10) / 10 : null,
        afterN: after ? after.n : 0,
      };
    }
    return entry;
  });

  const output = {
    generated_at: new Date().toISOString(),
    sections,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nDone! Written to ${OUT_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });

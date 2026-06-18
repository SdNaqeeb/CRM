// Run once to fetch all mock exam results and save to src/data/mockExamAllResults.json
// Usage: node scripts/fetchMockExamResults.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://crm.smartlearners.ai/backend-api';
const USERNAME = 'debo97062';
const OUT_FILE = path.join(__dirname, '../src/data/mockExamAllResults.json');

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

async function main() {
  console.log(`Fetching mock exams for ${USERNAME}...`);

  const examsRes = await axios.post(`${BASE_URL}/api/external-data/mock-exams/by-username`, {
    username: USERNAME,
    limit: 200,
  });

  const allExams = examsRes.data.items || [];
  const activeExams = allExams.filter(e => e.total_submissions > 0);
  console.log(`Found ${allExams.length} exams total, ${activeExams.length} with submissions.`);

  const examsOut = activeExams.map(e => ({
    homework_id: e.homework_id,
    homework_code: e.homework_code ?? null,
    title: e.title ?? null,
    date_assigned: e.date_assigned ?? null,
    subject: inferSubject(e),
    question_count: e.question_count,
    chapters: e.chapters ?? [],
    total_submissions: e.total_submissions,
    average_score: e.average_score ?? null,
  }));

  const resultsOut = {};

  for (let i = 0; i < activeExams.length; i++) {
    const exam = activeExams[i];
    process.stdout.write(`[${i + 1}/${activeExams.length}] Fetching results for exam ${exam.homework_id} (${exam.homework_code ?? '?'})...`);
    try {
      const res = await axios.post(`${BASE_URL}/api/external-data/mock-exams/results/by-homework-id`, {
        homework_id: exam.homework_id,
        limit: 500,
      });
      const items = (res.data.items || []).map(r => ({
        student_id: r.student_id,
        student_name: r.student_name,
        username: r.username ?? null,
        class_name: r.class_name ?? null,
        section_name: r.section_name ?? null,
        score: r.score,
        total: r.total,
        score_pct: r.total > 0 ? Math.round((r.score / r.total) * 1000) / 10 : 0,
        time_spent_seconds: r.time_spent_seconds,
      }));
      resultsOut[exam.homework_id] = items;
      console.log(` ${items.length} results.`);
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
      resultsOut[exam.homework_id] = [];
    }

    // Small delay to avoid hammering the API
    await new Promise(r => setTimeout(r, 150));
  }

  const output = {
    generated_at: new Date().toISOString(),
    username: USERNAME,
    total_active_exams: activeExams.length,
    exams: examsOut,
    results: resultsOut,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nDone! Written to ${OUT_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });

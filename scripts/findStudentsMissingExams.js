// Compares the full student roster (CSV) against who actually appears in the
// Math/Science score matrix sheets of Mock_Exam_Scores.xlsx, and outputs an
// Excel listing every student who is missing the Math exam, the Science exam, or both.
// Usage: node scripts/findStudentsMissingExams.js [rosterCsv] [scoresXlsx] [outputXlsx]

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROSTER_CSV = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '../src/data/GRADE 10 - ELPRO-DEBOSHREE-MAM-565 STUDENTS CREDS.csv');
const SCORES_XLSX = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(__dirname, '../Mock_Exam_Scores.xlsx');
const OUT_FILE = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.join(__dirname, '../Students_Missing_Exams.xlsx');

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.length > 0);
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

function usernamesFromSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.warn(`Warning: sheet "${sheetName}" not found in ${SCORES_XLSX}`);
    return new Set();
  }
  const rows = XLSX.utils.sheet_to_json(sheet);
  return new Set(rows.map(r => r['Username']).filter(Boolean));
}

const classSectionKey = (className, sectionName) => {
  const classNum = parseInt(className, 10);
  return [Number.isNaN(classNum) ? Infinity : classNum, className ?? '', sectionName ?? ''];
};
const compareClassSection = (a, b) => {
  const ka = classSectionKey(a['Class'], a['Section']);
  const kb = classSectionKey(b['Class'], b['Section']);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1;
  if (ka[2] !== kb[2]) return ka[2] < kb[2] ? -1 : 1;
  return 0;
};

function main() {
  const roster = parseCsv(fs.readFileSync(ROSTER_CSV, 'utf-8'));
  const wb = XLSX.readFile(SCORES_XLSX);

  const mathWriters = usernamesFromSheet(wb, 'Math - Score Matrix');
  const scienceWriters = usernamesFromSheet(wb, 'Science - Score Matrix');

  const missingRows = [];
  for (const s of roster) {
    const wroteMath = mathWriters.has(s.username);
    const wroteScience = scienceWriters.has(s.username);
    if (wroteMath && wroteScience) continue;

    const missed = [];
    if (!wroteMath) missed.push('Math');
    if (!wroteScience) missed.push('Science');

    missingRows.push({
      'Student Name': s.Student_Name,
      'Roll Number': s.Roll_Number,
      'Class': s.Class,
      'Section': s.Section,
      'Username': s.username,
      'Missing Math': wroteMath ? '' : 'Yes',
      'Missing Science': wroteScience ? '' : 'Yes',
      'Exams Missed': missed.join(' & '),
    });
  }

  missingRows.sort((a, b) => compareClassSection(a, b) || a['Student Name'].localeCompare(b['Student Name']));

  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(missingRows), 'Missing Exams');
  XLSX.writeFile(outWb, OUT_FILE);

  console.log(`Roster: ${roster.length} students.`);
  console.log(`Wrote Math: ${mathWriters.size}, Wrote Science: ${scienceWriters.size}.`);
  console.log(`Missing one or both exams: ${missingRows.length}.`);
  console.log(`Written to ${OUT_FILE}`);
}

main();

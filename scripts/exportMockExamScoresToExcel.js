// Exports mock exam scores to an Excel workbook.
// Reads the cached data produced by fetchMockExamResults.js (src/data/mockExamAllResults.json).
// Usage: node scripts/exportMockExamScoresToExcel.js [outputPath]

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_FILE = path.join(__dirname, '../src/data/mockExamAllResults.json');
const OUT_FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '../Mock_Exam_Scores.xlsx');

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Data file not found: ${DATA_FILE}`);
    console.error('Run "node scripts/fetchMockExamResults.js" first to populate it.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const { results } = data;

  // Only exams conducted in June (any year present in date_assigned)
  const exams = data.exams.filter(e => e.date_assigned && /-06-/.test(e.date_assigned));

  const classSectionKey = (className, sectionName) => {
    const classNum = parseInt(className, 10);
    return [Number.isNaN(classNum) ? Infinity : classNum, className ?? '', sectionName ?? ''];
  };
  const compareClassSection = (a, b) => {
    const ka = classSectionKey(a.class_name ?? a['Class'], a.section_name ?? a['Section']);
    const kb = classSectionKey(b.class_name ?? b['Class'], b.section_name ?? b['Section']);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1;
    if (ka[2] !== kb[2]) return ka[2] < kb[2] ? -1 : 1;
    return 0;
  };

  // Group exams into the two subject tabs: Math, Science (Physics + generic Science)
  const SUBJECT_GROUPS = {
    Math: ['Maths'],
    Science: ['Physics', 'Science'],
  };

  function buildRows(examsForSubject) {
    const rows = [];
    for (const exam of examsForSubject) {
      const examResults = results[exam.homework_id] || [];
      for (const r of examResults) {
        rows.push({
          'Exam Code': exam.homework_code,
          'Exam Title': exam.title,
          'Subject': exam.subject,
          'Date Assigned': exam.date_assigned,
          'Student Name': r.student_name,
          'Username': r.username,
          'Class': r.class_name,
          'Section': r.section_name,
          'Score': r.score,
          'Total': r.total,
          'Score %': r.score_pct,
          'Time Spent (s)': r.time_spent_seconds,
        });
      }
    }
    rows.sort((a, b) => compareClassSection(a, b) || a['Student Name'].localeCompare(b['Student Name']));
    return rows;
  }

  function buildPivotRows(examsForSubject) {
    const studentMap = new Map(); // username -> { name, class, section, scores: { examCode: pct } }
    for (const exam of examsForSubject) {
      const examResults = results[exam.homework_id] || [];
      for (const r of examResults) {
        const key = r.username || r.student_name;
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            'Student Name': r.student_name,
            'Username': r.username,
            'Class': r.class_name,
            'Section': r.section_name,
          });
        }
        studentMap.get(key)[exam.homework_code || `Exam ${exam.homework_id}`] = r.score_pct;
      }
    }
    const rows = Array.from(studentMap.values());
    rows.sort((a, b) => compareClassSection(a, b) || a['Student Name'].localeCompare(b['Student Name']));
    return rows;
  }

  const wb = XLSX.utils.book_new();
  for (const [tabName, subjects] of Object.entries(SUBJECT_GROUPS)) {
    const examsForSubject = exams.filter(e => subjects.includes(e.subject));
    const allRows = buildRows(examsForSubject);
    const pivotRows = buildPivotRows(examsForSubject);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRows), `${tabName} - All Results`);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pivotRows), `${tabName} - Score Matrix`);
    console.log(`${tabName}: ${allRows.length} result rows, ${pivotRows.length} students.`);
  }

  XLSX.writeFile(wb, OUT_FILE);
  console.log(`Written to ${OUT_FILE}`);
}

main();

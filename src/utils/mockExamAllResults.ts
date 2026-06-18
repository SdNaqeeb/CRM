export interface AllResultsData {
  generated_at: string;
  username: string;
  total_active_exams: number;
  exams: {
    homework_id: number;
    homework_code: string | null;
    title: string | null;
    date_assigned: string | null;
    subject: string;
    question_count: number;
    chapters: string[];
    total_submissions: number;
    average_score: number | null;
  }[];
  results: Record<string, {
    student_id: number;
    student_name: string;
    username: string | null;
    class_name: string | null;
    section_name: string | null;
    score: number;
    total: number;
    score_pct: number;
    time_spent_seconds: number;
  }[]>;
}

export interface StudentTrend {
  student_id: number;
  student_name: string;
  section: string;
  class_name: string;
  exams_attempted: number;
  engagement_pct: number;
  first_avg: number;
  last_avg: number;
  improvement: number;
  overall_avg: number;
}

export function computeStudentTrends(data: AllResultsData): StudentTrend[] {
  // Sort exams chronologically
  const sortedExams = [...data.exams].sort((a, b) =>
    (a.date_assigned ?? '').localeCompare(b.date_assigned ?? '')
  );

  // Build per-student list of (examIndex, score_pct) sorted by date
  const studentMap = new Map<number, {
    name: string; section: string; class_name: string;
    attempts: { examIndex: number; score_pct: number }[];
  }>();

  sortedExams.forEach((exam, examIndex) => {
    const items = data.results[exam.homework_id] ?? [];
    for (const r of items) {
      if (!studentMap.has(r.student_id)) {
        studentMap.set(r.student_id, {
          name: r.student_name,
          section: r.section_name ?? 'Unknown',
          class_name: r.class_name ?? 'Unknown',
          attempts: [],
        });
      }
      studentMap.get(r.student_id)!.attempts.push({ examIndex, score_pct: r.score_pct });
    }
  });

  const trends: StudentTrend[] = [];

  for (const [student_id, info] of studentMap) {
    if (info.attempts.length < 2) continue;

    const sorted = info.attempts.sort((a, b) => a.examIndex - b.examIndex);
    const n = sorted.length;
    const thirdSize = Math.max(1, Math.floor(n / 3));

    const firstThird = sorted.slice(0, thirdSize).map(a => a.score_pct);
    const lastThird  = sorted.slice(n - thirdSize).map(a => a.score_pct);

    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

    const first_avg   = avg(firstThird);
    const last_avg    = avg(lastThird);
    const overall_avg = avg(sorted.map(a => a.score_pct));

    trends.push({
      student_id,
      student_name: info.name,
      section: info.section,
      class_name: info.class_name,
      exams_attempted: n,
      engagement_pct: Math.round((n / data.total_active_exams) * 100),
      first_avg: Math.round(first_avg * 10) / 10,
      last_avg: Math.round(last_avg * 10) / 10,
      improvement: Math.round((last_avg - first_avg) * 10) / 10,
      overall_avg: Math.round(overall_avg * 10) / 10,
    });
  }

  return trends;
}

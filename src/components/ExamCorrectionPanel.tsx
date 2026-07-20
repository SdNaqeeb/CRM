import React, { useMemo } from 'react';
import { TeacherExamsResponse } from '../services/api';
import DashboardIcon from './DashboardIcon';

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

const C = {
  card: '#FFFFFF',
  cardAlt: '#F8FAFC',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  purple: '#7C3AED',
  purpleSoft: 'rgba(124,58,237,0.10)',
  green: '#10B981',
  greenSoft: 'rgba(16,185,129,0.12)',
  amber: '#F59E0B',
  amberSoft: 'rgba(245,158,11,0.12)',
  red: '#F43F5E',
  redSoft: 'rgba(244,63,94,0.12)',
  blue: '#3B82F6',
  blueSoft: 'rgba(59,130,246,0.10)',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)',
};

interface ExamCorrectionPanelProps {
  data: TeacherExamsResponse | null;
  loading: boolean;
}

const scoreColor = (score?: number | null) => {
  if (score == null) return C.textMuted;
  if (score >= 75) return C.green;
  if (score >= 50) return C.amber;
  return C.red;
};

const formatPercent = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return '-';
  return `${Number(value).toFixed(1)}%`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ExamCorrectionPanel: React.FC<ExamCorrectionPanelProps> = ({ data, loading }) => {
  const exams = useMemo(() => {
    return [...(data?.items ?? [])].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }, [data]);

  const metrics = useMemo(() => {
    let totalStudents = 0;
    let processedStudents = 0;
    let weightedScore = 0;
    let weightedCount = 0;
    let topScore: number | null = null;
    let totalQuestionPapers = 0;
    let totalAnswerSheets = 0;
    let activeExams = 0;

    for (const exam of exams) {
      const students = Number(exam.total_students ?? 0);
      const avgScore = exam.average_score == null ? null : Number(exam.average_score);
      const processed = Number(exam.processing_summary?.processed_students ?? 0);
      const examTopScore = exam.class_analytics?.top_score;

      totalStudents += students;
      processedStudents += processed;
      totalQuestionPapers += exam.question_paper_snapshot?.length ?? 0;
      totalAnswerSheets += exam.answer_sheets_snapshot?.length ?? 0;
      if (exam.active) activeExams += 1;

      if (avgScore != null && students > 0) {
        weightedScore += avgScore * students;
        weightedCount += students;
      }

      if (examTopScore != null) {
        topScore = topScore == null ? examTopScore : Math.max(topScore, examTopScore);
      }
    }

    return {
      totalStudents,
      processedStudents,
      weightedAverage: weightedCount > 0 ? weightedScore / weightedCount : null,
      topScore,
      totalQuestionPapers,
      totalAnswerSheets,
      activeExams,
    };
  }, [exams]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '56px 0', fontFamily: FONT }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.purple, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
          ))}
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: C.textMuted }}>Loading exam correction data...</p>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '48px 24px', textAlign: 'center', boxShadow: C.shadow, fontFamily: FONT }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.purpleSoft }}>
          <DashboardIcon name="file" size={24} color={C.purple} />
        </div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: C.text, marginBottom: '6px' }}>No corrected exams found</div>
        <div style={{ fontSize: '14px', color: C.textMuted, lineHeight: 1.6 }}>
          Once this teacher uploads and processes exams, they will appear here automatically.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '18px', fontFamily: FONT }}>
      <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px 24px', boxShadow: C.shadow }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '999px', background: C.purpleSoft, color: C.purple, fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
              <DashboardIcon name="target" size={14} color={C.purple} />
              Exam correction workspace
            </div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
              {data?.teacher_name || data?.teacher_username || 'Teacher'} exam overview
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: C.textSecondary, lineHeight: 1.6 }}>
              Review all corrected exams uploaded by this teacher with score, processing, and file metrics in one place.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '6px', minWidth: '220px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Teacher</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{data?.teacher_name || '-'}</div>
            <div style={{ fontSize: '13px', color: C.textSecondary }}>@{data?.teacher_username || '-'}</div>
            <div style={{ fontSize: '13px', color: C.textSecondary }}>{data?.school_name || '-'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        {[
          { label: 'Total Exams', value: data?.total_exams ?? exams.length, tone: C.purple, bg: C.purpleSoft },
          { label: 'Total Students', value: metrics.totalStudents, tone: C.blue, bg: C.blueSoft },
          { label: 'Weighted Avg Score', value: formatPercent(metrics.weightedAverage), tone: scoreColor(metrics.weightedAverage), bg: C.cardAlt },
          { label: 'Processed Students', value: metrics.processedStudents, tone: C.green, bg: C.greenSoft },
          { label: 'Best Top Score', value: metrics.topScore == null ? '-' : `${metrics.topScore}`, tone: C.amber, bg: C.amberSoft },
          { label: 'Question Papers', value: metrics.totalQuestionPapers, tone: C.text, bg: C.cardAlt },
          { label: 'Answer Sheet Files', value: metrics.totalAnswerSheets, tone: C.text, bg: C.cardAlt },
          { label: 'Active Exams', value: metrics.activeExams, tone: C.green, bg: C.greenSoft },
        ].map((item) => (
          <div key={item.label} style={{ background: C.card, borderRadius: '16px', border: `1px solid ${C.border}`, padding: '16px 18px', boxShadow: C.shadow }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>{item.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: item.tone }}>{item.value}</div>
            <div style={{ width: '44px', height: '6px', borderRadius: '999px', background: item.bg, marginTop: '12px' }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {exams.map((exam) => {
          const name = exam.name || exam.exam_name || `Exam #${exam.exam_id}`;
          const processedStudents = Number(exam.processing_summary?.processed_students ?? 0);
          const topScore = exam.class_analytics?.top_score;
          const lowestScore = exam.class_analytics?.lowest_score;
          const avgScore = exam.average_score == null ? null : Number(exam.average_score);

          return (
            <div key={exam.exam_id} style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: 'hidden' }}>
              <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: C.text, lineHeight: 1.3 }}>{name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '999px', background: C.purpleSoft, color: C.purple, fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>
                        {exam.exam_type || 'exam'}
                      </span>
                      <span style={{ padding: '4px 10px', borderRadius: '999px', background: exam.active ? C.greenSoft : C.redSoft, color: exam.active ? C.green : C.red, fontSize: '11px', fontWeight: 700 }}>
                        {exam.active ? 'Active' : 'Inactive'}
                      </span>
                      {exam.admission_exam && (
                        <span style={{ padding: '4px 10px', borderRadius: '999px', background: C.amberSoft, color: C.amber, fontSize: '11px', fontWeight: 700 }}>
                          Admission
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Created</div>
                    <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 700, color: C.textSecondary }}>{formatDate(exam.created_at)}</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '18px', display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                  {[
                    { label: 'Total Students', value: exam.total_students, tone: C.text },
                    { label: 'Average Score', value: formatPercent(avgScore), tone: scoreColor(avgScore) },
                    { label: 'Top Score', value: topScore == null ? '-' : `${topScore}`, tone: C.green },
                    { label: 'Lowest Score', value: lowestScore == null ? '-' : `${lowestScore}`, tone: C.red },
                  ].map((item) => (
                    <div key={item.label} style={{ background: C.cardAlt, borderRadius: '14px', padding: '14px 12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{item.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: item.tone }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                  <div style={{ padding: '14px 12px', borderRadius: '14px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Processed Students</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: C.text }}>{processedStudents}</div>
                  </div>
                  <div style={{ padding: '14px 12px', borderRadius: '14px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Files</div>
                    <div style={{ fontSize: '13px', color: C.textSecondary, lineHeight: 1.6 }}>
                      QP: {exam.question_paper_snapshot?.length ?? 0} | Sheets: {exam.answer_sheets_snapshot?.length ?? 0}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '8px', paddingTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
                    <span style={{ color: C.textMuted }}>Exam ID</span>
                    <span style={{ color: C.text, fontWeight: 700 }}>#{exam.exam_id}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
                    <span style={{ color: C.textMuted }}>Processed At</span>
                    <span style={{ color: C.textSecondary, fontWeight: 600 }}>{formatDateTime(exam.processed_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExamCorrectionPanel;

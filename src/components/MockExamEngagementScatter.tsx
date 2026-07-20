import React, { useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import allResultsData from '../data/mockExamAllResults.json';
import { computeStudentTrends, AllResultsData } from '../utils/mockExamAllResults';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

const SECTION_COLORS: Record<string, string> = {
  A: '#3B82F6', B: '#10B981', C: '#F59E0B', D: '#F43F5E',
  E: '#8B5CF6', F: '#06B6D4', G: '#EC4899',
};

function sectionColor(section: string) {
  const key = (section ?? '').toUpperCase().replace(/^SECTION\s*/i, '').trim();
  return SECTION_COLORS[key] ?? '#94A3B8';
}

const data = allResultsData as AllResultsData;
const studentTrends = computeStudentTrends(data);
const uniqueSections = [...new Set(studentTrends.map(t => t.section))].sort();

const MockExamEngagementScatter: React.FC = () => {
  const [hoverSection, setHoverSection] = useState<string | null>(null);

  const yValues = studentTrends.map(t => t.improvement);
  const yMin = Math.floor(Math.min(...yValues) / 10) * 10 - 5;
  const yMax = Math.ceil(Math.max(...yValues) / 10) * 10 + 5;

  const bySection = uniqueSections.map(sec => ({
    section: sec,
    color: sectionColor(sec),
    points: studentTrends
      .filter(t => t.section === sec)
      .map(t => ({ x: t.engagement_pct, y: t.improvement, ...t })),
  }));

  return (
    <div style={{
      background: '#111827', border: '1px solid #1E293B', borderRadius: 16,
      overflow: 'hidden', marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05))', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 3, height: 18, borderRadius: 2, background: '#8B5CF6' }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#F1F5F9', fontFamily: FONT_SERIF }}>Mock Exam — Student Engagement vs Improvement</span>
        <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(139,92,246,0.15)', fontSize: 11, fontWeight: 700, color: '#8B5CF6' }}>
          {studentTrends.length} students · {data.total_active_exams} exams
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
          snapshot: {new Date(data.generated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Quadrant legend */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxWidth: 520, marginBottom: 16 }}>
          {[
            { label: 'Active & Improving',  desc: 'High usage, score going up',    color: '#10B981' },
            { label: 'Active & Declining',  desc: 'High usage, score going down',  color: '#F59E0B' },
            { label: 'Passive & Improving', desc: 'Low usage, still improving',    color: '#3B82F6' },
            { label: 'Passive & Declining', desc: 'Low usage, score falling',      color: '#F43F5E' },
          ].map(q => (
            <div key={q.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: q.color, marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#E2E8F0' }}>{q.label}</div>
                <div style={{ fontSize: 10, color: '#64748B' }}>{q.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Section colour legend */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          {uniqueSections.map(sec => (
            <div
              key={sec}
              style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', opacity: hoverSection && hoverSection !== sec ? 0.35 : 1, transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHoverSection(sec)}
              onMouseLeave={() => setHoverSection(null)}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: sectionColor(sec) }} />
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Section {sec}</span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 16, right: 32, bottom: 48, left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />

            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 100]}
              name="Engagement"
              tick={{ fontSize: 11, fontFamily: FONT, fill: '#64748B' }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(v: number) => `${v}%`}
              label={{ value: 'Exams attempted (%)', position: 'insideBottom', offset: -28, style: { fontSize: 11, fill: '#64748B', fontFamily: FONT } }}
            />

            <YAxis
              type="number"
              dataKey="y"
              domain={[yMin, yMax]}
              name="Improvement"
              tick={{ fontSize: 11, fontFamily: FONT, fill: '#64748B' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
              width={52}
              label={{ value: 'Score trend (last - first third)', angle: -90, position: 'insideLeft', offset: 16, style: { fontSize: 11, fill: '#64748B', fontFamily: FONT } }}
            />

            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#334155' }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontFamily: FONT, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <div style={{ fontWeight: 700, color: '#F1F5F9', marginBottom: 6 }}>{d.student_name}</div>
                    <div style={{ color: '#94A3B8' }}>Section <span style={{ color: sectionColor(d.section), fontWeight: 700 }}>{d.section}</span></div>
                    <div style={{ color: '#94A3B8' }}>Attempted: <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{d.exams_attempted}/{data.total_active_exams} ({d.engagement_pct}%)</span></div>
                    <div style={{ color: '#94A3B8' }}>Overall avg: <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{d.overall_avg}%</span></div>
                    <div style={{ color: '#94A3B8' }}>Trend: <span style={{ color: d.improvement >= 0 ? '#10B981' : '#F43F5E', fontWeight: 700 }}>{d.improvement >= 0 ? '+' : ''}{d.improvement}%</span></div>
                  </div>
                );
              }}
            />

            <ReferenceLine x={50} stroke="#334155" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: '50% usage', position: 'top', style: { fontSize: 10, fill: '#475569', fontFamily: FONT } }}
            />
            <ReferenceLine y={0} stroke="#334155" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: 'No change', position: 'right', style: { fontSize: 10, fill: '#475569', fontFamily: FONT } }}
            />

            {bySection.map(({ section, color, points }) => (
              <Scatter
                key={section}
                name={`Section ${section}`}
                data={points}
                fill={color}
                fillOpacity={hoverSection && hoverSection !== section ? 0.1 : 0.8}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>

        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#475569', textAlign: 'center' }}>
          Each dot = one student · X = % of {data.total_active_exams} exams attempted · Y = avg score (last third) minus avg score (first third)
        </p>
      </div>
    </div>
  );
};

export default MockExamEngagementScatter;

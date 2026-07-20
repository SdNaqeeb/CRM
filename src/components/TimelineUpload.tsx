import React, { useState, useRef } from 'react';

const FONT = "'Plus Jakarta Sans', sans-serif";
const FONT_SERIF = "'Source Serif 4', Georgia, serif";

interface UploadedPlan {
  teacher: string;
  week: string;
  date_range: string;
  subject: string;
  topic: string;
  subtopics: string;
  learning_objectives: string;
  resources: string;
}

// Parse a plain CSV (no library dependency)
function parseCSV(text: string): UploadedPlan[] {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: any = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row as UploadedPlan;
  });
}

interface TimelineUploadProps {
  schoolCode?: string;
}

const TimelineUpload: React.FC<TimelineUploadProps> = ({ schoolCode }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<UploadedPlan[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleFile = (file: File) => {
    setParseError('');
    setParsedRows(null);
    setSubmitted(false);
    setUploadedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { setParseError('Could not read file.'); return; }
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setParseError('No data rows found. Make sure the file has a header row and at least one data row.');
        return;
      }
      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleSubmit = () => {
    // In production this would POST to /api/timeline/upload
    // For now simulate a successful upload
    setSubmitted(true);
  };

  const handleReset = () => {
    setUploadedFile(null);
    setParsedRows(null);
    setParseError('');
    setSubmitted(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const teachers = parsedRows ? [...new Set(parsedRows.map((r) => r.teacher).filter(Boolean))] : [];

  return (
    <div>
      {/* Info header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2027 0%, #111827 100%)',
        border: '1px solid #1E293B', borderRadius: '16px',
        padding: '20px 24px', marginBottom: '24px',
        display: 'flex', alignItems: 'flex-start', gap: '14px',
      }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" fill="none" stroke="#8B5CF6" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" />
            <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" />
            <polyline points="10 9 9 9 8 9" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#F1F5F9', fontFamily: FONT_SERIF, marginBottom: '4px' }}>
            Upload Weekly Teaching Plan
          </div>
          <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
            Upload a <strong style={{ color: '#A78BFA' }}>.csv</strong> file containing the weekly plan for each teacher.
            Each teacher will automatically see their own timeline in their dashboard.
          </div>
          <div style={{ marginTop: '10px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', fontSize: '12px', color: '#A78BFA', fontFamily: 'monospace' }}>
            Expected columns: teacher, week, date_range, subject, topic, subtopics, learning_objectives, resources
          </div>
        </div>
      </div>

      {/* Download sample */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(
            'teacher,week,date_range,subject,topic,subtopics,learning_objectives,resources\n' +
            'samiya@elp,Week 1,5 May – 9 May 2025,Mathematics,Number Systems,"Natural numbers, Integers, Rational numbers",Students should classify numbers,NCERT Ch. 1\n' +
            'samiya@elp,Week 2,12 May – 16 May 2025,Mathematics,Polynomials,"Degree, Zeroes, Remainder theorem",Apply the factor theorem,NCERT Ch. 2\n'
          )}`}
          download="sample_timeline.csv"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '8px',
            border: '1px solid #334155', background: 'transparent',
            color: '#64748B', fontSize: '12px', fontWeight: 600,
            textDecoration: 'none', fontFamily: FONT,
          }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
          </svg>
          Download sample CSV
        </a>
      </div>

      {submitted ? (
        /* Success state */
        <div style={{
          padding: '40px', textAlign: 'center', background: '#111827',
          borderRadius: '16px', border: '1px solid rgba(16,185,129,0.25)',
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <svg width="28" height="28" fill="none" stroke="#10B981" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#F1F5F9', marginBottom: '8px', fontFamily: FONT_SERIF }}>Plan Uploaded Successfully</div>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '4px' }}>
            {parsedRows?.length} weeks uploaded for {teachers.length} teacher{teachers.length !== 1 ? 's' : ''}:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '10px', marginBottom: '20px' }}>
            {teachers.map((t) => (
              <span key={t} style={{ padding: '3px 12px', borderRadius: '99px', background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)', fontSize: '12px', fontWeight: 600 }}>{t}</span>
            ))}
          </div>
          <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '12px', color: '#F59E0B', marginBottom: '20px' }}>
            Mock mode — data will be saved to backend once the upload endpoint is ready.
          </div>
          <button onClick={handleReset} style={{ padding: '9px 20px', borderRadius: '10px', border: '1px solid #334155', background: 'transparent', color: '#94A3B8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
            Upload Another File
          </button>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#8B5CF6' : uploadedFile ? '#334155' : '#1E293B'}`,
              borderRadius: '16px', padding: '40px 24px', textAlign: 'center',
              background: dragOver ? 'rgba(139,92,246,0.05)' : '#111827',
              cursor: 'pointer', transition: 'all 0.2s', marginBottom: '16px',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleInputChange}
            />
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(139,92,246,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <svg width="22" height="22" fill="none" stroke="#8B5CF6" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
              </svg>
            </div>
            {uploadedFile ? (
              <>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>{uploadedFile.name}</div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>{(uploadedFile.size / 1024).toFixed(1)} KB · Click to replace</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>
                  Drop your CSV file here
                </div>
                <div style={{ fontSize: '12px', color: '#475569' }}>or click to browse — .csv files only</div>
              </>
            )}
          </div>

          {parseError && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#F43F5E', fontSize: '13px', marginBottom: '16px' }}>
              {parseError}
            </div>
          )}

          {/* Preview table */}
          {parsedRows && parsedRows.length > 0 && (
            <div style={{ background: '#111827', borderRadius: '14px', border: '1px solid #1E293B', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#F1F5F9' }}>Preview</span>
                  <span style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(20,184,166,0.12)', color: '#14B8A6', fontSize: '12px', fontWeight: 700 }}>{parsedRows.length} rows</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {teachers.map((t) => (
                    <span key={t} style={{ padding: '2px 10px', borderRadius: '99px', background: 'rgba(167,139,250,0.12)', color: '#A78BFA', fontSize: '11px', fontWeight: 600, border: '1px solid rgba(167,139,250,0.2)' }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: FONT }}>
                  <thead>
                    <tr style={{ background: '#0B1120' }}>
                      {['Teacher', 'Week', 'Date Range', 'Subject', 'Topic', 'Subtopics'].map((h) => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1px solid #1E293B' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 8).map((row, i) => (
                      <tr key={i} style={{ borderBottom: i < parsedRows.length - 1 ? '1px solid #1E293B' : 'none' }}>
                        <td style={{ padding: '10px 14px', color: '#A78BFA', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.teacher}</td>
                        <td style={{ padding: '10px 14px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{row.week}</td>
                        <td style={{ padding: '10px 14px', color: '#64748B', whiteSpace: 'nowrap', fontSize: '11px' }}>{row.date_range}</td>
                        <td style={{ padding: '10px 14px', color: '#94A3B8' }}>{row.subject}</td>
                        <td style={{ padding: '10px 14px', color: '#F1F5F9', fontWeight: 600 }}>{row.topic}</td>
                        <td style={{ padding: '10px 14px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.subtopics}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 8 && (
                <div style={{ padding: '10px 14px', borderTop: '1px solid #1E293B', fontSize: '12px', color: '#475569', textAlign: 'center' }}>
                  +{parsedRows.length - 8} more rows not shown
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          {parsedRows && parsedRows.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={handleReset} style={{ padding: '9px 20px', borderRadius: '10px', border: '1px solid #334155', background: 'transparent', color: '#94A3B8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                Clear
              </button>
              <button
                onClick={handleSubmit}
                style={{
                  padding: '9px 24px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed, #8B5CF6)',
                  color: '#fff', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: FONT,
                  boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                </svg>
                Upload Plan ({parsedRows.length} weeks)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TimelineUpload;

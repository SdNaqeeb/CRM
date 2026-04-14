import React, { useMemo } from 'react';
import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  Cell,
} from 'recharts';

const FONT_BODY = "'Plus Jakarta Sans', sans-serif";
const FONT_NUMBERS = "'Source Serif 4', Georgia, serif";

const COLORS = {
  teal: '#0d9488',
  blue: '#3b82f6',
  purple: '#8B5CF6',
  green: '#10B981',
  amber: '#d97706',
  rose: '#e11d48',
};

const DEFAULT_BAR_COLORS = [
  COLORS.teal, COLORS.blue, COLORS.purple, COLORS.green, COLORS.amber, COLORS.rose,
];

const THEME = {
  cardBg: '#111827',
  cardBorder: '#1E293B',
  cardBorderHover: '#334155',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  gridLine: '#1E293B',
  tooltipBg: '#1E293B',
  tooltipBorder: '#334155',
  tooltipText: '#F1F5F9',
};

/* ────────────────────────────────────────────
   Shared card wrapper
   ──────────────────────────────────────────── */

const ChartCard: React.FC<{
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ title, children, style }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: THEME.cardBg,
        borderRadius: 14,
        border: `1px solid ${hovered ? THEME.cardBorderHover : THEME.cardBorder}`,
        padding: '16px 18px',
        fontFamily: FONT_BODY,
        width: '100%',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s ease',
        ...style,
      }}
    >
      <h3
        style={{
          margin: '0 0 16px',
          fontSize: 15,
          fontWeight: 700,
          color: THEME.textPrimary,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
};

/* ────────────────────────────────────────────
   Custom dark tooltip
   ──────────────────────────────────────────── */

const DarkTooltip: React.FC<{
  active?: boolean;
  payload?: readonly any[];
  label?: string | number;
  formatter?: any;
}> = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: THEME.tooltipBg,
        border: `1px solid ${THEME.tooltipBorder}`,
        borderRadius: 8,
        padding: '10px 14px',
        fontFamily: FONT_BODY,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <p style={{ margin: '0 0 6px', fontSize: 12, color: THEME.textSecondary, fontWeight: 500 }}>
        {label}
      </p>
      {payload.map((entry: any, i: number) => {
        const entryName = entry.dataKey ?? entry.name ?? entry.payload?.name ?? '';
        const [displayValue, displayName] = formatter
          ? formatter(entry.value, entryName)
          : [entry.value, entryName];
        return (
          <p
            key={i}
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: entry.color || THEME.tooltipText,
              fontFamily: FONT_NUMBERS,
              lineHeight: 1.6,
            }}
          >
            {displayName}: {displayValue}
          </p>
        );
      })}
    </div>
  );
};

/* ────────────────────────────────────────────
   1. BarChart
   ──────────────────────────────────────────── */

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  title: string;
  height?: number;
  showValues?: boolean;
  valueLabel?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  height = 240,
  showValues = true,
  valueLabel = 'Count',
}) => {
  const gradientId = React.useId?.() ?? `bar-grad-${title.replace(/\s/g, '')}`;

  if (!data.length)
    return (
      <ChartCard title={title}>
        <p style={{ color: THEME.textSecondary, fontSize: 13 }}>No data</p>
      </ChartCard>
    );

  const chartData = data.map((d, i) => ({
    ...d,
    name: d.label,
    fill: d.color || DEFAULT_BAR_COLORS[i % DEFAULT_BAR_COLORS.length],
  }));

  // For single data point, limit bar width to prevent overly wide bars
  const maxBarSize = data.length === 1 ? 80 : undefined;

  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <RBarChart data={chartData} margin={{ top: 20, right: 16, bottom: 8, left: 8 }}>
          <defs>
            {chartData.map((d, i) => (
              <linearGradient key={i} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={d.fill} stopOpacity={1} />
                <stop offset="100%" stopColor={d.fill} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={THEME.gridLine}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={false}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: THEME.textSecondary, fontSize: 11, fontFamily: FONT_NUMBERS }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={(props) => (
              <DarkTooltip
                {...props}
                formatter={(v: any, name: any) => [String(v), name === 'value' ? valueLabel : name]}
              />
            )}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
          />
          <Bar
            dataKey="value"
            radius={[6, 6, 0, 0]}
            label={
              showValues
                ? {
                    position: 'top' as const,
                    fill: THEME.textSecondary,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: FONT_NUMBERS,
                  }
                : false
            }
            animationDuration={800}
            animationEasing="ease-out"
            maxBarSize={maxBarSize}
          >
            {chartData.map((d, i) => (
              <Cell key={i} fill={`url(#${gradientId}-${i})`} />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

/* ────────────────────────────────────────────
   2. GroupedBarChart
   ──────────────────────────────────────────── */

interface GroupedBarChartProps {
  data: { label: string; value1: number; value2: number }[];
  title: string;
  legend1: string;
  legend2: string;
  color1?: string;
  color2?: string;
  height?: number;
  minBarSlotWidth?: number;
}

export const GroupedBarChart: React.FC<GroupedBarChartProps> = ({
  data,
  title,
  legend1,
  legend2,
  color1 = COLORS.teal,
  color2 = COLORS.blue,
  height = 240,
  minBarSlotWidth,
}) => {
  if (!data.length)
    return (
      <ChartCard title={title}>
        <p style={{ color: THEME.textSecondary, fontSize: 13 }}>No data</p>
      </ChartCard>
    );

  const chartData = data.map((d) => ({
    name: d.label,
    [legend1]: d.value1,
    [legend2]: d.value2,
  }));

  // For single data point, limit bar width to prevent overly wide bars
  const maxBarSize = data.length === 1 ? 80 : undefined;

  const containerWidth = minBarSlotWidth
    ? Math.max(minBarSlotWidth * data.length + 80, 400)
    : undefined;

  const renderLegend = () => (
    <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 4 }}>
      {[
        { label: legend1, color: color1 },
        { label: legend2, color: color2 },
      ].map((l) => (
        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
          <span style={{ fontSize: 12, color: THEME.textSecondary, fontWeight: 500, fontFamily: FONT_BODY }}>
            {l.label}
          </span>
        </div>
      ))}
    </div>
  );

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={THEME.gridLine}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={false}
          axisLine={false}
          tickLine={false}
          height={0}
        />
        <YAxis
          tick={{ fill: THEME.textSecondary, fontSize: 11, fontFamily: FONT_NUMBERS }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={(props) => <DarkTooltip {...props} />}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
        />
        <Bar
          dataKey={legend1}
          fill={color1}
          radius={[4, 4, 0, 0]}
          animationDuration={800}
          animationEasing="ease-out"
          maxBarSize={maxBarSize}
        />
        <Bar
          dataKey={legend2}
          fill={color2}
          radius={[4, 4, 0, 0]}
          animationDuration={800}
          animationEasing="ease-out"
          maxBarSize={maxBarSize}
        />
      </RBarChart>
    </ResponsiveContainer>
  );

  return (
    <ChartCard title={title}>
      {renderLegend()}
      {containerWidth ? (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div style={{ minWidth: containerWidth }}>{chart}</div>
        </div>
      ) : (
        chart
      )}
    </ChartCard>
  );
};

/* ────────────────────────────────────────────
   2.5. StackedBarChart
   ──────────────────────────────────────────── */

interface StackedBarChartProps {
  data: ({ label: string } & Record<string, number | string>)[];
  title: string;
  segments: { key: string; label: string; color: string }[];
  height?: number;
  xDataKey?: string;
  xTickFormatter?: (value: string | number) => string;
  tooltipLabelFormatter?: (value: string | number) => string;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({
  data,
  title,
  segments,
  height = 260,
  xDataKey = 'label',
  xTickFormatter,
  tooltipLabelFormatter,
}) => {
  if (!data.length) {
    return (
      <ChartCard title={title}>
        <p style={{ color: THEME.textSecondary, fontSize: 13 }}>No data</p>
      </ChartCard>
    );
  }

  // For single data point, limit bar width to prevent overly wide bars
  const maxBarSize = data.length === 1 ? 80 : undefined;

  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <RBarChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.gridLine} vertical={false} />
          <XAxis
            dataKey={xDataKey}
            tick={false}
            axisLine={false}
            tickLine={false}
            height={0}
          />
          <YAxis
            tick={{ fill: THEME.textSecondary, fontSize: 11, fontFamily: FONT_NUMBERS }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={(props) => (
              <DarkTooltip
                {...props}
                label={
                  tooltipLabelFormatter && props.label !== undefined
                    ? tooltipLabelFormatter(props.label)
                    : props.label
                }
              />
            )}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
          />
          {segments.map((segment) => (
            <Bar
              key={segment.key}
              dataKey={segment.key}
              stackId="stack"
              fill={segment.color}
              radius={[4, 4, 0, 0]}
              animationDuration={800}
              animationEasing="ease-out"
              maxBarSize={maxBarSize}
            />
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

/* ────────────────────────────────────────────
   3. LineChart (uses AreaChart from recharts)
   ──────────────────────────────────────────── */

interface LineChartProps {
  data: ({ label: string; value: number } & Record<string, string | number>)[];
  title: string;
  color?: string;
  height?: number;
  xDataKey?: string;
  showXAxisTicks?: boolean;
  xTickFormatter?: (value: string | number) => string;
  tooltipLabelFormatter?: (value: string | number) => string;
  tooltipValueFormatter?: (value: string | number, name: string | number) => [string, string];
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  color = COLORS.teal,
  height = 240,
  xDataKey = 'name',
  showXAxisTicks = false,
  xTickFormatter,
  tooltipLabelFormatter,
  tooltipValueFormatter,
}) => {
  const gradientId = React.useId?.() ?? `area-grad-${title.replace(/\s/g, '')}`;

  if (!data.length)
    return (
      <ChartCard title={title}>
        <p style={{ color: THEME.textSecondary, fontSize: 13 }}>No data</p>
      </ChartCard>
    );

  const chartData = data.map((d) => ({ ...d, name: d.label, value: d.value }));

  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={THEME.gridLine}
            vertical={false}
          />
          <XAxis
            dataKey={xDataKey}
            tick={
              showXAxisTicks
                ? { fill: THEME.textSecondary, fontSize: 12, fontFamily: FONT_BODY }
                : false
            }
            axisLine={showXAxisTicks ? { stroke: THEME.gridLine } : false}
            tickLine={false}
            tickFormatter={xTickFormatter}
            angle={showXAxisTicks && data.length > 6 ? -30 : 0}
            textAnchor={showXAxisTicks && data.length > 6 ? 'end' : 'middle'}
            height={showXAxisTicks ? (data.length > 6 ? 60 : 30) : 0}
          />
          <YAxis
            tick={{ fill: THEME.textSecondary, fontSize: 11, fontFamily: FONT_NUMBERS }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={(props) => (
              <DarkTooltip
                {...props}
                label={
                  tooltipLabelFormatter && props.label !== undefined
                    ? tooltipLabelFormatter(props.label)
                    : props.label
                }
                formatter={(v: any, name: any) =>
                  tooltipValueFormatter
                    ? tooltipValueFormatter(v, name)
                    : [String(v), name === 'value' ? 'Score ' : String(name)]
                }
              />
            )}
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 3', opacity: 0.4 }}
            wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{
              r: 4,
              fill: THEME.cardBg,
              stroke: color,
              strokeWidth: 2.5,
            }}
            activeDot={{
              r: 6,
              fill: THEME.cardBg,
              stroke: color,
              strokeWidth: 2.5,
              style: { filter: `drop-shadow(0 0 6px ${color}66)` },
            }}
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

/* ────────────────────────────────────────────
   4. DAUWAUMAUCards
   ──────────────────────────────────────────── */

interface DAUWAUMAUCardsProps {
  students: { last_login?: string; is_currently_active: boolean }[];
  totalStudents: number;
}

const CircularProgress: React.FC<{
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}> = ({ percentage, color, size = 72, strokeWidth = 6 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={THEME.gridLine}
        strokeWidth={strokeWidth}
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)',
        }}
      />
    </svg>
  );
};

export const DAUWAUMAUCards: React.FC<DAUWAUMAUCardsProps> = ({ students, totalStudents }) => {
  const now = Date.now();
  const MS_24H = 24 * 60 * 60 * 1000;
  const MS_7D = 7 * MS_24H;
  const MS_30D = 30 * MS_24H;

  const { dau, wau, mau } = useMemo(() => {
    let dau = 0;
    let wau = 0;
    let mau = 0;

    students.forEach((s) => {
      if (!s.last_login) return;
      const loginTime = new Date(s.last_login).getTime();
      const diff = now - loginTime;

      if (diff <= MS_24H) dau++;
      if (diff <= MS_7D) wau++;
      if (diff <= MS_30D) mau++;
    });

    return { dau, wau, mau };
  }, [students, now]);

  const total = Math.max(totalStudents, 1);

  const metrics = [
    { label: 'Daily Active Users', abbr: 'DAU', value: dau, color: '#10B981' },
    { label: 'Weekly Active Users', abbr: 'WAU', value: wau, color: '#3B82F6' },
    { label: 'Monthly Active Users', abbr: 'MAU', value: mau, color: '#8B5CF6' },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%' }}>
      {metrics.map((m) => {
        const pct = Math.round((m.value / total) * 100);
        return (
          <div
            key={m.abbr}
            style={{
              flex: '1 1 160px',
              minWidth: 160,
              background: THEME.cardBg,
              borderRadius: 12,
              border: `1px solid ${THEME.cardBorder}`,
              padding: '14px 16px',
              fontFamily: FONT_BODY,
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = THEME.cardBorderHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = THEME.cardBorder;
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div>
                <p
                  style={{
                    margin: '0 0 2px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: m.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {m.abbr}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: THEME.textSecondary, fontWeight: 500 }}>
                  {m.label}
                </p>
              </div>

              {/* Circular progress ring */}
              <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                <CircularProgress percentage={pct} color={m.color} size={48} strokeWidth={5} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: THEME.textPrimary, fontFamily: FONT_NUMBERS }}>{pct}%</span>
                </div>
              </div>
            </div>

            {/* Count */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: THEME.textPrimary, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: FONT_NUMBERS }}>{m.value}</span>
              <span style={{ fontSize: 12, color: THEME.textSecondary, fontWeight: 500 }}>/ {totalStudents}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

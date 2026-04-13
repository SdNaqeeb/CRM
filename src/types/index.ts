// Type definitions for Smartlearners.ai CRM

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  SCHOOL_ADMIN = 'school_admin',
  ORCALEX_ADMIN = 'orcalex_admin'
}

export enum EngagementStatus {
  ACTIVE = 'active',
  AT_RISK = 'at_risk',
  LOW_ENGAGEMENT = 'low_engagement',
  INACTIVE = 'inactive'
}

export enum NotificationType {
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
  EMAIL = 'email',
  IN_APP = 'in_app'
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  whatsapp_number?: string;
  role: UserRole;
  school_id?: number;
  school_code?: string;
  username?: string;
  is_active: boolean;
  created_at: string;
}

export interface School {
  id: number;
  name: string;
  location?: string;
  country?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  onboarded_at: string;
}

export interface StudentProfile {
  id: number;
  user_id: number;
  grade?: string;
  section?: string;
  student_id?: string;
  last_login?: string;
  total_sessions: number;
  total_modules_completed: number;
  engagement_status: EngagementStatus;
  created_at: string;
}

export interface StudentEngagementSummary {
  student_id: number;
  user_id: number;
  full_name: string;
  username?: string;
  email: string;
  grade?: string;
  section?: string;
  last_login?: string;
  days_since_login?: number;
  total_sessions: number;
  sessions_this_week: number;
  engagement_status: EngagementStatus;
  has_active_alert: boolean;
  is_currently_active: boolean;
  auth_provider?: string;
  role?: string;
  school_id?: number;
}

export interface TestPrepItem {
  id: number;
  student_id: number;
  username: string;
  student_name: string;
  name: string;
  description?: string | null;
  created_at: string;
  prediction: Record<string, any>;
  analysis: Record<string, any>;
  remedial_plan: Record<string, any>;
  graph_data: Record<string, any>;
  questions: any[];
}

export interface TestPrepSchoolResponse {
  school_id: number;
  school_name: string;
  school_code: string;
  total: number;
  items: TestPrepItem[];
}

export interface EngagementAlert {
  id: number;
  student_id: number;
  alert_type: EngagementStatus;
  reason: string;
  days_inactive?: number;
  sessions_this_week?: number;
  is_resolved: boolean;
  created_at: string;
}

export interface SendAlertRequest {
  student_id: number;
  message?: string;
}

export interface BulkSendAlertRequest {
  student_ids: number[];
  message?: string;
}

export interface AlertResult {
  student_id: number;
  student_name: string;
  phone?: string;
  success: boolean;
  detail: string;
}

export interface TeacherDashboardData {
  total_students: number;
  active_students: number;
  active_sessions: number;
  at_risk_students: number;
  low_engagement_students: number;
  inactive_students: number;
  students: StudentEngagementSummary[];
  recent_alerts: EngagementAlert[];
  teacher_name?: string;
  teacher_id?: number;
}

export interface SchoolDashboardData {
  school_id: number;
  school_name: string;
  total_students: number;
  active_this_week: number;
  active_sessions: number;
  at_risk_count: number;
  inactive_count: number;
  total_sessions_this_week: number;
  engagement_trend: 'up' | 'down' | 'stable';
  students: StudentEngagementSummary[];
  teachers: StudentEngagementSummary[];
  recent_alerts: EngagementAlert[];
}

export interface OrcaLexSchoolSummary {
  school_id: number;
  school_name: string;
  total_students: number;
  total_teachers: number;
  active_this_week: number;
  active_sessions: number;
  at_risk_count: number;
  inactive_count: number;
  total_sessions_this_week: number;
  engagement_trend: 'up' | 'down' | 'stable';
}

export interface OrcaLexDashboardData {
  total_schools: number;
  total_students: number;
  total_teachers: number;
  active_this_week: number;
  active_sessions: number;
  at_risk_count: number;
  inactive_count: number;
  total_sessions_this_week: number;
  schools: OrcaLexSchoolSummary[];
  all_students: StudentEngagementSummary[];
  all_teachers: StudentEngagementSummary[];
  recent_alerts: EngagementAlert[];
}


export interface ActivityEntry {
  id: number;
  user_id: number;
  user_name: string;
  activity_type: string;
  title: string;
  subject?: string;
  score?: number;
  max_score?: number;
  percentage?: number;
  timestamp: string;
  role: string;
}

export interface DailyActivitySummary {
  date: string;
  total_submissions: number;
  student_submissions: number;
  teacher_activities: number;
  entries: ActivityEntry[];
}

export interface ActivityOverview {
  total_student_submissions: number;
  total_teacher_activities: number;
  total_gap_analysis: number;
  total_homework_submissions: number;
  total_exams_created: number;
  total_classwork: number;
  daily_breakdown: DailyActivitySummary[];
}

export interface UserActivityTimeline {
  user_id: number;
  user_name: string;
  role: string;
  total_activities: number;
  activities: ActivityEntry[];
}

// MCQ Challenge Preview types
export interface MCQOption {
  label: string;
  text: string;
}

export interface MCQQuestion {
  question: string;
  options: MCQOption[];
  correct_answer: string;
  explanation: string;
}

export interface GeneratePreviewRequest {
  subject: string;
  grade: string;
  num_questions: number;
  concept?: string;
}

export interface GeneratePreviewResponse {
  questions: MCQQuestion[];
}

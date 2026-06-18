import axios from 'axios';
import type {
  TeacherDashboardData,
  SchoolDashboardData,
  OrcaLexDashboardData,
  StudentEngagementSummary,
  EngagementAlert,
  SendAlertRequest,
  BulkSendAlertRequest,
  AlertResult,
  ActivityOverview,
  UserActivityTimeline,
  GeneratePreviewRequest,
  GeneratePreviewResponse,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://crm.smartlearners.ai/backend-api/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============= Dashboard APIs =============
export const dashboardAPI = {
  getTeacherDashboard: async (schoolId: number): Promise<TeacherDashboardData> => {
    const response = await api.get(`/api/dashboard/teacher/${schoolId}`);
    return response.data;
  },

  getTeacherDashboardByUsername: async (username: string): Promise<TeacherDashboardData> => {
    const response = await api.get(`/api/dashboard/teacher/by-username/${username}`);
    return response.data;
  },

  getSchoolDashboard: async (schoolId: number): Promise<SchoolDashboardData> => {
    const response = await api.get(`/api/dashboard/school/${schoolId}`);
    return response.data;
  },

  getSchoolDashboardByCode: async (schoolCode: string): Promise<SchoolDashboardData> => {
    const response = await api.get(`/api/dashboard/school/by-code/${schoolCode}`);
    return response.data;
  },

  getOrcaLexDashboard: async (): Promise<OrcaLexDashboardData> => {
    const response = await api.get('/api/dashboard/orcalex/all');
    return response.data;
  },

  getStudentSummary: async (studentId: number) => {
    const response = await api.get(`/api/dashboard/student-summary/${studentId}`);
    return response.data;
  },

  getUserLoginLogs: async (username: string, limit: number = 500) => {
    const response = await api.post('/api/external-data/user-login-logs/by-username', { username, limit });
    return response.data as {
      student_id: number;
      student_name: string;
      username: string;
      total_days: number;
      total_sessions: number;
      total_time_seconds: number;
      items: Array<{
        date: string;
        total_sessions: number;
        completed_sessions: number;
        active_sessions: number;
        total_time_seconds: number;
        first_login_time: string | null;
        last_logout_time: string | null;
        api_request_count: number;
        sessions: Array<{
          session_id: number;
          login_time: string | null;
          logout_time: string | null;
          is_active: boolean;
          session_duration_seconds: number;
          segment_duration_seconds: number;
          api_request_count: number;
          activities: Array<{
            timestamp: string | null;
            path: string | null;
            method: string | null;
            status_code: number | null;
            request_data: any;
          }>;
        }>;
      }>;
    };
  },

  getTestPrepBySchoolCode: async (schoolCode: string, limit: number = 500) => {
    const response = await api.post('/api/external-data/test-prep/by-school-code', {
      school_code: schoolCode,
      limit,
    });
    return response.data;
  },

  getTestPrepByUsernameSchoolCode: async (schoolCode: string, username: string, limit: number = 500) => {
    const response = await api.post('/api/external-data/test-prep/by-username-school-code', {
      school_code: schoolCode,
      username,
      limit,
    });
    return response.data;
  },
};

// ============= Engagement APIs =============
export const engagementAPI = {
  detectAtRisk: async (schoolId: number): Promise<StudentEngagementSummary[]> => {
    const response = await api.get(`/api/engagement/detect-at-risk/${schoolId}`);
    return response.data;
  },

  detectAtRiskForTeacher: async (username: string): Promise<StudentEngagementSummary[]> => {
    const response = await api.get(`/api/engagement/detect-at-risk/teacher/${username}`);
    return response.data;
  },

  getAlerts: async (schoolId: number, resolved: boolean = false): Promise<EngagementAlert[]> => {
    const response = await api.get(`/api/engagement/alerts/${schoolId}`, {
      params: { resolved },
    });
    return response.data;
  },

  resolveAlert: async (alertId: number) => {
    const response = await api.post(`/api/engagement/alerts/${alertId}/resolve`);
    return response.data;
  },

  getStudentStatus: async (studentId: number) => {
    const response = await api.get(`/api/engagement/status/${studentId}`);
    return response.data;
  },
};

// ============= Alert APIs =============
export const alertAPI = {
  sendAlert: async (request: SendAlertRequest): Promise<AlertResult> => {
    const response = await api.post('/api/alerts/send', request);
    return response.data;
  },

  sendBulkAlert: async (request: BulkSendAlertRequest): Promise<AlertResult[]> => {
    const response = await api.post('/api/alerts/send-bulk', request);
    return response.data;
  },
};

// ============= Activity APIs =============
export const activityAPI = {
  getSchoolActivity: async (schoolId: number, days: number = 14): Promise<ActivityOverview> => {
    const response = await api.get(`/api/activity/school/${schoolId}`, {
      params: { days },
    });
    return response.data;
  },

  getStudentActivity: async (studentId: number, days: number = 30): Promise<UserActivityTimeline> => {
    const response = await api.get(`/api/activity/student/${studentId}`, {
      params: { days },
    });
    return response.data;
  },

  getTeacherActivity: async (teacherId: number, days: number = 30): Promise<UserActivityTimeline> => {
    const response = await api.get(`/api/activity/teacher/${teacherId}`, {
      params: { days },
    });
    return response.data;
  },
};

// ============= Challenge APIs =============
export const challengeAPI = {
  generatePreview: async (request: GeneratePreviewRequest): Promise<GeneratePreviewResponse> => {
    const response = await api.post('/api/challenges/generate-preview', request);
    return response.data;
  },

  sendChallenge: async (studentId: number, subject: string, numQuestions: number = 5, concept?: string) => {
    const response = await api.post('/api/challenges/send-manual', {
      student_id: studentId,
      subject,
      concept,
      num_questions: numQuestions,
    });
    return response.data;
  },
};

// ============= Chat APIs =============
export interface ChatRequest {
  message: string;
  role: string;
  school_id?: number;
  school_code?: string;
  username?: string;
  dashboard_data?: any;
  chat_history?: { sender: string; text: string }[];
  class_name?: string;
  exam_type?: string;
  timeline_days?: number;
}

export interface ChatResponse {
  reply: string;
  intent?: string;
}

export const chatAPI = {
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    const response = await api.post('/api/chat', request);
    return response.data;
  },
};

// ============= Quiz APIs =============
export const quizAPI = {
  getHomeworks: async (username: string, limit: number = 500) => {
    const response = await api.post('/api/external-data/quiz-homework/by-username', { username, limit });
    return response.data as {
      school_id: number;
      school_name: string;
      school_code: string | null;
      username: string;
      teacher_id: number;
      total: number;
      items: QuizHomeworkItem[];
    };
  },

  getSubmissions: async (homeworkId: number, limit: number = 1000) => {
    const response = await api.post('/api/external-data/quiz-homework/submissions/by-homework-id', { homework_id: homeworkId, limit });
    return response.data as {
      homework_id: number;
      homework_title: string | null;
      total: number;
      items: QuizSubmissionItem[];
    };
  },
};

export interface QuizHomeworkItem {
  id: number;
  homework_code: string | null;
  title: string | null;
  description_data: {
    source: string;
    subject?: string;
    subject_name?: string;
    chapters?: string[];
    class_name?: string;
    questions_per_chapter?: number;
  } | null;
  due_date: string | null;
  date_assigned: string | null;
  total_submissions: number;
}

export interface QuizSubmissionItem {
  id: number;
  student_id: number;
  student_name: string;
  class_name: string | null;
  section_name: string | null;
  created_at: string | null;
  graph_data: any;
  analysis: any;
  prediction: any;
}

// ============= Exam APIs =============
export interface TeacherExamItem {
  exam_id: number;
  exam_name: string;
  exam_type: string;
  total_students: number;
  average_score: number;
  attempted_count: number;
}

export interface ExamAttemptItem {
  student_id: number;
  student_name: string;
  username: string;
  class_name: string | null;
  section_name: string | null;
  score_obtained: number;
  max_score: number;
  percentage: number;
  grade: string;
}

export interface MockExamItem {
  homework_id: number;
  homework_code: string | null;
  title: string | null;
  description: string | null;
  chapters: string[];
  due_date: string | null;
  date_assigned: string | null;
  attachment: string | null;
  teacher_id?: number | null;
  teacher_name?: string | null;
  teacher_username?: string | null;
  question_count: number;
  total_submissions: number;
  average_score: number | null;
}

export interface MockExamClassSectionRequest {
  school_code: string;
  class_id?: number;
  class_code?: string;
  section_id?: number;
  section_name?: string;
  limit?: number;
}

export interface MockExamResultItem {
  student_id: number;
  student_name: string;
  username: string | null;
  roll_number: string | null;
  class_name: string | null;
  section_name: string | null;
  score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  time_spent_seconds: number;
  submitted_at: string | null;
}

export const examAPI = {
  getTeacherExams: async (username: string, limit: number = 100) => {
    const response = await api.post('/api/external-data/teacher-exams/by-username', { username, limit });
    return response.data as {
      username: string;
      teacher_id: number;
      school_id: number;
      total: number;
      items: TeacherExamItem[];
    };
  },

  getExamAttempts: async (examId: number, limit: number = 1000) => {
    const response = await api.post('/api/external-data/teacher-exams/attempts/by-exam-id', { exam_id: examId, limit });
    return response.data as {
      exam_id: number;
      exam_name: string;
      exam_type: string;
      total: number;
      items: ExamAttemptItem[];
    };
  },

  getMockExams: async (username: string, limit: number = 100) => {
    const response = await api.post('/api/external-data/mock-exams/by-username', { username, limit });
    return response.data as {
      school_id: number;
      school_name: string;
      school_code: string;
      teacher_id: number;
      username: string;
      total: number;
      items: MockExamItem[];
    };
  },

  getMockExamsByClassSection: async (request: MockExamClassSectionRequest) => {
    const response = await api.post('/api/external-data/mock-exams/by-class-section', request);
    return response.data as {
      school_id: number;
      school_name: string;
      school_code: string;
      class_id: number;
      class_name: string | null;
      section_id: number | null;
      section_name: string | null;
      total: number;
      items: MockExamItem[];
    };
  },

  getMockExamResults: async (homeworkId: number, limit: number = 500) => {
    const response = await api.post('/api/external-data/mock-exams/results/by-homework-id', { homework_id: homeworkId, limit });
    return response.data as {
      homework_id: number;
      homework_code: string;
      title: string;
      description: string;
      due_date: string | null;
      date_assigned: string | null;
      attachment: string | null;
      teacher_id: number;
      teacher_name: string;
      username: string;
      school_id: number;
      school_name: string;
      school_code: string;
      question_count: number;
      total_submissions: number;
      average_score: number;
      total: number;
      items: MockExamResultItem[];
      

    };
  },
};

// ============= Scheduled Assignment APIs =============
export interface ScheduledAssignmentItem {
  assignment_id: string;
  id?: number;
  assignment_code: string | null;
  homework_code?: string | null;
  title: string | null;
  status: string | null;
  scheduled_date: string | null;
  date_assigned?: string | null;
  due_date: string | null;
  class_id: number | null;
  class_name: string | null;
  section_id: number | null;
  section_name: string | null;
  subject_id: number | null;
  subject_name: string | null;
  topic_id: number | null;
  topic_name: string | null;
  subtopic_code: string | null;
  question_count: number;
  assigned_count: number;
  viewed_count: number;
  submitted_count: number;
  missed_count: number;
  cancelled_count: number;
}

export interface ScheduledAssignmentStudentResult {
  student_id: number;
  student_name: string;
  username: string | null;
  roll_number: string | null;
  assignment_status: string | null;
  submission_status: string | null;
  score: number | null;
  max_possible_score: number | null;
  percentage: number | null;
  grade: string | null;
}

export const scheduledAssignmentAPI = {
  getByUsername: async (username: string, limit: number = 500) => {
    const response = await api.post('/api/external-data/scheduled-assignments/by-username', { username, limit });
    return response.data as {
      teacher_id: number;
      username: string;
      school_id: number | null;
      school_name: string | null;
      school_code: string | null;
      total: number;
      items: ScheduledAssignmentItem[];
    };
  },

  getResultsByCode: async (assignment_code: string, limit: number = 1000) => {
    const response = await api.post('/api/external-data/scheduled-assignments/results/by-assignment-code', { assignment_code, limit });
    return response.data as {
      assignment_id: string;
      assignment_code: string | null;
      title: string | null;
      topic_name: string | null;
      evaluated_count: number;
      average_score: number | null;
      average_percentage: number | null;
      total: number;
      items: ScheduledAssignmentStudentResult[];
    };
  },
};

// ============= Health Check =============
export const healthAPI = {
  getStatus: async () => {
    const response = await api.get('/');
    return response.data;
  },

  getHealth: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;

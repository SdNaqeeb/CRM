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

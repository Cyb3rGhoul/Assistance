// API configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = {
  baseURL: API_URL,
  endpoints: {
    auth: {
      login: `${API_URL}/api/auth/login`,
      register: `${API_URL}/api/auth/register`,
    },
    tasks: {
      list: `${API_URL}/api/tasks`,
      create: `${API_URL}/api/tasks`,
      update: (id: string) => `${API_URL}/api/tasks/${id}`,
      delete: (id: string) => `${API_URL}/api/tasks/${id}`,
      deleteAll: `${API_URL}/api/tasks`,
    },
    voice: {
      process: `${API_URL}/api/voice/process`,
    },
    links: {
      list: `${API_URL}/api/links`,
      create: `${API_URL}/api/links`,
      update: (id: string) => `${API_URL}/api/links/${id}`,
      delete: (id: string) => `${API_URL}/api/links/${id}`,
      metadata: `${API_URL}/api/links/metadata`,
    },
  },
};

export default api;

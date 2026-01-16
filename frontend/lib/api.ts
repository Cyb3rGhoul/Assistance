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
      update: (id: string) => `${API_URL}/api/tasks/${id}`,
      delete: (id: string) => `${API_URL}/api/tasks/${id}`,
    },
    voice: {
      process: `${API_URL}/api/voice/process`,
    },
  },
};

export default api;

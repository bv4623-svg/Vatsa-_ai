export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export const API_ENDPOINTS = {
  profile: `${API_BASE}/api/profile`,    // if backend uses /api prefix
  conversations: `${API_BASE}/api/conversations`,
  chat: `${API_BASE}/api/chat`,
  // add others as needed
};
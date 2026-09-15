import { API_BASE } from '@/config/api';

export interface User {
  email: string;
  token: string;
  name?: string;
}

export async function fetchProfile(user: User): Promise<User> {
  if (!user?.token) {
    throw new Error('No token provided');
  }

  const response = await fetch(`${API_BASE}/api/profile`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
      'X-User-Email': user.email,   // agar backend yeh expect karta hai
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Profile fetch failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    email: data.email,
    token: user.token,    // token wahi rahega
    name: data.name || user.email,
  };
}
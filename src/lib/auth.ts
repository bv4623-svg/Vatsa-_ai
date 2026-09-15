export function getToken(): string | null {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('access_token');
    }
    return null;
}

export function setToken(token: string) {
    localStorage.setItem('token', token);
}

export function removeToken() {
    localStorage.removeItem('token');
}

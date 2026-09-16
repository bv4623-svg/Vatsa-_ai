export function getToken(): string | null {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('access_token');
    }
    return null;
}

export function setToken(access_token: string) {
    localStorage.setItem('access_token', access_token);
}

export function removeToken() {
    localStorage.removeItem('access_token');
}



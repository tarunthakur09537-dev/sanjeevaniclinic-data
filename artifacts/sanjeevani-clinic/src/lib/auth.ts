export const AUTH_KEY = 'clinic_auth';

export interface AuthState {
  authenticated: boolean;
  timestamp: number;
}

export function setAuth(status: boolean) {
  if (status) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      authenticated: true,
      timestamp: Date.now()
    }));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

export function checkAuth(): boolean {
  try {
    const data = localStorage.getItem(AUTH_KEY);
    if (!data) return false;
    
    const parsed = JSON.parse(data) as AuthState;
    // Optional: add expiry logic here, e.g., expire after 24h
    // const ONE_DAY = 24 * 60 * 60 * 1000;
    // if (Date.now() - parsed.timestamp > ONE_DAY) {
    //   setAuth(false);
    //   return false;
    // }
    
    return parsed.authenticated;
  } catch {
    return false;
  }
}

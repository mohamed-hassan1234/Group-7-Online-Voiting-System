const SESSION_KEY = "auth_session_v1";

export const saveSession = (user) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ user }));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getSession = () => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getSessionUser = () => getSession()?.user || null;

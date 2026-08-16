import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAccessToken, setUnauthenticatedHandler } from '../lib/api.js';
import { ROLES } from '../lib/constants.js';

const AuthContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components -- colocated on purpose, every screen imports both from here
export const useAuth = () => useContext(AuthContext);

// eslint-disable-next-line react-refresh/only-export-components
export const homeFor = (role) =>
  ({
    [ROLES.PLATFORM_ADMIN]: '/platform',
    [ROLES.ORG_ADMIN]: '/app',
    [ROLES.ORG_MEMBER]: '/member',
  })[role] ?? '/login';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Only wipe the query cache when there was a session to log out of. On the
  // very first mount, before any session exists, clearing here would also
  // nuke unrelated public queries (like the plans list on the landing page)
  // that already resolved, sending them back into a spurious refetch.
  const clear = useCallback(() => {
    setAccessToken(null);
    setUser((prev) => {
      if (prev) queryClient.clear();
      return null;
    });
  }, [queryClient]);

  // On first load the access token is gone (memory only), but the httpOnly
  // refresh cookie may still be valid. One refresh restores the session.
  //
  // Refresh tokens are single use: a second call rotates a token the first
  // call already rotated, trips reuse detection, and revokes the whole
  // family (the first call's brand new token included). StrictMode's dev-only
  // double-invoke of this effect fired exactly that pair on every reload, so
  // this ref makes sure the request only ever goes out once per mount.
  const didInit = useRef(false);
  useEffect(() => {
    setUnauthenticatedHandler(clear);
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      try {
        const data = await api.post('/auth/refresh');
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        clear();
      } finally {
        setLoading(false);
      }
    })();
  }, [clear]);

  const login = async (credentials) => {
    const data = await api.post('/auth/login', credentials);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await api.post('/auth/register', payload);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data; // carries checkoutUrl
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clear();
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

const ready = (user) => ({ status: 'ready', user });

function makeActions(setState) {
  const signIn = async (call, body) => {
    const { user } = await call(body);
    setState(ready(user));
    return user;
  };
  return {
    login: (body) => signIn(api.login, body),
    register: (body) => signIn(api.register, body),
    logout: async () => { await api.logout(); setState(ready(null)); },
  };
}

const useAuthActions = (setState) => useMemo(() => makeActions(setState), [setState]);

// status: 'loading' until we know whether a session cookie is valid; then 'ready'.
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });
  useEffect(() => {
    api.me().then(({ user }) => setState({ status: 'ready', user })).catch(() => setState({ status: 'ready', user: null }));
  }, []);
  const actions = useAuthActions(setState);
  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

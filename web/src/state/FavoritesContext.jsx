import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const FavoritesContext = createContext(null);

// Signed in: favorites live on the server. Signed out: in this browser. On sign-in, local ones are merged up.
function useServerSync(user, local, setLocal, setRemote) {
  useEffect(() => {
    if (!user) return setRemote([]);
    Promise.all(local.map((id) => api.addFavorite(id).catch(() => null)))
      .then(() => api.favoriteIds())
      .then(({ ids }) => { setRemote(ids); setLocal([]); })
      .catch(() => setRemote([]));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

const flip = (list, id, saved) => (saved ? list.filter((x) => x !== id) : [id, ...list]);

function useToggle({ user, ids, setLocal, setRemote }) {
  const { notify } = useToast();
  return useCallback(async (id) => {
    const saved = ids.includes(id);
    if (!user) return setLocal((list) => flip(list, id, saved));
    setRemote((list) => flip(list, id, saved)); // optimistic: update the UI first
    const failed = await (saved ? api.removeFavorite(id) : api.addFavorite(id)).then(() => false, () => true);
    if (failed) { setRemote(ids); notify('Could not update saved homes', 'error'); } // roll back
  }, [user, ids, setLocal, setRemote, notify]);
}

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [local, setLocal] = useLocalStorage('hearth:saved', []);
  const [remote, setRemote] = useState([]);
  useServerSync(user, local, setLocal, setRemote);
  const ids = user ? remote : local;
  const toggle = useToggle({ user, ids, setLocal, setRemote });
  const value = useMemo(() => ({ ids, toggle }), [ids, toggle]);
  return <FavoritesContext value={value}>{children}</FavoritesContext>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside <FavoritesProvider>');
  return ctx;
}

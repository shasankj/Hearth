import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../state/ToastContext.jsx';

const MAX = 3;

// Up to 3 homes to compare side by side. `toggle` is referentially stable so memoized cards don't re-render.
const has = (list, l) => list.some((x) => x.id === l.id);
const flip = (list, l) => (has(list, l) ? list.filter((x) => x.id !== l.id) : [...list, l]);

export function useCompare() {
  const [items, setItems] = useState([]);
  const latest = useRef(items);
  useEffect(() => { latest.current = items; }, [items]);
  const { notify } = useToast();
  const toggle = useCallback((listing) => {
    const cur = latest.current;
    if (!has(cur, listing) && cur.length >= MAX) return notify(`Compare up to ${MAX} homes`);
    setItems(flip(cur, listing));
  }, [notify]);
  return { items, toggle, clear: useCallback(() => setItems([]), []) };
}

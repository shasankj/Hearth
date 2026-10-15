import { useEffect, useState } from 'react';

// Returns `value` only after it stopped changing for `ms` (stops request storms while typing/dragging).
export function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

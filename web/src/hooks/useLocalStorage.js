import { useEffect, useState } from 'react';

function read(key, initial) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : initial;
  } catch {
    return initial; // private mode / blocked storage: the app still works
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => read(key, initial)); // lazy initializer: read once
  useEffect(() => write(key, value), [key, value]);
  return [value, setValue];
}

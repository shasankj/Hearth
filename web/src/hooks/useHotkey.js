import { useEffect, useRef } from 'react';

const isTyping = (el) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;

function handle(e, key, ref) {
  if (e.key !== key || isTyping(e.target)) return;
  e.preventDefault();
  ref.current?.focus();
}

// Press `key` anywhere to focus the element that receives the returned ref.
export function useHotkey(key) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => handle(e, key, ref);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key]);
  return ref;
}

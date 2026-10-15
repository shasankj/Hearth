import { useEffect, useEffectEvent } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

function wrapFocus(e, items) {
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function handleKey(e, node, onClose) {
  if (e.key === 'Escape') return onClose();
  if (e.key !== 'Tab') return;
  const items = [...node.querySelectorAll(FOCUSABLE)];
  if (items.length > 0) wrapFocus(e, items);
}

// Locks background scroll; returns the function that restores it.
function lockScroll() {
  document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = ''; };
}

function unmount(onKey, unlock, previous) {
  document.removeEventListener('keydown', onKey);
  unlock();
  previous?.focus?.(); // return focus to whatever opened the dialog
}

function mount(node, onKey) {
  const previous = document.activeElement;
  const unlock = lockScroll();
  node.focus();
  document.addEventListener('keydown', onKey);
  return () => unmount(onKey, unlock, previous);
}

// Accessible modal behavior: focus moves in, Tab is trapped, Esc closes, background scroll locks, focus returns.
export function useDialogBehavior(ref, onClose) {
  const onKey = useEffectEvent((e) => handleKey(e, ref.current, onClose)); // always sees the latest onClose
  useEffect(() => mount(ref.current, onKey), [ref]);
}

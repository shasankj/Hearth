import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialogBehavior } from '../hooks/useDialogBehavior.js';

function Panel({ ref, title, size, onClose, children }) {
  return (
    <section ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`dialog ${size}`}>
      <button type="button" className="icon close" aria-label="Close" onClick={onClose}>✕</button>
      {children}
    </section>
  );
}

// A portal renders into <body>, escaping parent overflow/z-index, while staying in the React tree (context works).
export function Dialog({ title, onClose, size = 'md', children }) {
  const ref = useRef(null);
  useDialogBehavior(ref, onClose);
  const close = (e) => e.target === e.currentTarget && onClose(); // click on the dim backdrop only
  return createPortal(
    <div className="backdrop" onMouseDown={close}>
      <Panel ref={ref} title={title} size={size} onClose={onClose}>{children}</Panel>
    </div>,
    document.body,
  );
}

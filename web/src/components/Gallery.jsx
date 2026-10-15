import { useEffect, useState } from 'react';
import { SCENES } from '../lib/art.js';
import { Dialog } from './Dialog.jsx';
import { Photo } from './Scenes.jsx';

const LABELS = { exterior: 'Exterior', living: 'Living room', kitchen: 'Kitchen', bedroom: 'Bedroom', bath: 'Bathroom' };

function Thumbs({ listing, index, onPick }) {
  return (
    <div className="thumbs" role="tablist" aria-label="Photos">
      {SCENES.map((kind, i) => (
        <button key={kind} type="button" role="tab" aria-selected={i === index} className={i === index ? 'thumb on' : 'thumb'} onClick={() => onPick(i)} aria-label={LABELS[kind]}>
          <Photo listing={listing} index={i} kind={kind} />
        </button>
      ))}
    </div>
  );
}

function useArrowKeys(onPrev, onNext) {
  useEffect(() => {
    const onKey = (e) => (e.key === 'ArrowLeft' ? onPrev() : e.key === 'ArrowRight' && onNext());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPrev, onNext]);
}

function LightboxBar({ i, step }) {
  return (
    <div className="lightbox-bar">
      <button type="button" className="btn ghost small" onClick={() => step(-1)}>← Prev</button>
      <span>{LABELS[SCENES[i]]} · {i + 1}/{SCENES.length}</span>
      <button type="button" className="btn ghost small" onClick={() => step(1)}>Next →</button>
    </div>
  );
}

function Lightbox({ listing, start, onClose }) {
  const [i, setI] = useState(start);
  const step = (d) => setI((n) => (n + d + SCENES.length) % SCENES.length);
  useArrowKeys(() => step(-1), () => step(1));
  return (
    <Dialog title={`${listing.address} photos`} size="xl" onClose={onClose}>
      <div className="lightbox"><Photo listing={listing} index={i} kind={SCENES[i]} /></div>
      <LightboxBar i={i} step={step} />
    </Dialog>
  );
}

function HeroPhoto({ listing, index, onOpen, children }) {
  return (
    <button type="button" className="hero-photo" data-cy="gallery-open" aria-label="Open photo viewer" onClick={onOpen}>
      <Photo listing={listing} index={index} kind={SCENES[index]} />
      {children}
    </button>
  );
}

// Big hero image + thumbnails; click (or Enter) opens a full-screen lightbox with arrow-key navigation.
export function Gallery({ listing, children }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <section className="gallery" aria-label="Photos">
      <HeroPhoto listing={listing} index={index} onOpen={() => setOpen(true)}>{children}</HeroPhoto>
      <Thumbs listing={listing} index={index} onPick={setIndex} />
      {open && <Lightbox listing={listing} start={index} onClose={() => setOpen(false)} />}
    </section>
  );
}

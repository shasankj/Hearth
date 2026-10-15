import { useId } from 'react';
import { paletteFor } from '../lib/art.js';

// Illustrated "photos" generated from the listing id (palette) and data (lit windows = bedrooms).
// Real photos: put URLs in listings.photos and <Photo> shows them instead.
const SPOTS = [[56, 72], [132, 72], [56, 96], [132, 96]];

function Backdrop({ gid, a, b }) {
  return (
    <>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="200" height="120" fill={`url(#${gid})`} />
    </>
  );
}

function Windows({ lit }) {
  return SPOTS.map(([x, y], i) => <rect key={i} x={x} y={y} width="14" height="14" rx="2" className={i < lit ? 'win lit' : 'win'} />);
}

function Tree({ x, s = 1 }) {
  return (
    <g transform={`translate(${x} 0) scale(${s})`} style={{ transformOrigin: `${x}px 120px` }}>
      <rect x="-2" y="88" width="4" height="30" fill="rgba(60,35,20,.7)" />
      <circle cx="0" cy="80" r="14" fill="rgba(36,110,70,.9)" />
      <circle cx="-8" cy="90" r="10" fill="rgba(46,130,82,.9)" />
    </g>
  );
}

function HouseBody({ beds }) {
  return (
    <g>
      <path d="M40 120V62l60-38 60 38v58z" fill="rgba(255,255,255,.94)" />
      <path d="M32 64L100 20l68 44" stroke="rgba(0,0,0,.28)" strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="90" y="86" width="20" height="34" rx="3" fill="rgba(0,0,0,.35)" />
      <Windows lit={beds} />
    </g>
  );
}

function Exterior({ beds }) {
  return (
    <g>
      <circle cx="168" cy="24" r="12" fill="#fff6c8" opacity=".92" />
      <ellipse cx="100" cy="128" rx="150" ry="26" fill="rgba(0,0,0,.2)" />
      <Tree x={22} /><Tree x={180} s={0.8} />
      <HouseBody beds={beds} />
    </g>
  );
}

function Window({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width="46" height="40" rx="3" fill="rgba(255,255,255,.9)" />
      <rect x={x + 3} y={y + 3} width="40" height="34" rx="2" fill="#bfe3ff" />
      <path d={`M${x + 23} ${y + 3}v34M${x + 3} ${y + 20}h40`} stroke="rgba(255,255,255,.95)" strokeWidth="2" />
    </g>
  );
}

function Sofa() {
  return (
    <g>
      <rect x="40" y="64" width="86" height="26" rx="8" fill="rgba(255,255,255,.88)" />
      <rect x="34" y="72" width="18" height="24" rx="6" fill="rgba(255,255,255,.96)" />
      <rect x="114" y="72" width="18" height="24" rx="6" fill="rgba(255,255,255,.96)" />
      <rect x="52" y="76" width="62" height="18" rx="5" fill="rgba(255,255,255,.99)" />
    </g>
  );
}

function Lamp() {
  return (
    <g>
      <path d="M170 56v44" stroke="rgba(0,0,0,.4)" strokeWidth="2" />
      <path d="M162 56h16l-4-12h-8z" fill="#ffd36b" />
    </g>
  );
}

function Living() {
  return (
    <g>
      <rect y="94" width="200" height="26" fill="rgba(0,0,0,.24)" />
      <Window x={118} y={14} />
      <rect x="22" y="20" width="44" height="28" rx="2" fill="rgba(255,255,255,.5)" />
      <ellipse cx="86" cy="106" rx="60" ry="8" fill="rgba(255,255,255,.3)" />
      <Sofa />
      <Lamp />
    </g>
  );
}

const PENDANTS = [70, 100, 130];

function Pendants() {
  return PENDANTS.map((x) => (
    <g key={x}>
      <path d={`M${x} 40v14`} stroke="rgba(0,0,0,.4)" strokeWidth="1.5" />
      <path d={`M${x - 7} 62a7 7 0 0 1 14 0z`} fill="#ffd36b" />
    </g>
  ));
}

function Kitchen() {
  return (
    <g>
      <rect y="92" width="200" height="28" fill="rgba(0,0,0,.24)" />
      {[10, 66, 122].map((x) => <rect key={x} x={x} y="10" width="52" height="30" rx="2" fill="rgba(255,255,255,.88)" />)}
      <rect x="0" y="62" width="200" height="30" fill="rgba(255,255,255,.72)" />
      <rect x="40" y="80" width="120" height="26" rx="3" fill="rgba(255,255,255,.96)" />
      <Pendants />
    </g>
  );
}

function Pillows() {
  return (
    <g>
      <rect x="48" y="58" width="36" height="14" rx="6" fill="#fff" />
      <rect x="116" y="58" width="36" height="14" rx="6" fill="#fff" />
    </g>
  );
}

function Bedroom() {
  return (
    <g>
      <rect y="92" width="200" height="28" fill="rgba(0,0,0,.24)" />
      <rect x="40" y="38" width="120" height="30" rx="4" fill="rgba(0,0,0,.28)" />
      <rect x="36" y="64" width="128" height="34" rx="6" fill="rgba(255,255,255,.95)" />
      <rect x="36" y="78" width="128" height="20" rx="4" fill="rgba(255,255,255,.7)" />
      <Pillows />
      <circle cx="172" cy="22" r="9" fill="#fff6c8" opacity=".9" />
    </g>
  );
}

function Bath() {
  return (
    <g>
      <path d="M0 40h200M0 80h200M50 0v120M100 0v120M150 0v120" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
      <rect y="96" width="200" height="24" fill="rgba(0,0,0,.24)" />
      <path d="M30 70h120a4 4 0 0 1 4 4v8a22 22 0 0 1-22 22H48a22 22 0 0 1-22-22v-8a4 4 0 0 1 4-4z" fill="rgba(255,255,255,.96)" />
      <circle cx="160" cy="34" r="16" fill="rgba(255,255,255,.8)" stroke="rgba(0,0,0,.25)" strokeWidth="3" />
      <rect x="20" y="30" width="14" height="30" rx="3" fill="rgba(255,255,255,.7)" />
    </g>
  );
}

const SCENE = { exterior: Exterior, living: Living, kitchen: Kitchen, bedroom: Bedroom, bath: Bath };

export function Scene({ kind = 'exterior', id, beds = 2, label }) {
  const gid = useId(); // unique per instance: the same listing can appear in several places on one page
  const [a, b] = paletteFor(id);
  const Part = SCENE[kind] ?? Exterior;
  const aria = label ?? `${kind} illustration`;
  return (
    <svg viewBox="0 0 200 120" className="scene" role="img" aria-label={aria} preserveAspectRatio="xMidYMid slice">
      <Backdrop gid={gid} a={a} b={b} />
      <Part beds={beds} />
    </svg>
  );
}

// A listing photo: the real image if one exists, otherwise a generated illustration.
export function Photo({ listing, index = 0, kind }) {
  const url = listing.photos?.[index];
  if (url) return <img className="scene" src={url} alt={`${listing.address}, photo ${index + 1}`} loading="lazy" />;
  return <Scene kind={kind} id={listing.id} beds={listing.beds} label={`${kind ?? 'exterior'} of ${listing.address}`} />;
}

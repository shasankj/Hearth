import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useTheme } from '../hooks/useTheme.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useFavorites } from '../state/FavoritesContext.jsx';

function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M12 2c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-1-5 1-8z" /></svg>
    </span>
  );
}

const NAV = [['/homes?status=for_sale', 'Buy'], ['/homes?status=for_rent', 'Rent'], ['/homes?status=sold', 'Sold'], ['/market', 'Market']];

function useClickAway(ref, onAway) {
  useEffect(() => {
    const handler = (e) => ref.current && !ref.current.contains(e.target) && onAway();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onAway]);
}

function Menu({ user, onLogout, onPick }) {
  return (
    <div className="menu" role="menu" onClick={onPick}>
      <p className="menu-name">{user.name}<small>{user.email}</small></p>
      <Link role="menuitem" to="/activity">My activity</Link>
      <Link role="menuitem" to="/saved">Saved homes</Link>
      <button type="button" role="menuitem" onClick={onLogout}>Sign out</button>
    </div>
  );
}

function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickAway(ref, () => setOpen(false));
  return (
    <div className="account" ref={ref}>
      <button type="button" className="avatar" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(!open)}>{user.name[0]}</button>
      {open && <Menu user={user} onLogout={onLogout} onPick={() => setOpen(false)} />}
    </div>
  );
}

function Actions({ theme, onToggleTheme }) {
  const { user, status, logout } = useAuth();
  const { ids } = useFavorites();
  return (
    <div className="nav-actions">
      <NavLink to="/saved" className="pill" data-cy="saved-link">♡ <span className="pill-label">Saved</span> <b data-cy="saved-count">{ids.length}</b></NavLink>
      <button type="button" className="icon" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={onToggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
      {status === 'ready' && (user ? <AccountMenu user={user} onLogout={logout} /> : <Link className="btn small" to="/login" data-cy="signin-link">Sign in</Link>)}
    </div>
  );
}

function Header({ theme, onToggleTheme }) {
  return (
    <header className="header">
      <Link className="brand" to="/"><Logo /> Hearth</Link>
      <nav className="nav" aria-label="Main">
        {NAV.map(([to, label]) => <NavLink key={label} to={to}>{label}</NavLink>)}
      </nav>
      <Actions theme={theme} onToggleTheme={onToggleTheme} />
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <p><b>Hearth</b>: a demo real-estate platform. All listings, agents and addresses are fictional; city coordinates are real.</p>
      <p>Built with React, Koa, Go (gRPC), Java, Temporal, Postgres, HAProxy, Kubernetes and Terraform.</p>
    </footer>
  );
}

function OfflineBanner() {
  return useOnlineStatus() ? null : <p role="status" className="offline">You're offline. Showing what we already loaded.</p>;
}

export function Layout() {
  const [theme, toggleTheme] = useTheme();
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <OfflineBanner />
      <main id="main"><Outlet /></main>
      <Footer />
    </>
  );
}

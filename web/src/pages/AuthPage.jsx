import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const message = (err) => err.details?.[0] ? `${err.details[0].field}: ${err.details[0].message}` : err.message;

// After signing in: greet the user and go back to where they came from.
function useWelcome() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const from = useLocation().state?.from ?? '/';
  return (user) => { notify(`Welcome, ${user.name.split(' ')[0]}!`, 'success'); navigate(from, { replace: true }); };
}

function useAuthForm(mode) {
  const { login, register } = useAuth();
  const welcome = useWelcome();
  const [error, setError] = useState(null);
  const submit = (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    (mode === 'register' ? register(body) : login(body)).then(welcome, (err) => setError(message(err)));
  };
  return { error, submit };
}

function Fields({ mode }) {
  return (
    <>
      {mode === 'register' && <label className="field"><span>Full name</span><input name="name" autoComplete="name" required minLength={2} /></label>}
      <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label>
      <label className="field"><span>Password</span><input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 8 : 1} /></label>
    </>
  );
}

export default function AuthPage({ mode }) {
  const { error, submit } = useAuthForm(mode);
  const register = mode === 'register';
  useTitle(register ? 'Create account' : 'Sign in');
  return (
    <section className="auth">
      <h1>{register ? 'Create your account' : 'Welcome back'}</h1>
      <p className="hint">{register ? 'Save homes and searches, book tours and track offers.' : 'Sign in to see your saved homes and offers.'}</p>
      <form onSubmit={submit} className="stack" aria-label={register ? 'Create account' : 'Sign in'}>
        <Fields mode={mode} />
        {error && <p role="alert" className="bad" data-cy="auth-error">{error}</p>}
        <button type="submit" className="btn" data-cy="auth-submit">{register ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="swap">{register ? 'Already have an account?' : 'New to Hearth?'} <Link to={register ? '/login' : '/register'} state={useLocation().state}>{register ? 'Sign in' : 'Create an account'}</Link></p>
    </section>
  );
}

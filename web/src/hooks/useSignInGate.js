import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';

// Returns a click handler: runs `action` if signed in, otherwise sends the visitor to /login and back here.
export function useSignInGate(action) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return () => (user ? action() : navigate('/login', { state: { from: pathname + search } }));
}

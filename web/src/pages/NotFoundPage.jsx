import { Link } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle.js';

export default function NotFoundPage() {
  useTitle('Page not found');
  return (
    <div className="state" data-cy="not-found">
      <div className="state-art" aria-hidden="true">404</div>
      <h1>We couldn't find that page</h1>
      <p>The home may have been removed, or the link is wrong.</p>
      <Link className="btn" to="/homes">Browse homes</Link>
    </div>
  );
}

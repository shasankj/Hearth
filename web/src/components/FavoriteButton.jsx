import { useFavorites } from '../state/FavoritesContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

export function FavoriteButton({ id, className = '' }) {
  const { ids, toggle } = useFavorites();
  const { notify } = useToast();
  const saved = ids.includes(id);
  const click = () => { toggle(id); notify(saved ? 'Removed from saved homes' : 'Saved to your homes'); };
  return (
    <button type="button" data-cy="fav" className={`icon fav ${saved ? 'on' : ''} ${className}`} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save home'} onClick={click}>
      {saved ? '♥' : '♡'}
    </button>
  );
}

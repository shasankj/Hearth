import { useSyncExternalStore } from 'react';

function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

// useSyncExternalStore = the correct way to read browser state that lives outside React.
export const useOnlineStatus = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

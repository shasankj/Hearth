import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Layout } from './components/Layout.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { Spinner } from './components/States.jsx';
import { AuthProvider } from './state/AuthContext.jsx';
import { FavoritesProvider } from './state/FavoritesContext.jsx';
import { ToastProvider } from './state/ToastContext.jsx';

// Code-splitting per page: the map library (Leaflet) only downloads when a page that needs it opens.
const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'));
const ListingPage = lazy(() => import('./pages/ListingPage.jsx'));
const SavedPage = lazy(() => import('./pages/SavedPage.jsx'));
const ActivityPage = lazy(() => import('./pages/ActivityPage.jsx'));
const MarketPage = lazy(() => import('./pages/MarketPage.jsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

const page = (element) => <Suspense fallback={<Spinner />}>{element}</Suspense>;

const publicRoutes = () => (
  <>
    <Route index element={page(<HomePage />)} />
    <Route path="homes" element={page(<SearchPage />)} />
    <Route path="homes/:id" element={page(<ListingPage />)} />
    <Route path="saved" element={page(<SavedPage />)} />
    <Route path="market" element={page(<MarketPage />)} />
  </>
);

const accountRoutes = () => (
  <>
    <Route path="activity" element={<RequireAuth>{page(<ActivityPage />)}</RequireAuth>} />
    <Route path="login" element={page(<AuthPage mode="login" />)} />
    <Route path="register" element={page(<AuthPage mode="register" />)} />
    <Route path="*" element={page(<NotFoundPage />)} />
  </>
);

const AppRoutes = () => <Routes><Route element={<Layout />}>{publicRoutes()}{accountRoutes()}</Route></Routes>;

// Provider order matters: toasts, then auth, then favorites (which needs both).
function Providers({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <FavoritesProvider>{children}</FavoritesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export const App = () => <ErrorBoundary><Providers><AppRoutes /></Providers></ErrorBoundary>;

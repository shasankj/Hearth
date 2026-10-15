# React and Cypress

## React core
- **UI = f(state).** Components are functions returning JSX; React re-renders when state/props change and **reconciles** (diffs the virtual tree) to update the DOM minimally.
- **Hooks rules:** call only at top level, only in components/custom hooks (React tracks them by call order).
  - `useState` local state; update with the setter (state is immutable: create new objects/arrays).
  - `useEffect(fn, deps)` side effects after render; **return a cleanup**; deps array controls re-run. Don't use it for derived data (compute during render).
  - `useRef` mutable box that doesn't trigger render (DOM nodes, timers). `useMemo/useCallback` cache values/functions; only when profiling shows need or to keep referential equality for memoized children/deps.
  - `useContext` for app-wide values (theme, auth), not for fast-changing state.
  - `useReducer` for complex state transitions.
- **Keys:** stable identity for list items (`key={listing.id}`), never array index for reorderable lists, so React preserves component state correctly.
- **Controlled inputs:** value comes from state (`SearchForm`); the source of truth is React.
- **Lifting state up:** shared state lives in the nearest common parent (`App` holds `filters`).

## Advanced React
- **Rendering:** a parent re-render re-renders children unless `React.memo`. Re-renders are cheap; avoid premature optimization. Measure with React Profiler.
- **Concurrent features (18+):** `useTransition`/`useDeferredValue` keep the UI responsive during heavy updates; **Suspense** for loading boundaries; automatic batching of state updates.
- **React 19:** `use()` for promises/context, Actions (`useActionState`, `useFormStatus`), `ref` as a prop, ref cleanup, Server Components in frameworks (Next.js).
- **Server state vs client state:** server data (listings) is a cache problem: use TanStack Query/SWR for caching, dedup, retries, background refresh. UI state stays in React. Our hand-written `useListings` shows the underlying mechanics.
- **Race conditions in effects:** fast typing can cause out-of-order responses. Use `AbortController` (what we do) or an `ignore` flag.
- **Performance:** code-splitting (`lazy`), list virtualization, avoid creating new object props in hot paths, image optimization, memoize expensive computations, debounce inputs.
- **Accessibility:** semantic HTML, labels (`aria-label`), keyboard nav, roles (`role="alert"` for errors). Cypress queries by label/role encourage this.
- **Error boundaries** (class components or library) catch render errors. **Testing:** React Testing Library for components (behavior over implementation), Cypress/Playwright for E2E.

## The app and where each React concept appears ([web/src](../web/src))
Run: `docker compose up -d`, then `cd web && npx vite --port 5173` → http://localhost:5173. The Vite dev server proxies `/api` and `/inspections` to HAProxy on `:8080` (a wrong port here was the earlier 502).

**Structure:** `pages/` (route components, lazy-loaded), `components/` (small UI pieces), `hooks/` (reusable logic), `state/` (contexts), `lib/` (pure functions: formatting, mortgage math, filters), `api.js` (the only file that calls `fetch`).

| Feature (UX) | React concept | File |
|---|---|---|
| Pages, deep links, Back button | **React Router**: nested routes, `Outlet`, `NavLink`, `useParams`, route guard (`RequireAuth`), `React.lazy` per page | [App.jsx](../web/src/App.jsx), [RequireAuth.jsx](../web/src/components/RequireAuth.jsx) |
| Filters shareable by URL | **URL as state**: `useSearchParams` + pure parse/serialize functions; `useMemo` for the parsed filters | [hooks/useSearchFilters.js](../web/src/hooks/useSearchFilters.js), [lib/filters.js](../web/src/lib/filters.js) |
| Results with "load more" + infinite scroll | `useReducer` state machine; **adjust-state-during-render** when the query changes; `AbortController` cleanup; **IntersectionObserver** hook | [hooks/useInfiniteListings.js](../web/src/hooks/useInfiniteListings.js), [useOnVisible.js](../web/src/hooks/useOnVisible.js) |
| Typeahead suggestions | debounced effect + abort; `useId` for ARIA ids; combobox roles | [components/SearchBar.jsx](../web/src/components/SearchBar.jsx), [useDebounce.js](../web/src/hooks/useDebounce.js) |
| Map with price pins, "Search this area" | third-party imperative library wrapped in components; refs to tell programmatic vs user moves; `useMapEvents` | [components/MapView.jsx](../web/src/components/MapView.jsx) |
| Saved homes (local or server) | **Context**; custom hooks for sync; **optimistic update with rollback**; merge local → server on sign-in | [state/FavoritesContext.jsx](../web/src/state/FavoritesContext.jsx) |
| Sign-in state | Context + `useMemo`'d value; `status: loading/ready` to avoid flashing the wrong UI | [state/AuthContext.jsx](../web/src/state/AuthContext.jsx) |
| Cards don't re-render needlessly | **`React.memo`** + stable callbacks (`useCallback`, ref-held state) | [components/ListingCard.jsx](../web/src/components/ListingCard.jsx), [hooks/useCompare.js](../web/src/hooks/useCompare.js) |
| Dialogs (offer, compare, filters, lightbox) | **Portal**, focus trap, Esc, scroll lock, focus restore, **`useEffectEvent`** | [components/Dialog.jsx](../web/src/components/Dialog.jsx), [hooks/useDialogBehavior.js](../web/src/hooks/useDialogBehavior.js) |
| Book a tour / message the agent | **React 19 form actions**: `useActionState`, `useFormStatus`, uncontrolled forms with `defaultValue` | [components/TourForm.jsx](../web/src/components/TourForm.jsx), [InquiryForm.jsx](../web/src/components/InquiryForm.jsx) |
| Offer wizard | multi-step `useReducer` draft; a step component chosen by index; submit state in a hook | [components/OfferDialog.jsx](../web/src/components/OfferDialog.jsx) |
| Live offer timeline | polling effect with cleanup; data from Temporal via the BFF | [pages/ActivityPage.jsx](../web/src/pages/ActivityPage.jsx) |
| Mortgage + affordability calculators | `useReducer` + `useMemo`; pure math in `lib/mortgage.js` (unit-testable) | [components/MortgageCalc.jsx](../web/src/components/MortgageCalc.jsx), [pages/MarketPage.jsx](../web/src/pages/MarketPage.jsx) |
| Price-history chart, bar charts | hand-written **SVG** from data (`plot()` is a pure function) | [components/PriceChart.jsx](../web/src/components/PriceChart.jsx) |
| Photo gallery + lightbox | state lifting, keyboard handlers with cleanup, generated SVG scenes (`useId` for unique gradient ids) | [components/Gallery.jsx](../web/src/components/Gallery.jsx), [Scenes.jsx](../web/src/components/Scenes.jsx) |
| Theme, offline banner, hotkey, recent homes | `useLocalStorage` (lazy init), **`useSyncExternalStore`**, `useRef` + global listener, small custom hooks | [hooks/](../web/src/hooks) |
| Crash screen instead of white page | **Error boundary** (class) | [components/ErrorBoundary.jsx](../web/src/components/ErrorBoundary.jsx) |
| Loading / error / empty / data states | early returns, skeletons, retry | [components/States.jsx](../web/src/components/States.jsx), [ResultsList.jsx](../web/src/components/ResultsList.jsx) |

**UX details worth naming:** skeletons (no layout jump), optimistic favorites, toasts, shareable URLs, sticky sidebar filters, split list/map, hover-to-highlight pins, price-drop / new / open-house badges, "below market median" signals, estimated monthly cost on every card, keyboard shortcut, `aria-pressed` toggles, labelled inputs, `role="dialog" aria-modal`, `role="alert"` errors, skip link, reduced-motion support, dark mode, mobile layout (filters become a dialog).

**Design decisions to explain**
- The **server does the filtering and sorting** (SQL), the browser only renders: the dataset can grow without shipping it to the client. Pagination is offset-based ("load more"); at large scale use keyset pagination.
- **Filters live in the URL**, not in component state: links are shareable, Back works, refresh keeps context.
- **One `fetch` module** and **one `useFetch` hook** keep data loading consistent (cancellation, loading, error, reload).
- **Generated illustrations** stand in for photos; `<Photo>` shows real URLs when `photos[]` is populated.
- **Every function ≤ 10 lines** (enforced), so components are tiny and hooks are split (`useWizard`, `useSubmit`, `useTypeahead`, `useTrackView`...).

## Cypress
- **What:** E2E/component test runner that runs **inside the browser** next to your app (not remote-controlling over WebDriver) → fast, access to network and DOM, automatic waiting, time-travel debugging, screenshots/videos.
- **Commands are queued and asynchronous but not Promises**: don't `await cy.get()`; chain with `.then()`/`.should()`. **Retry-ability:** `cy.get(...).should(...)` retries until it passes or times out (default 4 s), eliminating most `sleep`s. Actions (`click`) are not retried; assertions are.
- **`cy.intercept`** stubs or spies on network: `cy.intercept('GET','/api/listings*',{listings:[L1]})`. Gives deterministic, fast tests and lets you test error states (503) that are hard to force for real.
- **Selectors:** prefer `data-cy`/`data-testid` or accessible queries over CSS classes. Avoid `cy.wait(1000)`; wait on aliases (`cy.wait('@boston')`).
- **Isolation:** each test starts clean (cookies/localStorage cleared); seed state via API (`cy.request`) not UI; log in once with `cy.session`.
- **Cypress vs Playwright vs Selenium:** Cypress: great DX, JS only, single tab/origin limits historically; Playwright: multi-browser/multi-tab/multi-language, parallel built in; Selenium: broad but slower, flakier.
- **Flaky tests:** causes = hard-coded waits, shared state, real network, animations, order dependence. Fix with intercepts, retries only as last resort, test isolation.
- **CI:** `cypress run` headless, record/parallelize (`--parallel` via Cypress Cloud) or split specs across containers (CircleCI `parallelism`).

### The Cypress suites ([web/cypress/e2e](../web/cypress/e2e))
- **[browse.cy.js](../web/cypress/e2e/browse.cy.js)** (network stubbed): hero search → URL; cards with price-drop/open-house badges; filters in the URL and sent to the API; shareable links restore filters; Buy/Rent/Sold tabs; list/map toggle; infinite "Load more"; error → Try again; empty state; saved homes persist; compare dialog; listing page (facts, price chart, similar homes); lightbox with arrow keys; mortgage payment drops with a larger down payment; tour 409/201; message agent; 404 page.
- **[account.cy.js](../web/cypress/e2e/account.cy.js)** (stubbed): protected route redirect and return; wrong password message; field-level validation errors; 3-step offer wizard and its payload; workflow timeline + approve button; server-side favorites.
- **[real-stack.cy.js](../web/cypress/e2e/real-stack.cy.js)** (**no stubs**, needs `docker compose up -d`): seeded search from Postgres, full-text search and detail page, market page, and a complete journey: register → favorite (survives reload, so it came from the server) → book a tour → real **409** on the same date (Java + Postgres UNIQUE) → make an offer → Temporal workflow reaches *awaiting financing* → approve → timeline reaches *closed*.

Lessons: React controlled number inputs need `value={n || ''}` so clearing doesn't snap to "0"; `cy.wait('@alias')` matches the *first* request, so match on the query instead; slow CI machines need generous timeouts for real-stack specs; stub map tiles (external network) for speed.

**Gotcha:** VS Code terminals set `ELECTRON_RUN_AS_NODE=1`, making Cypress print "bad option: --no-sandbox". `unset ELECTRON_RUN_AS_NODE`.

## Interview Q&A
**Q: What happens on `setState`?** React schedules a re-render (batched), calls the component again, diffs the output with the previous tree, and commits DOM changes; effects run after commit.

**Q: Why the cleanup function in `useEffect`?** To undo subscriptions/timers/requests from the previous run before the next run or unmount; prevents leaks and stale-response races.

**Q: `useMemo` vs `useCallback`?** `useMemo` caches a computed value; `useCallback` caches a function identity (= `useMemo(() => fn)`). Use when passing to memoized children or dependency arrays.

**Q: How do you avoid unnecessary renders?** Keep state close to where it's used, split components, `React.memo`, stable props, selectors in state libraries; but profile first.

**Q: How would you handle global state?** Server data: TanStack Query. UI/global client state: Context for rarely-changing values, Zustand/Redux Toolkit for complex shared state.

**Q: How do you test React?** Unit/component with RTL (user-centric queries), E2E with Cypress for critical flows, network stubbed for determinism plus a few real-backend smoke tests.

**Q: CSR vs SSR vs SSG?** CSR renders in browser (what we built); SSR renders HTML per request (SEO, first paint) e.g. Next.js; SSG prebuilds pages. A real-estate listing site needs SEO → SSR/SSG for listing pages.

**Q: How do you make a search box efficient?** Debounce input, cancel stale requests (AbortController), cache results, show loading/empty/error states, paginate.

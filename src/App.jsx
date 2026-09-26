// src/App.jsx
// SENTINEL: NB_PULSE_APP_V2
//
// THE SPLIT, 2026-08-26
// Every page except Login is React.lazy behind one quiet Suspense fallback,
// the same decision the studio made in its App.jsx and for the same reason.
// Before this the whole tool shipped as one 1.2MB chunk, so signing in on a
// phone downloaded the invoice editor, the charts library and every page you
// were not opening. Login stays eager because it is the first paint of every
// cold visit and lazy loading the door just adds a spinner in front of it.
//
// The fallback is a bare cream box, no spinner. A route chunk loads in well
// under a second on anything and a spinner that flashes for 200ms reads as
// jank, an empty mat reads as the page settling. Vendor chunks are grouped
// in vite.config.js, read the chunk table on every build.
//
// No oxford commas, no em dashes.

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import { AuthProvider } from './hooks/useAuth';
import { PresenceProvider } from './hooks/usePresence';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppShell from './components/Layout/AppShell';
import colors from './theme/colors';

// The door stays eager.
import Login from './pages/Auth/Login';

// Public, lazy.
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));
const AcceptInvite  = lazy(() => import('./pages/Auth/AcceptInvite'));
const PinApproval   = lazy(() => import('./pages/PinApproval'));

// Protected, lazy.
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Clients       = lazy(() => import('./pages/Clients'));
const ClientDetail  = lazy(() => import('./pages/Clients/ClientDetail'));
const Invoicing     = lazy(() => import('./pages/Invoicing'));
const Orders        = lazy(() => import('./pages/Orders'));
const Forms         = lazy(() => import('./pages/Forms'));
const Blog          = lazy(() => import('./pages/Blog'));
const PostEditor    = lazy(() => import('./pages/Blog/PostEditor'));
const Yard          = lazy(() => import('./pages/Yard'));
const Neonburro     = lazy(() => import('./pages/Neonburro'));
const Registry      = lazy(() => import('./pages/Registry'));
const Wallets       = lazy(() => import('./pages/Wallets'));
const Messages      = lazy(() => import('./pages/Messages'));
const Calendar      = lazy(() => import('./pages/Calendar'));
const Socials       = lazy(() => import('./pages/Releases'));
const Analytics     = lazy(() => import('./pages/Analytics'));
const Settings      = lazy(() => import('./pages/Settings'));

const Quiet = () => <Box minH="100vh" bg={colors.paper.mat} />;

const PresenceWrappedShell = () => (
  <PresenceProvider>
    <AppShell>
      <Outlet />
    </AppShell>
  </PresenceProvider>
);

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Quiet />}>
        <Routes>
          {/* Public */}
          <Route path="/login/" element={<Login />} />
          <Route path="/reset-password/" element={<ResetPassword />} />
          <Route path="/accept-invite/" element={<AcceptInvite />} />
          <Route path="/pin-approval/" element={<PinApproval />} />
          <Route path="/pin-approval" element={<PinApproval />} />

          {/* Protected admin routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<PresenceWrappedShell />}>
              {/* Today is the canonical landing page. /dashboard/ still resolves
                  so bookmarks, old emails and anything already sent keep working. */}
              <Route index element={<Navigate to="/today/" replace />} />
              <Route path="today/" element={<Dashboard />} />
              <Route path="dashboard/" element={<Navigate to="/today/" replace />} />
              <Route path="clients/" element={<Clients />} />
              <Route path="clients/:clientId/" element={<ClientDetail />} />
              <Route path="invoicing/" element={<Invoicing />} />
              <Route path="orders/" element={<Orders />} />
              <Route path="forms/" element={<Forms />} />
              <Route path="blog/" element={<Blog />} />
              <Route path="blog/new/" element={<PostEditor />} />
              <Route path="blog/:postId/" element={<PostEditor />} />
              <Route path="yard/" element={<Yard />} />
              <Route path="neonburro/" element={<Neonburro />} />
              <Route path="registry/" element={<Registry />} />
              <Route path="wallets/" element={<Wallets />} />
              <Route path="messages/" element={<Messages />} />
              <Route path="calendar/" element={<Calendar />} />
              <Route path="socials/" element={<Socials />} />
              <Route path="releases/" element={<Navigate to="/socials/" replace />} />
              <Route path="analytics/" element={<Analytics />} />
              <Route path="settings/" element={<Settings />} />
              {/* Projects redirect to clients, the source of truth now. */}
              <Route path="projects/" element={<Navigate to="/clients/" replace />} />
              <Route path="projects/*" element={<Navigate to="/clients/" replace />} />
              <Route path="*" element={<Navigate to="/today/" replace />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;

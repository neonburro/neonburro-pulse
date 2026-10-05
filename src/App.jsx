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
// A route here and an entry in src/lib/nav.js are two edits for one page and
// they have to match. The nav file is the list people see, this file is the
// list the router honours, and a page in one and not the other is either
// unreachable or invisible.
//
// MAIL, 2026-10-05. /mail/ is the room and /mail/:mailId/ is one letter.
// The editor is its own lazy chunk so the list opens without the field kit.
// /mail/clients/:clientId/ is one client's mail, the demo mount for the
// three client parts until Volt's one page ClientDetail imports them.
// /answer/:token/ is public, above the protected block, the page a client
// lands on from an approve or deny link beside an open item. It reads by
// token through netlify/functions/item-answer.js and answers on a press.
// /__review/mail/ and /__review/mail/room/ are development only fixtures,
// stripped from production by the same import.meta.env.DEV guard as the
// brand kit fixture. They mount the editor and the room on sample letters
// that read and write nothing.
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
const Answer        = lazy(() => import('./pages/Answer'));

// Protected, lazy.
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Clients       = lazy(() => import('./pages/Clients'));
const ClientDetail  = lazy(() => import('./pages/Clients/ClientDetail'));
const Invoicing     = lazy(() => import('./pages/Invoicing'));
const Orders        = lazy(() => import('./pages/Orders'));
const Payouts       = lazy(() => import('./pages/Payouts'));
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
const Reports       = lazy(() => import('./pages/Reports'));
const Mail          = lazy(() => import('./pages/Mail'));
const MailEditor    = lazy(() => import('./pages/Mail/MailEditor'));
const MailClient    = lazy(() => import('./pages/Mail/MailClient'));
const Settings      = lazy(() => import('./pages/Settings'));
// These routes are stripped from production. They let a reviewer inspect a
// desk at real widths without fabricating a row or signing in.
const BrandKitReviewFixture = import.meta.env.DEV
  ? lazy(() => import('./pages/Orders/BrandKitReviewFixture'))
  : null;
const MailFixture = import.meta.env.DEV
  ? lazy(() => import('./pages/Mail/MailFixture'))
  : null;

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
          <Route path="/answer/:token/" element={<Answer />} />
          {BrandKitReviewFixture && (
            <Route path="/__review/custom-brand-kit/" element={<BrandKitReviewFixture />} />
          )}
          {MailFixture && (
            <Route path="/__review/mail/" element={<MailFixture />} />
          )}
          {MailFixture && (
            <Route path="/__review/mail/room/" element={<MailFixture view="room" />} />
          )}
          {MailFixture && (
            <Route path="/__review/answer/" element={<MailFixture view="answer" />} />
          )}
          {MailFixture && (
            <Route path="/__review/mail/client/" element={<MailFixture view="client" />} />
          )}

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
              <Route path="payouts/" element={<Payouts />} />
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
              <Route path="reports/" element={<Reports />} />
              <Route path="mail/" element={<Mail />} />
              <Route path="mail/clients/:clientId/" element={<MailClient />} />
              <Route path="mail/:mailId/" element={<MailEditor />} />
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

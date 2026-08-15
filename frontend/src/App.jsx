import { Routes, Route, Navigate } from 'react-router-dom';
import { ROLES } from './lib/constants.js';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { useAuth, homeFor } from './auth/AuthProvider.jsx';
import { PlatformLayout } from './layouts/PlatformLayout.jsx';
import { OrgLayout } from './layouts/OrgLayout.jsx';
import { MemberLayout } from './layouts/MemberLayout.jsx';

import { Landing } from './pages/public/Landing.jsx';
import { Signup } from './pages/public/Signup.jsx';
import { Login } from './pages/public/Login.jsx';
import { ForgotPassword } from './pages/public/ForgotPassword.jsx';
import { ResetPassword } from './pages/public/ResetPassword.jsx';
import { AcceptInvite } from './pages/public/AcceptInvite.jsx';
import { CheckoutSuccess } from './pages/public/CheckoutSuccess.jsx';
import { CheckoutCancelled } from './pages/public/CheckoutCancelled.jsx';

import { OrgDashboard } from './pages/org/Dashboard.jsx';
import { OrgProfile } from './pages/org/Profile.jsx';
import { Members } from './pages/org/Members.jsx';
import { Subscription } from './pages/org/Subscription.jsx';
import { Billing } from './pages/org/Billing.jsx';
import { OrgTransactions } from './pages/org/Transactions.jsx';

import { MemberProfile } from './pages/member/Profile.jsx';
import { MemberOrgInfo } from './pages/member/OrgInfo.jsx';

import { Overview } from './pages/platform/Overview.jsx';
import { Orgs } from './pages/platform/Orgs.jsx';
import { OrgDetail } from './pages/platform/OrgDetail.jsx';
import { Plans } from './pages/platform/Plans.jsx';
import { PlatformTransactions } from './pages/platform/Transactions.jsx';

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  return user ? <Navigate to={homeFor(user.role)} replace /> : <Landing />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/checkout/success" element={<CheckoutSuccess />} />
      <Route path="/checkout/cancelled" element={<CheckoutCancelled />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute allow={[ROLES.ORG_ADMIN]}>
            <OrgLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OrgDashboard />} />
        <Route path="profile" element={<OrgProfile />} />
        <Route path="members" element={<Members />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="billing" element={<Billing />} />
        <Route path="transactions" element={<OrgTransactions />} />
      </Route>

      <Route
        path="/member"
        element={
          <ProtectedRoute allow={[ROLES.ORG_MEMBER]}>
            <MemberLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MemberProfile />} />
        <Route path="org" element={<MemberOrgInfo />} />
      </Route>

      <Route
        path="/platform"
        element={
          <ProtectedRoute allow={[ROLES.PLATFORM_ADMIN]}>
            <PlatformLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="orgs" element={<Orgs />} />
        <Route path="orgs/:orgId" element={<OrgDetail />} />
        <Route path="plans" element={<Plans />} />
        <Route path="transactions" element={<PlatformTransactions />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

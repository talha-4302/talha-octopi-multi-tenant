import { Shell } from './Shell.jsx';

// Deliberately two items. A member has no members page, no billing,
// no subscription, and no transactions.
export const MemberLayout = () => (
  <Shell
    title="Your account"
    nav={[
      { to: '/member', label: 'Profile', end: true },
      { to: '/member/org', label: 'Organization' },
    ]}
  />
);

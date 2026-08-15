import { Shell } from './Shell.jsx';

export const OrgLayout = () => (
  <Shell
    title="Your organization"
    nav={[
      { to: '/app', label: 'Dashboard', end: true },
      { to: '/app/profile', label: 'Profile' },
      { to: '/app/members', label: 'Members' },
      { to: '/app/subscription', label: 'Subscription' },
      { to: '/app/billing', label: 'Billing' },
      { to: '/app/transactions', label: 'Transactions' },
    ]}
  />
);

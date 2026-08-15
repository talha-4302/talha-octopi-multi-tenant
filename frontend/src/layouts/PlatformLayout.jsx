import { Shell } from './Shell.jsx';

export const PlatformLayout = () => (
  <Shell
    title="Platform Admin"
    nav={[
      { to: '/platform', label: 'Overview', end: true },
      { to: '/platform/orgs', label: 'Organizations' },
      { to: '/platform/plans', label: 'Plans' },
      { to: '/platform/transactions', label: 'Transactions' },
    ]}
  />
);

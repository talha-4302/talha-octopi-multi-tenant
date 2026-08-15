import { Badge } from './ui/badge.jsx';

// The ONE place a status maps to a colour. Every table and panel uses this,
// so a status never renders two different ways in two places.
const TONE = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  SUCCESS: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  INVITED: 'bg-amber-100 text-amber-800',
  TRIAL: 'bg-sky-100 text-sky-800',
  FAILED: 'bg-rose-100 text-rose-800',
  SUSPENDED: 'bg-rose-100 text-rose-800',
  CANCELLED: 'bg-slate-200 text-slate-700',
  EXPIRED: 'bg-slate-200 text-slate-700',
  REMOVED: 'bg-slate-200 text-slate-700',
  REFUNDED: 'bg-violet-100 text-violet-800',
  ROLLED_BACK: 'bg-orange-100 text-orange-800',
};

export const StatusBadge = ({ status }) => (
  <Badge className={`${TONE[status] ?? 'bg-slate-100 text-slate-700'} font-medium`} variant="secondary">
    {String(status).replace('_', ' ').toLowerCase()}
  </Badge>
);

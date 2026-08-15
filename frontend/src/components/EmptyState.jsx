export const EmptyState = ({ title, hint, action }) => (
  <div className="rounded-lg border border-dashed bg-white px-6 py-12 text-center">
    <p className="font-medium text-slate-700">{title}</p>
    {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

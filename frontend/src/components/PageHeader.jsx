export const PageHeader = ({ title, description, action }) => (
  <div className="mb-6 flex items-start justify-between gap-4">
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
    {action}
  </div>
);

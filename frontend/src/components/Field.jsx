import { Label } from './ui/label.jsx';
import { Input } from './ui/input.jsx';

// Renders the field level error the API returns in error.fields, so a 400
// highlights the offending input instead of showing a banner.
export const Field = ({ label, name, error, ...props }) => (
  <div className="space-y-1.5">
    <Label htmlFor={name}>{label}</Label>
    <Input id={name} name={name} aria-invalid={!!error} {...props} />
    {error && <p className="text-sm text-rose-600">{error}</p>}
  </div>
);

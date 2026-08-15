import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './AuthProvider.jsx';

export function ProtectedRoute({ allow, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // Hiding a route is not access control. The server refuses these calls too;
  // this only stops a user landing on a panel that would 403 every request.
  if (allow && !allow.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;

  return children;
}

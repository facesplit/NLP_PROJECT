import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "superadmin") return <Navigate to="/admin/users" replace />;
  if (user.role === "floristadmin") return <Navigate to="/florist/points" replace />;
  return <Navigate to="/search" replace />;
}

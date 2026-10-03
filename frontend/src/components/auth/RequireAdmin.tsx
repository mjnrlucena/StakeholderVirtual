import { Navigate, Outlet } from "react-router-dom";
import { isProfessor, isStaff } from "@/lib/roles";
import { useAuthStore } from "@/store/useAuthStore";

/** Hub: professor, gestor e superadmin. */
export function RequireAdmin() {
  const user = useAuthStore((s) => s.user);
  if (!isStaff(user?.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** Dashboard de logs: professor e superadmin (gestor não entra). */
export function RequireProfessor() {
  const user = useAuthStore((s) => s.user);
  if (!isProfessor(user?.role)) {
    return <Navigate to="/admin" replace />;
  }
  return <Outlet />;
}

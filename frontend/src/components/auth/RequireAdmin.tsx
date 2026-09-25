import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

export function RequireAdmin() {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== "ADMIN" && user?.role !== "SUPERADMIN") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

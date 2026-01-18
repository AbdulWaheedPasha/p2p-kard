import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../state/authStore.js";

export default function RequireAuth() {
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!isAuthed || !token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

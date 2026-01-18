import { Outlet } from "react-router-dom";
import Topbar from "./Topbar.jsx";

export default function AppShell() {
  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
        <Outlet />
      </main>
    </div>
  );
}

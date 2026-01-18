import React from "react";
import { NavLink } from "react-router-dom";

function LinkItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-xl px-3 py-2 text-base transition ${
          isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function SideNav() {
  return (
    <aside className="w-72 shrink-0">
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="px-3 pb-2 text-xs font-semibold text-slate-500">Navigation</div>

        <div className="space-y-1">
          <LinkItem to="/app/home">Home</LinkItem>
          <LinkItem to="/app/lender">My Dashboard</LinkItem>
        </div>

        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          Thank you for being kind and responsible. Your support helps people with dignity.
        </div>
      </div>
    </aside>
  );
}

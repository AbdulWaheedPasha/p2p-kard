import React from "react";

const styles = {
  base:
    "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-300",
  primary:
    "text-white shadow-[0_12px_30px_rgba(16,185,129,0.25)] " +
    "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-emerald-600",
  outline:
    "border border-slate-200 bg-white/70 text-slate-800 hover:bg-white",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100/80",
};

export default function Button({ variant = "primary", className = "", ...props }) {
  const v = styles[variant] ?? styles.primary;
  return <button className={`${styles.base} ${v} ${className}`} {...props} />;
}

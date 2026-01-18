import React from "react";

export default function Input({ label, hint, error, ...props }) {
  return (
    <label className="block">
      {label && <div className="mb-2 text-sm font-semibold text-slate-800">{label}</div>}
      <input
        className={`w-full rounded-2xl border px-4 py-3 text-base bg-white/80 backdrop-blur
        outline-none transition focus:ring-2 focus:ring-emerald-200 ${
          error ? "border-red-300" : "border-slate-200"
        }`}
        {...props}
      />
      {hint && !error && <div className="mt-2 text-sm text-slate-500">{hint}</div>}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </label>
  );
}

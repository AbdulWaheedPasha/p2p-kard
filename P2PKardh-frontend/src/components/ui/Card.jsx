import React from "react";

export default function Card({ title, subtitle, children, footer }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-[0_18px_55px_rgba(2,6,23,0.10)] backdrop-blur">
      {(title || subtitle) && (
        <div className="mb-5">
          {title && <div className="text-xl font-semibold tracking-tight">{title}</div>}
          {subtitle && <div className="mt-2 text-base text-slate-600">{subtitle}</div>}
        </div>
      )}
      <div>{children}</div>
      {footer && <div className="mt-6 border-t border-slate-200/70 pt-6">{footer}</div>}
    </div>
  );
}

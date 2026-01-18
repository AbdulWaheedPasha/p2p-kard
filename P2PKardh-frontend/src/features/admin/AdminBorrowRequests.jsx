import React from "react";
import { useNavigate } from "react-router-dom";
import { adminBorrowRequestsApi } from "../../api/endpoints.js";
import { Page } from "../../components/ui/Motion.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";

export default function AdminBorrowRequests() {
  const nav = useNavigate();
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState([]);
  const [error, setError] = React.useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      // IMPORTANT: backend expects query params (?status=)
      const data = await adminBorrowRequestsApi(status ? { status } : {});
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      setError("Sorry — we couldn’t load requests. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <Page>
      <div className="space-y-5">
        <div className="rounded-3xl border bg-white/80 p-6 shadow backdrop-blur">
          <div className="text-2xl font-semibold">Admin • Borrow requests</div>
          <div className="mt-2 text-slate-600">
            Please review documents carefully. Kindly verify or reject with a clear internal note.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["", "SUBMITTED", "VERIFIED", "REJECTED", "CAMPAIGN_CREATED"].map((s) => (
              <button
                key={s || "ALL"}
                onClick={() => setStatus(s)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold border transition ${
                  status === s ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
                }`}
              >
                {s ? s.replaceAll("_", " ") : "All"}
              </button>
            ))}
            <div className="flex-1" />
            <Button variant="outline" onClick={load}>
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card title="Requests" subtitle="Click any request to open details.">
          {loading ? (
            <div className="text-slate-600">Loading…</div>
          ) : rows.length ? (
            <div className="grid gap-3">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => nav(`/app/admin/requests/${r.id}`)}
                  className="rounded-2xl border p-4 text-left hover:bg-slate-50 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-base font-semibold">{r.title}</div>
                    <div className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {r.status}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    €{Math.round((r.amount_requested_cents ?? 0) / 100)} • {r.category} • {r.expected_return_days} days
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{r.requester_email}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-slate-600">No requests found.</div>
          )}
        </Card>
      </div>
    </Page>
  );
}

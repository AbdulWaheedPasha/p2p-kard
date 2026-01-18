import React from "react";
import { useLocation } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import { Page } from "../../components/ui/Motion.jsx";
import { dashboardApi } from "../../api/endpoints.js";

function Pill({ children, tone = "neutral" }) {
  const map = {
    neutral: "bg-slate-100 text-slate-700",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-800",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

export default function LenderDashboard() {
  const location = useLocation();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState(null);

  const paymentSuccess = new URLSearchParams(location.search).get("payment") === "success";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await dashboardApi();
      setData(res);
    } catch (e) {
      setError("Sorry — we couldn’t load your dashboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const supportSummary = data?.support_summary && typeof data.support_summary === "object" ? data.support_summary : {};
  const supportByCampaign = Array.isArray(data?.support_by_campaign) ? data.support_by_campaign : [];
  const borrowRequests = Array.isArray(data?.borrow_requests) ? data.borrow_requests : [];

  return (
    <Page>
      <div className="space-y-6">
        {paymentSuccess && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Thank you. We’re confirming your support and updating your dashboard.
          </div>
        )}

        <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-[0_18px_55px_rgba(2,6,23,0.10)] backdrop-blur">
          <div className="text-2xl font-semibold">My Dashboard</div>
          <div className="mt-2 text-slate-600">
            A clear view of your support, requests, and recovery status.
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border bg-white/80 p-6">
                <div className="text-sm text-slate-600">Total supported</div>
                <div className="mt-2 text-3xl font-semibold">
                  {supportSummary.total_supported_cents != null ? `€${(supportSummary.total_supported_cents / 100).toFixed(0)}` : "—"}
                </div>
              </div>

              <div className="rounded-3xl border bg-white/80 p-6">
                <div className="text-sm text-slate-600">Active (running)</div>
                <div className="mt-2 text-3xl font-semibold">
                  {supportSummary.active_supported_cents != null ? `€${(supportSummary.active_supported_cents / 100).toFixed(0)}` : "—"}
                </div>
              </div>

              <div className="rounded-3xl border bg-white/80 p-6">
                <div className="text-sm text-slate-600">Returned</div>
                <div className="mt-2 text-3xl font-semibold">
                  {supportSummary.returned_cents != null ? `€${(supportSummary.returned_cents / 100).toFixed(0)}` : "—"}
                </div>
              </div>
            </div>

            <Card title="My support (per campaign)" subtitle="Your contributions and expected return timeline.">
              <div className="space-y-3">
                {supportByCampaign.map((x) => (
                  <div key={`${x.campaign_id}-${x.amount_cents}`} className="rounded-3xl border p-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold break-words">{x.campaign_title}</div>
                      <div className="mt-1 text-sm text-slate-600">Contribution: €{(x.amount_cents / 100).toFixed(0)}</div>
                      <div className="mt-1 text-sm text-slate-600">Expected: {x.expected_return_date ?? "—"}</div>
                    </div>

                    <Pill tone={x.contribution_status === "RETURNED" ? "good" : "warn"}>
                      {x.contribution_status}
                    </Pill>
                  </div>
                ))}
                {!supportByCampaign.length && <div className="text-slate-600">No contributions yet.</div>}
              </div>
            </Card>

            <Card title="My borrowing (requests)" subtitle="If you submitted a request, you’ll see its status here.">
              <div className="space-y-3">
                {borrowRequests.map((r) => (
                  <div key={r.id} className="rounded-3xl border p-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold break-words">{r.title}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        Amount: €{(r.amount_requested_cents / 100).toFixed(0)} • Expected: ~{r.expected_return_days} days
                      </div>
                    </div>
                    <Pill tone={r.status === "VERIFIED" ? "good" : "neutral"}>{r.status}</Pill>
                  </div>
                ))}
                {!borrowRequests.length && <div className="text-slate-600">No requests yet.</div>}
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Kindly note: borrower identity is protected. Our team validates documents internally.
              </div>
            </Card>
          </>
        )}
      </div>
    </Page>
  );
}

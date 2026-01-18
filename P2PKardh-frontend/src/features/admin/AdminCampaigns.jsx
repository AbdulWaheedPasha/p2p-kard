import React from "react";
import { adminCampaignsApi, adminReleaseCampaignApi } from "../../api/endpoints.js";
import { Page } from "../../components/ui/Motion.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";

export default function AdminCampaigns() {
  const [status, setStatus] = React.useState("FUNDED");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [rows, setRows] = React.useState([]);
  const [workingId, setWorkingId] = React.useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await adminCampaignsApi(status);
      setRows(data?.campaigns || []);
    } catch (e) {
      setError("Sorry — we couldn’t load campaigns. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function releaseFunds(id) {
    setWorkingId(id);
    setError("");
    try {
      await adminReleaseCampaignApi(id);
      await load();
      alert("Thank you. Funds have been marked as released.");
    } catch (e) {
      setError("Sorry — we couldn’t release funds right now. Please try again.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <Page>
      <div className="space-y-5">
        <div className="rounded-3xl border bg-white/80 p-6 shadow backdrop-blur">
          <div className="text-2xl font-semibold">Admin • Campaigns</div>
          <div className="mt-2 text-slate-600">
            Funded campaigns should be released after final checks. Please proceed carefully.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["FUNDED", "RUNNING", "RELEASED", "COMPLETED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold border transition ${
                  status === s ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
                }`}
              >
                {s}
              </button>
            ))}
            <div className="flex-1" />
            <Button variant="outline" onClick={load}>
              Refresh
            </Button>
          </div>
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <Card title="Campaign list" subtitle={`Filtered by status: ${status}`}>
          {loading ? (
            <div className="text-slate-600">Loading…</div>
          ) : rows.length ? (
            <div className="grid gap-3">
              {rows.map((c) => {
                const pooled = Math.round((c.amount_pooled_cents || 0) / 100);
                const need = Math.round((c.amount_needed_cents || 0) / 100);
                return (
                  <div key={c.id} className="rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-base font-semibold">{c.title_public}</div>
                      <div className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {c.status}
                      </div>
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      €{pooled} pooled • €{need} needed • {c.expected_return_days} days
                    </div>

                    {c.status === "FUNDED" && (
                      <div className="mt-3">
                        <Button onClick={() => releaseFunds(c.id)} disabled={workingId === c.id}>
                          {workingId === c.id ? "Releasing…" : "Release funds"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-600">No campaigns found.</div>
          )}
        </Card>
      </div>
    </Page>
  );
}

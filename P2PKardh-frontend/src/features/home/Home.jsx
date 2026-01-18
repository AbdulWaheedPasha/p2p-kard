import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { Page } from "../../components/ui/Motion.jsx";
import { homeApi } from "../../api/endpoints.js";

function normalizeCampaign(c) {
  const id = c?.campaign_id ?? c?.id ?? c?.uuid ?? c?.campaign_uuid;
  const hasNeededCents = c?.amount_needed_cents != null;
  const hasPooledCents = c?.amount_pooled_cents != null;
  const amountNeeded = hasNeededCents
    ? Math.round(Number(c.amount_needed_cents) / 100)
    : Number(c?.amount_needed ?? c?.amountNeeded ?? 0);
  const pooled = hasPooledCents
    ? Math.round(Number(c.amount_pooled_cents) / 100)
    : Number(c?.amount_pooled ?? c?.pooled ?? 0);
  const rawStatus = c?.status ?? "running";
  const status = typeof rawStatus === "string" ? rawStatus.toLowerCase() : "running";

  return {
    id,
    title: c?.title_public ?? c?.title ?? "Campaign",
    category: c?.category ?? "Other",
    amountNeeded,
    pooled,
    expectedReturnDays: c?.expected_return_days ?? c?.expectedReturnDays ?? 0,
    status,
    verified: c?.verified ?? c?.is_verified ?? false,
  };
}

function ProgressBar({ value = 0 }) {
  return (
    <div className="h-3 w-full rounded-full bg-slate-100">
      <div
        className="h-3 rounded-full bg-slate-900 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function CampaignCard({ c, onOpen, onSupport }) {
  const pct = Math.round((c.pooled / c.amountNeeded) * 100);

  return (
    <div
      className="h-full rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500">{c.category}</div>
          <div className="mt-2 text-lg font-semibold">{c.title}</div>
          <div className="mt-1 text-sm text-slate-600">
            Expected return: ~{c.expectedReturnDays} days
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {c.verified ? "Verified • Identity protected" : "Under review"}
          </div>
        </div>

        {c.status === "running" ? (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onSupport();
            }}
          >
            Support
          </Button>
        ) : (
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            Completed
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex justify-between text-sm text-slate-600">
          <span>€{c.pooled} pooled</span>
          <span>€{c.amountNeeded} needed</span>
        </div>
        <ProgressBar value={pct} />
        <div className="text-xs text-slate-500">{pct}% funded</div>
      </div>

      <div className="flex-1" />

      <div className="mt-5 text-xs text-slate-500">
        Click to read details, terms, and repayment estimate.
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [running, setRunning] = React.useState([]);
  const [completed, setCompleted] = React.useState([]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await homeApi();
        if (!alive) return;
        const runningCampaigns = Array.isArray(res?.running_campaigns)
          ? res.running_campaigns.map(normalizeCampaign).filter((c) => c.id)
          : [];
        const completedCampaigns = Array.isArray(res?.completed_campaigns)
          ? res.completed_campaigns.map(normalizeCampaign).filter((c) => c.id)
          : [];
        setRunning(runningCampaigns);
        setCompleted(completedCampaigns);
      } catch (e) {
        if (!alive) return;
        setError("Sorry â€” we couldnâ€™t load campaigns right now.");
        setRunning([]);
        setCompleted([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <Page>
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <div className="text-2xl font-semibold">Campaigns</div>
          <div className="mt-2 text-slate-600">
            Please support thoughtfully. Every request shown here is verified, and borrower identity is protected.
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        <Card
          title="Currently running"
          subtitle="These requests are active. Your support helps complete the pool."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-stretch">
            {loading ? (
              <div className="text-slate-600">Loadingâ€¦</div>
            ) : (
              running.map((c) => (
                <CampaignCard
                  key={c.id}
                  c={c}
                  onOpen={() => navigate(`/app/campaigns/${c.id}`)}
                  onSupport={() => navigate(`/app/campaigns/${c.id}/support`)}
                />
              ))
            )}
          </div>
        </Card>

        <Card
          title="Previously completed"
          subtitle="Thank you. These campaigns reached their goal."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-stretch">
            {loading ? (
              <div className="text-slate-600">Loadingâ€¦</div>
            ) : (
              completed.map((c) => (
                <CampaignCard
                  key={c.id}
                  c={c}
                  onOpen={() => navigate(`/app/campaigns/${c.id}`)}
                  onSupport={() => navigate(`/app/campaigns/${c.id}/support`)}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
}

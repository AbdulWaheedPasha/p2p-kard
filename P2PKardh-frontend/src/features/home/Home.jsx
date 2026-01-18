import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { Page } from "../../components/ui/Motion.jsx";

const demoCampaigns = [
  { id: "201", title: "Urgent medical support", category: "Medical", amountNeeded: 1200, pooled: 780, expectedReturnDays: 90, status: "running", verified: true },
  { id: "202", title: "Education fees support", category: "Education", amountNeeded: 800, pooled: 420, expectedReturnDays: 120, status: "running", verified: true },
  { id: "203", title: "Temporary rent support", category: "Housing", amountNeeded: 1500, pooled: 1200, expectedReturnDays: 150, status: "running", verified: true },
  { id: "204", title: "Work tools support", category: "Employment", amountNeeded: 600, pooled: 310, expectedReturnDays: 75, status: "running", verified: true },
  { id: "205", title: "Family travel for emergency", category: "Emergency", amountNeeded: 900, pooled: 900, expectedReturnDays: 110, status: "completed", verified: true },
  { id: "206", title: "Monthly essentials support", category: "Essentials", amountNeeded: 500, pooled: 500, expectedReturnDays: 60, status: "completed", verified: true },
  { id: "207", title: "Medical follow-up support", category: "Medical", amountNeeded: 700, pooled: 700, expectedReturnDays: 80, status: "completed", verified: true },
];

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

  // BACKEND DEPENDENCY: replace demoCampaigns with API fetch
  // const { running, completed } = await api.getCampaignsHome();
  const running = demoCampaigns.filter((c) => c.status === "running");
  const completed = demoCampaigns.filter((c) => c.status === "completed");

  return (
    <Page>
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <div className="text-2xl font-semibold">Campaigns</div>
          <div className="mt-2 text-slate-600">
            Please support thoughtfully. Every request shown here is verified, and borrower identity is protected.
          </div>
        </div>

        <Card
          title="Currently running"
          subtitle="These requests are active. Your support helps complete the pool."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-stretch">
            {running.map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                onOpen={() => navigate(`/app/campaigns/${c.id}`)}
                onSupport={() => navigate(`/app/campaigns/${c.id}/support`)}
              />
            ))}
          </div>
        </Card>

        <Card
          title="Previously completed"
          subtitle="Thank you. These campaigns reached their goal."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-stretch">
            {completed.map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                onOpen={() => navigate(`/app/campaigns/${c.id}`)}
                onSupport={() => navigate(`/app/campaigns/${c.id}/support`)}
              />
            ))}
          </div>
        </Card>
      </div>
    </Page>
  );
}

import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import { Page } from "../../components/ui/Motion.jsx";
import { repaymentsMineApi, repaymentsPayApi } from "../../api/endpoints.js";

function Pill({ children, tone = "neutral" }) {
  const map = {
    neutral: "bg-slate-100 text-slate-700",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-800",
    bad: "bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${map[tone] || map.neutral}`}>
      {children}
    </span>
  );
}

export default function Repayments() {
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [schedule, setSchedule] = React.useState([]);
  const [totals, setTotals] = React.useState(null);

  const [amountEur, setAmountEur] = React.useState("50");
  const [paying, setPaying] = React.useState(false);

  // NOTE: backend likely ties repayments to an active borrow_request.
  // We will derive borrowRequestId from schedule items if provided.
  const borrowRequestId =
    schedule?.[0]?.borrow_request_id ||
    schedule?.[0]?.borrowRequestId ||
    null;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await repaymentsMineApi();
      setSchedule(Array.isArray(res.schedule) ? res.schedule : []);
      setTotals(res.totals && typeof res.totals === "object" ? res.totals : null);
    } catch (e) {
      setError("Sorry — we couldn’t load your repayment details right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function onPayNow() {
    setError("");
    const eur = Number(amountEur);
    if (!Number.isFinite(eur) || eur <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!borrowRequestId) {
      setError("We couldn’t detect the borrowing request for repayment. Please contact support.");
      return;
    }

    setPaying(true);
    try {
      const res = await repaymentsPayApi({
        borrowRequestId,
        amountCents: Math.round(eur * 100),
        currency: "EUR",
      });

      const url = res.checkout_url || res.checkoutUrl || res.url;
      if (!url) {
        setError("Checkout URL was not provided by the server.");
        return;
      }

      window.location.href = url;
    } catch (e) {
      setError("Sorry — we couldn’t start repayment checkout. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  function toneForStatus(status) {
    const s = String(status || "").toUpperCase();
    if (s === "PAID") return "good";
    if (s === "SCHEDULED") return "neutral";
    if (s === "LATE") return "warn";
    if (s === "FAILED") return "bad";
    return "neutral";
  }

  return (
    <Page>
      <div className="space-y-6">
        <Card
          title="Repayments"
          subtitle="Please repay comfortably and responsibly. Your repayments help return funds to supporters."
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={() => navigate("/app/lender")}>
                Back to dashboard
              </Button>
              <Button variant="outline" onClick={load} disabled={loading}>
                Refresh
              </Button>
            </div>
          }
        >
          {loading ? (
            <div className="text-slate-600">Loading…</div>
          ) : (
            <div className="space-y-6">
              {totals && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">Paid</div>
                    <div className="mt-1 text-lg font-semibold">
                      {totals.paid_cents != null ? `€${(totals.paid_cents / 100).toFixed(0)}` : "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">Remaining</div>
                    <div className="mt-1 text-lg font-semibold">
                      {totals.remaining_cents != null ? `€${(totals.remaining_cents / 100).toFixed(0)}` : "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">Schedule items</div>
                    <div className="mt-1 text-lg font-semibold">{schedule.length}</div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-5">
                <div className="text-sm font-semibold">Pay now</div>
                <div className="mt-1 text-sm text-slate-600">
                  You will be redirected to a secure checkout. Thank you for your sincerity.
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Input
                    label="Amount (EUR)"
                    inputMode="decimal"
                    value={amountEur}
                    onChange={(e) => setAmountEur(e.target.value)}
                    hint="You may repay in parts if needed."
                  />
                  <Button onClick={onPayNow} disabled={paying}>
                    {paying ? "Redirecting…" : "Pay securely"}
                  </Button>
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold">Your schedule</div>
                <div className="mt-3 space-y-3">
                  {schedule.map((s) => (
                    <div key={s.id} className="rounded-3xl border p-5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-base font-semibold">
                          Due: {s.due_date || s.dueDate || "—"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Amount: €{(((s.amount_cents ?? s.amountCents) || 0) / 100).toFixed(0)}
                        </div>
                      </div>
                      <Pill tone={toneForStatus(s.status)}>{s.status}</Pill>
                    </div>
                  ))}
                  {!schedule.length && (
                    <div className="text-slate-600">
                      No repayment schedule found yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Kindly note: repayment confirmation is handled securely through the payment provider and backend webhooks.
              </div>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}

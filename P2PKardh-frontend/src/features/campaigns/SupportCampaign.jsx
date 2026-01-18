import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import { Page } from "../../components/ui/Motion.jsx";
import { supportCheckoutApi } from "../../api/endpoints.js";

export default function SupportCampaign() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [amount, setAmount] = React.useState("25");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function onProceed() {
    setError("");
    const euros = Number(amount);
    if (!Number.isFinite(euros) || euros <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}/app/lender?payment=success`;
      const cancelUrl = `${window.location.origin}/app/campaigns/${id}`;

      const res = await supportCheckoutApi({
        campaignId: id,
        amountCents: Math.round(euros * 100),
        currency: "EUR",
        returnUrl,
        cancelUrl,
      });

      // Backend returns { checkout: {...} } (shape is provider-specific) :contentReference[oaicite:1]{index=1}
      const checkout = res.checkout || {};
      const url =
        checkout.checkout_url ||
        checkout.checkoutUrl ||
        checkout.url ||
        checkout.redirect_url;

      if (!url) {
        setError("Checkout URL was not provided by the server. Please contact support.");
        return;
      }

      window.location.href = url;
    } catch (e) {
      setError("Sorry — we couldn’t start checkout right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page>
      <div className="space-y-6">
        <Card
          title="Support this campaign"
          subtitle="Please choose an amount. You’ll be redirected to a secure checkout."
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={() => navigate(`/app/campaigns/${id}`)}>
                Back to details
              </Button>
              <Button onClick={onProceed} disabled={loading}>
                {loading ? "Redirecting..." : "Proceed to support"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="Amount (EUR)"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              hint="Please support responsibly. Thank you for your kindness."
            />

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">
              <div className="font-semibold">Important</div>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>Borrower identity is protected.</li>
                <li>This is interest-free support.</li>
                <li>Repayment is handled through the platform.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
}

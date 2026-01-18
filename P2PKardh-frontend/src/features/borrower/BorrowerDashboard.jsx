import React from "react";
import Card from "../../components/ui/Card.jsx";
import { Page } from "../../components/ui/Motion.jsx";

export default function BorrowerDashboard() {
  return (
    <Page>
      <Card
        title="Borrower Dashboard"
        subtitle="You’re not alone. Please apply carefully, and we’ll review respectfully."
      >
        <div className="text-sm text-slate-600">
          Next: we’ll add Apply (multi-step), Status tracking, and Repayment screen.
        </div>
      </Card>
    </Page>
  );
}

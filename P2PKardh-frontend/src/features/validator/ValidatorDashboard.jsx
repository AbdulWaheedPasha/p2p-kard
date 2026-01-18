import React from "react";
import Card from "../../components/ui/Card.jsx";
import { Page } from "../../components/ui/Motion.jsx";

export default function ValidatorDashboard() {
  return (
    <Page>
      <Card
        title="Validator Queue"
        subtitle="Thank you for reviewing carefully. Your effort protects the community."
      >
        <div className="text-sm text-slate-600">
          Next: we’ll add review list + approve/reject + notes.
        </div>
      </Card>
    </Page>
  );
}

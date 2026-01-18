import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { Page, FadeIn } from "../../components/ui/Motion.jsx";
import { useAuthStore } from "../../state/authStore.js";

export default function ChooseRole() {
  const navigate = useNavigate();
  const { setRole } = useAuthStore();

  function go(role) {
    // BACKEND DEPENDENCY: persist role selection to backend/user profile
    setRole(role);
    navigate(`/app/${role}`); // demo navigation
  }

return (
  <div className="min-h-screen bg-slate-50 px-4 py-10 flex items-center justify-center">
    <div className="w-full max-w-2xl">
        <Page>
          <Card
            title="How would you like to continue?"
            subtitle="Please choose one option. You can always change later."
          >
           <div className="grid gap-4 md:grid-cols-3 items-stretch">

              <FadeIn delay={0.05}>
               <div className="h-full rounded-2xl border p-6 flex flex-col">
                  <div className="font-semibold">Supporter (Lender)</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Support verified requests and receive your funds back over time.
                  </div>
                  <div className="flex-1" />

                  <Button className="mt-4 w-full" onClick={() => go("lender")}>
                    Continue as Supporter
                  </Button>
                </div>
              </FadeIn>

              <FadeIn delay={0.1}>
                <div className="h-full rounded-2xl border p-6 flex flex-col">
                  <div className="font-semibold">Borrower</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Apply with documents. We’ll review carefully and respectfully.
                  </div>
                  <div className="flex-1" />

                  <Button className="mt-4 w-full" onClick={() => go("borrower")}>
                    Continue as Borrower
                  </Button>
                </div>
              </FadeIn>

              <FadeIn delay={0.15}>
              <div className="h-full rounded-2xl border p-6 flex flex-col">

                  <div className="font-semibold">Validator</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Review requests with care and help maintain trust.
                  </div>
                  <div className="flex-1" />

                  <Button className="mt-4 w-full" variant="outline" onClick={() => go("validator")}>
                    Continue as Validator
                  </Button>
                </div>
              </FadeIn>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Please be gentle and honest. Your good intention helps everyone.
            </div>
          </Card>
        </Page>
      </div>
    </div>
  );
}

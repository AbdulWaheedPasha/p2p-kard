import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  adminBorrowRequestDetailApi,
  adminBorrowDecisionApi,
  adminCreateCampaignApi,
} from "../../api/endpoints.js";

import { Page } from "../../components/ui/Motion.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";


export default function AdminBorrowRequestDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [row, setRow] = React.useState(null);
  const [error, setError] = React.useState("");
  const [noteInternal, setNoteInternal] = React.useState("");

  const [creating, setCreating] = React.useState(false);
  const [decisioning, setDecisioning] = React.useState(false);

  // campaign form for create-campaign
  const [publicTitle, setPublicTitle] = React.useState("");
  const [publicStory, setPublicStory] = React.useState("");
  const [termsPublic, setTermsPublic] = React.useState(
    "Identity is protected. Please support responsibly. Repayment is expected within the stated timeframe."
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await adminBorrowRequestDetailApi(id);
      setRow(data);
      setPublicTitle(data?.title || "");
      setPublicStory(data?.reason_detailed || "");
      setNoteInternal(data?.admin_note_internal || "");
    } catch (e) {
      setError("Sorry — we couldn’t load this request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function decide(decision) {
    setDecisioning(true);
    setError("");
    try {
    await adminBorrowRequestDecisionApi(id, {
  decision,
  noteInternal,
  note_internal: noteInternal,
});
      await load();
    } catch (e) {
      setError("Sorry — we couldn’t update the decision. Please try again.");
    } finally {
      setDecisioning(false);
    }
  }

  async function createCampaign() {
    if (!row) return;
    setCreating(true);
    setError("");
    try {
      const payload = {
        titlePublic: publicTitle.trim(),
        storyPublic: publicStory.trim(),
        termsPublic: termsPublic.trim(),
        category: row.category,
        verified: true,
        status: "RUNNING",
        currency: row.currency || "EUR",
        amountNeededCents: row.amount_requested_cents,
        amountPooledCents: 0,
        expectedReturnDays: row.expected_return_days,
        expectedReturnDate: null,
      };

      // NOTE: backend uses CreateCampaignSerializer on campaigns side.
      // Your backend serializer may expect snake_case. If so, change keys to:
      // title_public, story_public, terms_public, amount_needed_cents, ...
      await adminCreateCampaignApi(id, payload);
      await load();
    } catch (e) {
      setError("Sorry — we couldn’t create a campaign. Please check the fields and try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Page>
      <div className="space-y-5">
        <div className="rounded-3xl border bg-white/80 p-6 shadow backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold">Admin • Request details</div>
              <div className="mt-1 text-slate-600">Please review documents and take a decision respectfully.</div>
            </div>
            <Button variant="outline" onClick={() => nav("/app/admin/requests")}>
              Back to list
            </Button>
          </div>
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="text-slate-600">Loading…</div>
        ) : !row ? (
          <div className="text-slate-600">Not found.</div>
        ) : (
          <>
            <Card title="Borrow request" subtitle={`Status: ${row.status}`}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Borrower</div>
                  <div className="mt-1 font-semibold">{row.requester_email}</div>
                  <div className="mt-2 text-xs text-slate-500">Request ID</div>
                  <div className="mt-1 font-mono text-sm">{row.id}</div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Requested amount</div>
                  <div className="mt-1 text-lg font-semibold">
                    €{Math.round((row.amount_requested_cents ?? 0) / 100)}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Expected return</div>
                  <div className="mt-1 font-semibold">{row.expected_return_days} days</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border p-4">
                <div className="text-sm font-semibold">Reason (private)</div>
                <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{row.reason_detailed}</div>
              </div>

              <div className="mt-4 rounded-2xl border p-4">
                <div className="text-sm font-semibold">Internal admin note</div>
                <textarea
                  value={noteInternal}
                  onChange={(e) => setNoteInternal(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Write a brief internal note for the team (not shown to supporters)."
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => decide("VERIFY")} disabled={decisioning}>
                    {decisioning ? "Working…" : "Verify"}
                  </Button>
                  <Button variant="outline" onClick={() => decide("REJECT")} disabled={decisioning}>
                    {decisioning ? "Working…" : "Reject"}
                  </Button>
                </div>
              </div>
            </Card>

            <Card
              title="Documents"
              subtitle="For now we list uploaded document metadata. Opening requires S3/local download support."
            >
              {row.documents?.length ? (
                <div className="grid gap-2">
                  {row.documents.map((d) => (
                    <div key={d.id} className="rounded-2xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">{d.file_name}</div>
                        <div className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold">{d.status}</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{d.content_type}</div>
                      <div className="mt-2 text-xs text-slate-500 break-all">storage_key: {d.storage_key}</div>

                      {/* BACKEND DEPENDENCY:
                          Provide GET /api/v1/admin/documents/<docId>/download-url -> { url }
                          then open window.open(url)
                      */}
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          onClick={() => alert("Backend dependency: add admin download-url endpoint to open file.")}
                        >
                          Open document
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-600">No documents uploaded.</div>
              )}
            </Card>

            <Card
              title="Create campaign"
              subtitle="This publishes the request to Home and supporters can begin supporting."
            >
              <div className="grid gap-3">
                <div>
                  <div className="text-sm font-semibold">Public title</div>
                  <input
                    value={publicTitle}
                    onChange={(e) => setPublicTitle(e.target.value)}
                    className="mt-2 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold">Public story (identity protected)</div>
                  <textarea
                    value={publicStory}
                    onChange={(e) => setPublicStory(e.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold">Terms</div>
                  <textarea
                    value={termsPublic}
                    onChange={(e) => setTermsPublic(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={createCampaign} disabled={creating || row.status !== "VERIFIED"}>
                    {creating ? "Creating…" : "Create campaign"}
                  </Button>
                  {row.status !== "VERIFIED" && (
                    <div className="text-sm text-slate-600 self-center">
                      Please verify the request first.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </Page>
  );
}

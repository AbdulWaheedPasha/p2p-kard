import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import { Page } from "../../components/ui/Motion.jsx";
import {
  createBorrowRequestApi,
  presignBorrowDocsApi,
  confirmBorrowDocsApi,
} from "../../api/endpoints.js";

const CATEGORIES = ["Medical", "Education", "Housing", "Employment", "Emergency", "Essentials"];

export default function BorrowerApply() {
  const navigate = useNavigate();

  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("Medical");
  const [reason, setReason] = React.useState("");
  const [amountEur, setAmountEur] = React.useState("500");
  const [expectedDays, setExpectedDays] = React.useState("120");

  const [files, setFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [info, setInfo] = React.useState("");

  function onPickFiles(e) {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
  }

  async function onSubmit() {
    setError("");
    setInfo("");

    const eur = Number(amountEur);
    const days = Number(expectedDays);

    if (!title.trim()) return setError("Please add a short title.");
    if (!reason.trim()) return setError("Please explain your situation clearly.");
    if (!Number.isFinite(eur) || eur <= 0) return setError("Please enter a valid amount.");
    if (!Number.isFinite(days) || days <= 0) return setError("Please enter expected return days.");

    setLoading(true);
    try {
      // 1) create borrow request
      const createRes = await createBorrowRequestApi({
        title: title.trim(),
        category,
        reason_detailed: reason.trim(),
        amount_requested_cents: Math.round(eur * 100),
        currency: "EUR",
        expected_return_days: Math.round(days),
      });
const borrowRequestId =
  createRes?.borrowRequest?.id ||
  createRes?.borrow_request?.id ||
  createRes?.id ||
  createRes?.borrowRequestId ||
  createRes?.borrow_request_id;

if (!borrowRequestId) {
  console.log("Borrow create response (no id found):", createRes);
  throw new Error("NO_BORROW_ID");
}

// 2) upload documents if any
if (files.length) {
  try {
    const presign = await presignBorrowDocsApi(
      borrowRequestId,
      files.map((f) => ({ fileName: f.name, contentType: f.type || "application/octet-stream" }))
    );

    const uploads = presign.uploads || [];
    const uploadedDocIds = [];

    for (let i = 0; i < uploads.length; i++) {
      const u = uploads[i];
      const file = files.find((f) => f.name === u.file_name) || files[i];
      if (!u.upload_url || !u.document_id || !file) continue;

      const putRes = await fetch(u.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!putRes.ok) throw new Error(`Upload failed for ${file.name}`);

      uploadedDocIds.push(u.document_id);
    }

    if (uploadedDocIds.length) {
      const confirm = await confirmBorrowDocsApi(borrowRequestId, uploadedDocIds);

      // Some APIs return {} / {ok:true} / {success:true}
      const ok =
        confirm?.ok === true ||
        confirm?.success === true ||
        confirm?.status === "OK" ||
        confirm?.confirmed === true;

      if (!ok) {
        // Don’t block the whole request if confirm response shape differs
        console.log("Confirm docs response:", confirm);
      }
    }
  } catch (uploadErr) {
    // ✅ Don’t fail the whole submission when S3 isn’t ready
    console.log("Upload skipped/failed (likely S3 not configured):", uploadErr);
  }
}

setInfo("Thank you. Your request has been submitted for verification. We will update you once reviewed.");
setTimeout(() => navigate("/dashboard"), 900);

    } catch (e) {
      setError("Sorry — we couldn’t submit your request right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page>
      <div className="space-y-6">
        <Card
          title="Request support"
          subtitle="Please share your situation honestly. Your identity will remain protected."
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={() => navigate("/app/home")}>Back</Button>
              <Button onClick={onSubmit} disabled={loading}>
                {loading ? "Submitting..." : "Submit request"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Temporary rent support" />

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800">Category</div>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-200"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800">Reason (detailed)</div>
              <textarea
                className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-200"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please explain what happened, why you need help, and your plan to repay."
              />
              <div className="mt-2 text-sm text-slate-500">
                Please avoid sharing identifying details (names, address). Thank you.
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Amount (EUR)" inputMode="decimal" value={amountEur} onChange={(e) => setAmountEur(e.target.value)} />
              <Input label="Expected return (days)" inputMode="numeric" value={expectedDays} onChange={(e) => setExpectedDays(e.target.value)} />
            </div>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800">Supporting documents (optional)</div>
              <input
                type="file"
                multiple
                onChange={onPickFiles}
                className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-white hover:file:bg-slate-800"
              />
              {!!files.length && (
                <div className="mt-2 text-sm text-slate-600">
                  Selected: {files.map((f) => f.name).join(", ")}
                </div>
              )}
            </label>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}
            {info && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{info}</div>
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
}

import { api } from "./client";

/** =========================
 * AUTH
 * ========================= */
export async function loginApi({ email, password }) {
  const { data } = await api.post("/api/v1/auth/login", { email, password });
  return data; // { user, token } (as per your current frontend assumption)
}

export async function registerApi({ email, name, password }) {
  const { data } = await api.post("/api/v1/auth/register", {
    email,
    name,
    password,
  });
  return data; // { user, token }
}

export async function logoutApi() {
  await api.post("/api/v1/auth/logout");
}

export async function meApi() {
  const { data } = await api.get("/api/v1/me");
  return data;
}

/** =========================
 * HELPERS
 * Some serializers may return stringified JSON
 * ========================= */
function maybeParse(v) {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

/** =========================
 * HOME
 * ========================= */
export async function homeApi() {
  const { data } = await api.get("/api/v1/home");
  return {
    stats: maybeParse(data.stats),
    running_campaigns: maybeParse(data.running_campaigns),
    completed_campaigns: maybeParse(data.completed_campaigns),
  };
}

/** =========================
 * CAMPAIGNS
 * ========================= */
export async function campaignDetailApi(campaignId) {
  const { data } = await api.get(`/api/v1/campaigns/${campaignId}`);
  return data; // { campaign: {...} }
}

/** =========================
 * SUPPORT CHECKOUT (JWT required)
 * ========================= */
export async function supportCheckoutApi({
  campaignId,
  amountCents,
  currency = "EUR",
  returnUrl,
  cancelUrl,
}) {
  const { data } = await api.post(
    `/api/v1/campaigns/${campaignId}/support/checkout`,
    {
      amount_cents: amountCents,
      currency,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    }
  );
  return data; // { checkout: {...} }
}

/** =========================
 * DASHBOARD (JWT required)
 * ========================= */
export async function dashboardApi() {
  const { data } = await api.get("/api/v1/dashboard");
  return {
    support_summary: maybeParse(data.support_summary),
    support_by_campaign: maybeParse(data.support_by_campaign),
    borrow_requests: maybeParse(data.borrow_requests),
  };
}

/** =========================
 * BORROW REQUESTS (JWT required)
 * ========================= */
export async function createBorrowRequestApi(payload) {
  // payload uses snake_case as per your schema
  const { data } = await api.post("/api/v1/borrow-requests", payload);
  return data; // { borrow_request: {...} } OR { borrowRequest: {...} } depending on serializer mixin
}

export async function presignBorrowDocsApi(borrowRequestId, files) {
  const { data } = await api.post(
    `/api/v1/borrow-requests/${borrowRequestId}/documents/presign`,
    {
      files: files.map((f) => ({
        file_name: f.fileName,
        content_type: f.contentType,
      })),
    }
  );
  return data; // { uploads: [{document_id, upload_url, file_name, ...}] }
}

export async function confirmBorrowDocsApi(borrowRequestId, documentIds) {
  const { data } = await api.post(
    `/api/v1/borrow-requests/${borrowRequestId}/documents/confirm`,
    {
      document_ids: documentIds,
    }
  );
  return data; // { ok: true }
}

/** =========================
 * REPAYMENTS (JWT required)
 * ========================= */
export async function repaymentsMineApi() {
  const { data } = await api.get("/api/v1/repayments/mine");
  return data;
}

export async function repaymentsSetupApi({
  borrowRequestId,
  provider = "stripe",
  returnUrl,
}) {
  const { data } = await api.post("/api/v1/repayments/setup", {
    borrow_request_id: borrowRequestId,
    provider,
    return_url: returnUrl,
  });
  return data; // { setup_url }
}

export async function repaymentsPayApi({
  borrowRequestId,
  amountCents,
  currency = "EUR",
}) {
  const { data } = await api.post("/api/v1/repayments/pay", {
    borrow_request_id: borrowRequestId,
    amount_cents: amountCents,
    currency,
  });
  return data; // { checkout_url }
}

/** =========================
 * ADMIN / STAFF APIs (JWT + IsAdminUser required)
 * ========================= */

/** Borrow Requests */
// ADMIN
export async function adminBorrowRequestsApi(params = {}) {
  const { data } = await api.get("/api/v1/admin/borrow-requests", { params });
  return data;
}

export async function adminBorrowRequestDetailApi(borrowRequestId) {
  const { data } = await api.get(
    `/api/v1/admin/borrow-requests/${borrowRequestId}`
  );
  return data;
}

export async function adminBorrowDecisionApi(borrowRequestId, payload) {
  const { data } = await api.post(
    `/api/v1/admin/borrow-requests/${borrowRequestId}/decision`,
    payload
  );
  return data;
}

export async function adminCreateCampaignApi(borrowRequestId, payload) {
  const { data } = await api.post(
    `/api/v1/admin/borrow-requests/${borrowRequestId}/create-campaign`,
    payload
  );
  return data;
}

/** Campaigns (optional admin pages)
 * NOTE: These endpoints must exist in backend, otherwise you'll get 404.
 * Keeping exports prevents frontend crash.
 */
export const adminCampaignsApi = async (params = {}) => {
  const { data } = await api.get("/api/v1/admin/campaigns", { params });
  return data;
};

export const adminCampaignDetailApi = async (campaignId) => {
  const { data } = await api.get(`/api/v1/admin/campaigns/${campaignId}`);
  return data;
};

// e.g. release/disburse funds (depends on backend)
export const adminReleaseCampaignApi = async (campaignId, payload = {}) => {
  const { data } = await api.post(
    `/api/v1/admin/campaigns/${campaignId}/release`,
    payload
  );
  return data;
};

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell.jsx";

// Auth
import Login from "../features/auth/Login.jsx";
import Register from "../features/auth/Register.jsx";

// Main app screens
import Home from "../features/home/Home.jsx";
import CampaignDetails from "../features/campaigns/CampaignDetails.jsx";
import SupportCampaign from "../features/campaigns/SupportCampaign.jsx";
import LenderDashboard from "../features/lender/LenderDashboard.jsx";
import BorrowerApply from "../features/borrower/BorrowerApply.jsx";
import Repayments from "../features/repayments/Repayments.jsx";

// Admin screens
import AdminBorrowRequests from "../features/admin/AdminBorrowRequests.jsx";
import AdminBorrowRequestDetail from "../features/admin/AdminBorrowRequestDetail.jsx";
import AdminCampaigns from "../features/admin/AdminCampaigns.jsx";

import { useAuthStore } from "../state/authStore.js";

function RequireAuth({ children }) {
  const { isAuthed } = useAuthStore();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAuthed, user } = useAuthStore();
  if (!isAuthed) return <Navigate to="/login" replace />;

  const isAdmin = !!(user?.isStaff || user?.isSuperuser);
  if (!isAdmin) return <Navigate to="/app/home" replace />;

  return children;
}


export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/app/home" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* App shell (Home + Campaign details are public) */}
      <Route path="/app" element={<AppShell />}>
        {/* Public pages */}
        <Route path="home" element={<Home />} />
        <Route path="campaigns/:id" element={<CampaignDetails />} />

        {/* Auth required */}
        <Route
          path="campaigns/:id/support"
          element={
            <RequireAuth>
              <SupportCampaign />
            </RequireAuth>
          }
        />
        <Route
          path="lender"
          element={
            <RequireAuth>
              <LenderDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="repayments"
          element={
            <RequireAuth>
              <Repayments />
            </RequireAuth>
          }
        />
        <Route
          path="borrower/apply"
          element={
            <RequireAuth>
              <BorrowerApply />
            </RequireAuth>
          }
        />

        {/* ✅ Admin only */}
        <Route
          path="admin/requests"
          element={
            <RequireAdmin>
              <AdminBorrowRequests />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/requests/:id"
          element={
            <RequireAdmin>
              <AdminBorrowRequestDetail />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/campaigns"
          element={
            <RequireAdmin>
              <AdminCampaigns />
            </RequireAdmin>
          }
        />

        {/* Default inside /app */}
        <Route path="" element={<Navigate to="/app/home" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/app/home" replace />} />
    </Routes>
  );
}

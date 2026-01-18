import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import { Page } from "../../components/ui/Motion.jsx";

import { loginApi } from "../../api/endpoints.js";
import { useAuthStore } from "../../state/authStore.js";

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginApi({ email: trimmedEmail, password });
      // Django returns { user, token }
    setAuth({
  user: res.user,
  token: res.access || res.token,   // access token
  refreshToken: res.refresh,        // refresh token
});


      navigate("/app/home");
    } catch (err) {
      setError("Sorry, we couldn’t sign you in. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-lg">
        <Page>
          <Card
            title={<span className="text-2xl font-semibold">Sign in</span>}
            subtitle="Please enter your email and password to continue."
            footer={
              <div className="text-base text-slate-600">
                New here?{" "}
                <Link className="text-slate-900 underline" to="/register">
                  Create an account
                </Link>
              </div>
            }
          >
            <form className="space-y-4" onSubmit={onSubmit}>
              <Input
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />

              <Input
                label="Password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />

              <Button className="w-full" disabled={loading} type="submit">
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <div className="text-xs text-slate-500">
                Thank you. We’ll keep your information secure and private.
              </div>

              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </Card>
        </Page>
      </div>
    </div>
  );
}

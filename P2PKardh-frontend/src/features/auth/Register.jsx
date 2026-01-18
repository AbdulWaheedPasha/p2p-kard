import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import { Page } from "../../components/ui/Motion.jsx";

import { registerApi } from "../../api/endpoints.js";
import { useAuthStore } from "../../state/authStore.js";

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Please choose a password with at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerApi({ name: name.trim(), email: trimmedEmail, password });
      // Django returns { user, token }
      setAuth({
  user: res.user,
  token: res.access || res.token,   // access token
  refreshToken: res.refresh,        // refresh token
});

      navigate("/app/home");
    } catch (err) {
      setError("Sorry, we couldn’t create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-lg">
        <Page>
          <Card
            title={<span className="text-2xl font-semibold">Create your account</span>}
            subtitle="Please enter your details to get started."
            footer={
              <div className="text-base text-slate-600">
                Already have an account?{" "}
                <Link className="text-slate-900 underline" to="/login">
                  Sign in
                </Link>
              </div>
            }
          >
            <form className="space-y-4" onSubmit={onSubmit}>
              <Input
                label="Name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />

              <Input
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />

              <Input
                label="Password"
                placeholder="Create a password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                hint="Please keep this password private and secure."
              />

              <Button className="w-full" disabled={loading} type="submit">
                {loading ? "Creating..." : "Create account"}
              </Button>

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

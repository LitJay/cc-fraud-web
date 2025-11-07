"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import GeneralAlert from "../component/GeneralAlert/GeneralAlert";

const API = "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

 
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; 
      const currentTime = Date.now();
      return currentTime >= expirationTime;
    } catch (error) {
      return true; 
    }
  };

  useEffect(() => {
    localStorage.setItem('is_login_page', 'true');
    const token = localStorage.getItem('token');
    if (token && !isTokenExpired(token)) {
      router.push('/dashboard');
    } else {
      setCheckingToken(false);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API}/auth/login`, {
        email,
        password,
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("userName", data.user_name);
      localStorage.setItem("role", data.role);
      console.log(localStorage.getItem("role"));
      localStorage.removeItem('is_login_page');
      router.push("/dashboard");
      window.location.reload();
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? "Login failed";
      setError(msg);
      GeneralAlert({
        mode: 2,
        text: "Invalid email or password. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (checkingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-2 text-slate-600">Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4"
    >
      <div className="w-full max-w-md rounded-2xl shadow-xl bg-white/80 backdrop-blur-lg">
        <div className="p-8 space-y-6">
          <h1 className="text-2xl font-semibold text-center">Sign in</h1>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                required
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                required
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 text-white py-2 hover:bg-slate-800 transition disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

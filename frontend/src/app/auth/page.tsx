"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { AIIcon } from "@/components/brand/AIIcon";
import {
  Lock, User, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2, AtSign,
  Shield, Fingerprint, Sparkles, Briefcase, Code2, BookOpen, BarChart3, Bot, Layers,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import Magnetic from "@/components/landing/Magnetic";
import Background from "@/components/landing/Background";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/config/api";


// Mock login is disabled: it silently issued a fake session whenever the
// backend was unreachable or returned a placeholder response, which is a
// real authentication bypass. Do not re-enable without removing mockLogin().
const ENABLE_MOCK_LOGIN = false;

type AuthStep = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const { setAuthenticated } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const [step, setStep] = useState<AuthStep>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [rememberMe, setRememberMe] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    router.prefetch("/home");
  }, [router]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ─── MOCK LOGIN HELPER ─────────────────────────────
  const mockLogin = (userEmail: string, userName: string = "Demo User") => {
    const fakeToken = "mock." + btoa(userEmail) + "." + Date.now();
    localStorage.setItem("access_token", fakeToken);
    localStorage.setItem("user_tier", "free");
    localStorage.setItem("user_name", userName);
    localStorage.setItem("user_email", userEmail);
    setAuthenticated(true);
    router.push("/home");
  };

  // ─── Login ──────────────────────────────────────────
  const handlePasswordLogin = async () => {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      // 🔧 Placeholder detect karo → mock login
      const isPlaceholder =
        typeof data?.message === "string" &&
        data.message.toLowerCase().includes("placeholder");

      if (isPlaceholder && ENABLE_MOCK_LOGIN) {
        console.warn("⚠️ Backend placeholder mila, mock login use kar rahe hain.");
        mockLogin(email, email.split("@")[0]);
        return;
      }

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Login failed");
      }

      if (!data.access_token) {
        throw new Error("No token received from server.");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_tier", data.tier || "free");
      if (data.full_name) localStorage.setItem("user_name", data.full_name);
      if (data.email) localStorage.setItem("user_email", data.email);

      setAuthenticated(true);
      router.push("/home");
    } catch (err: any) {
      // 🔧 Network error ya 404 → mock fallback
      if (ENABLE_MOCK_LOGIN) {
        console.warn("⚠️ Backend se connect nahi hua, mock login:", err?.message);
        mockLogin(email, email.split("@")[0]);
        return;
      }
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Signup ──────────────────────────────────────────
  const handleSignup = async () => {
    if (!fullName.trim()) { setError("Please enter your full name."); return; }
    if (!email) { setError("Please enter your email."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, password }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      const isPlaceholder =
        typeof data?.message === "string" &&
        data.message.toLowerCase().includes("placeholder");

      if (isPlaceholder && ENABLE_MOCK_LOGIN) {
        console.warn("⚠️ Register placeholder mila, mock signup.");
        mockLogin(email, fullName);
        return;
      }

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Registration failed");
      }

      if (!data.access_token) {
        throw new Error("No token received from server.");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_tier", data.tier || "free");
      if (data.full_name) localStorage.setItem("user_name", data.full_name);
      if (data.email) localStorage.setItem("user_email", data.email);

      setAuthenticated(true);
      router.push("/home");
    } catch (err: any) {
      if (ENABLE_MOCK_LOGIN) {
        console.warn("⚠️ Signup fallback to mock:", err?.message);
        mockLogin(email, fullName);
        return;
      }
      setError(err.message || "Could not create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── OAuth ──────────────────────────────────────────
  const handleGoogleLogin = () => { window.location.href = `${API_BASE}/auth/google/login`; };
  const handleGithubLogin = () => { window.location.href = `${API_BASE}/auth/github/login`; };
  const handleMicrosoftLogin = () => { window.location.href = `${API_BASE}/auth/microsoft/login`; };

  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const label = ["Weak", "Weak", "Medium", "Strong"][score] || "Weak";
    return { score: score as 0 | 1 | 2 | 3, label };
  };

  // ─── LOGIN FORM ─────────────────────────────────────
  const renderLogin = () => (
    <form onSubmit={(e) => { e.preventDefault(); handlePasswordLogin(); }} className="space-y-4">
      <div className="relative">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="peer w-full rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 pt-5 text-white placeholder-transparent focus:border-emerald-400/60 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
          placeholder=" "
          required
        />
        <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 peer-focus:text-emerald-400 transition-colors" />
        <label className="absolute left-9 top-2 text-[10px] text-white/30 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-emerald-400/70">
          Email address
        </label>
      </div>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="peer w-full rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 pt-5 text-white placeholder-transparent focus:border-emerald-400/60 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
          placeholder=" "
          required
        />
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 peer-focus:text-emerald-400 transition-colors" />
        <label className="absolute left-9 top-2 text-[10px] text-white/30 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-emerald-400/70">
          Password
        </label>
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-white/40 hover:text-white/60 transition-colors">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-400"
          />
          Remember me
        </label>
      </div>

      <Magnetic strength={0.25}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-3 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 text-sm relative overflow-hidden group"
        >
          <span className="relative z-10">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Continue →"}
          </span>
        </motion.button>
      </Magnetic>
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => { setActiveTab("signup"); setStep("signup"); setError(""); setSuccess(""); }}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          New here? Get started
        </button>
      </div>
    </form>
  );

  // ─── SIGNUP FORM ────────────────────────────────────
  const renderSignup = () => {
    const strength = getPasswordStrength(password);
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleSignup(); }} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="peer w-full rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 pt-5 text-white placeholder-transparent focus:border-emerald-400/60 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
            placeholder=" "
            required
          />
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 peer-focus:text-emerald-400 transition-colors" />
          <label className="absolute left-9 top-2 text-[10px] text-white/30 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-emerald-400/70">
            Full name
          </label>
        </div>
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="peer w-full rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 pt-5 text-white placeholder-transparent focus:border-emerald-400/60 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
            placeholder=" "
            required
          />
          <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 peer-focus:text-emerald-400 transition-colors" />
          <label className="absolute left-9 top-2 text-[10px] text-white/30 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-emerald-400/70">
            Email address
          </label>
        </div>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="peer w-full rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 pt-5 text-white placeholder-transparent focus:border-emerald-400/60 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
            placeholder=" "
            required
          />
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 peer-focus:text-emerald-400 transition-colors" />
          <label className="absolute left-9 top-2 text-[10px] text-white/30 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-emerald-400/70">
            Create password
          </label>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {password && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span>Strength: </span><span className="font-medium">{strength.label}</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
              <motion.div
                className={cn(
                  "h-full",
                  strength.score === 0 && "bg-red-400",
                  strength.score === 1 && "bg-yellow-400",
                  strength.score === 2 && "bg-blue-400",
                  strength.score === 3 && "bg-emerald-400"
                )}
                initial={{ width: 0 }}
                animate={{ width: ["25%", "50%", "75%", "100%"][strength.score] }}
              />
            </div>
            <ul className="mt-2 space-y-1 text-xs text-white/30">
              {[
                { text: "At least 8 characters", check: password.length >= 8 },
                { text: "Uppercase & lowercase", check: /[A-Z]/.test(password) && /[a-z]/.test(password) },
                { text: "Number", check: /\d/.test(password) },
                { text: "Symbol", check: /[^A-Za-z0-9]/.test(password) },
              ].map((item, idx) => (
                <li key={idx} className={cn("flex items-center gap-1.5", item.check && "text-emerald-400")}>
                  <CheckCircle2 className="w-3 h-3" /> {item.text}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
        <Magnetic strength={0.25}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-3 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 text-sm relative overflow-hidden group"
          >
            <span className="relative z-10">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create Account →"}
            </span>
          </motion.button>
        </Magnetic>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => { setActiveTab("login"); setStep("login"); setError(""); setSuccess(""); }}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            Already have an account? Welcome back
          </button>
        </div>
      </form>
    );
  };

  const TrustBadges = () => (
    <div className="flex flex-col items-center gap-3 mt-4 pt-4 border-t border-white/5">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-400/60" />
          <span className="text-[10px] text-white/25">End-to-End Encrypted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" />
          <span className="text-[10px] text-white/25">SOC2 Ready</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Fingerprint className="w-3.5 h-3.5 text-emerald-400/60" />
          <span className="text-[10px] text-white/25">Enterprise Security</span>
        </div>
      </div>
    </div>
  );

  const SocialButtons = () => (
    <div className="space-y-2.5">
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
        <div className="relative flex justify-center">
          <span className="bg-[#0a0a0a] px-3 text-[10px] text-white/20 tracking-wider uppercase">or continue with</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={handleGoogleLogin} className="flex items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.08] py-2.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </button>
        <button type="button" onClick={handleGithubLogin} className="flex items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.08] py-2.5">
          <svg className="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.38 1.235-3.22-.123-.3-.535-1.52.117-3.16 0 0 1.008-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.29-1.552 3.297-1.23 3.297-1.23.653 1.64.24 2.86.118 3.16.768.84 1.233 1.91 1.233 3.22 0 4.61-2.804 5.62-5.476 5.92.43.37.824 1.102.824 2.22 0 1.602-.015 2.894-.015 3.287 0 .322.216.694.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        </button>
        <button type="button" onClick={handleMicrosoftLogin} className="flex items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.08] py-2.5">
          <Briefcase className="w-4 h-4 text-white/60" />
        </button>
      </div>
    </div>
  );

  const FeatureHighlights = () => (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: showFeatures ? "auto" : 0 }}
      className="overflow-hidden"
    >
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { icon: Code2, label: "AI Code", desc: "Generate, refactor, debug" },
          { icon: BookOpen, label: "Research", desc: "Never lose context" },
          { icon: BarChart3, label: "Business", desc: "Dashboards & reports" },
        ].map((item, idx) => (
          <div key={idx} className="group rounded-xl bg-white/[0.03] border border-white/5 p-2.5 text-center hover:bg-white/[0.06] transition-all">
            <item.icon className="w-4 h-4 mx-auto text-white/30 group-hover:text-emerald-400/60" />
            <p className="text-[9px] font-medium text-white/40 mt-1">{item.label}</p>
            <p className="text-[8px] text-white/20">{item.desc}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex overflow-hidden relative">
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 h-1 z-50 bg-gradient-to-r from-emerald-400 via-amber-400 to-emerald-400"
          />
        )}
      </AnimatePresence>

      <Background />
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 lg:p-10 relative z-10">
        <div className="w-full max-w-md mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
            <div className="relative rounded-2xl border border-white/6 bg-white/[0.03] backdrop-blur-2xl p-6 md:p-8 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-12 w-12 flex items-center justify-center">
                  <AIIcon size={44} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Vatsa AI</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400/80 uppercase border border-emerald-500/10">
                    <Sparkles className="w-2.5 h-2.5" /> AI Workspace
                  </span>
                </div>
              </div>

              <div className="mb-5">
                <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                  Your AI co‑founder.<br />
                  <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-200 bg-clip-text text-transparent">
                    Code, research, and ship—faster.
                  </span>
                </h2>
                <p className="text-sm text-white/35 mt-1.5">From idea to MVP in hours, not weeks.</p>
              </div>

              <div className="flex rounded-xl bg-white/[0.04] border border-white/6 p-1 mb-5">
                <button onClick={() => { setActiveTab("login"); setStep("login"); setError(""); }} className={cn("flex-1 rounded-lg py-2 text-xs font-medium transition-all", activeTab === "login" ? "bg-white/10 text-white" : "text-white/30")}>
                  Welcome Back
                </button>
                <button onClick={() => { setActiveTab("signup"); setStep("signup"); setError(""); }} className={cn("flex-1 rounded-lg py-2 text-xs font-medium transition-all", activeTab === "signup" ? "bg-white/10 text-white" : "text-white/30")}>
                  Get Started
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mb-4 rounded-xl bg-red-500/10 border border-red-500/15 px-4 py-2.5 text-xs text-red-400/80 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400/60" /> {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                  {step === "login" && renderLogin()}
                  {step === "signup" && renderSignup()}
                </motion.div>
              </AnimatePresence>

              <div className="mt-4">
                <button type="button" onClick={() => setShowFeatures(!showFeatures)}
                  className="flex items-center gap-1.5 text-[10px] text-white/20 hover:text-white/40 mx-auto">
                  <span>{showFeatures ? "Hide" : "Explore"} what you get</span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showFeatures && "rotate-180")} />
                </button>
                {FeatureHighlights()}
              </div>

              {SocialButtons()}
              {TrustBadges()}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="hidden lg:block lg:w-[55%] relative overflow-hidden bg-[#050505]">
        <motion.div className="absolute inset-0" style={{ transform: `translate(${mouse.x * 10}px, ${mouse.y * 10}px)` }}>
          <video ref={videoRef} autoPlay loop muted playsInline className="w-full h-full object-cover" src="/vatsaAi logo.mp4" />
        </motion.div>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-none" />
        <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none z-10">
          <p className="text-2xl md:text-3xl font-bold text-white/80">One AI that understands</p>
          <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
            {[
              { icon: Code2, label: "Code" },
              { icon: BookOpen, label: "Research" },
              { icon: BarChart3, label: "Business" },
              { icon: Bot, label: "Automation" },
              { icon: Layers, label: "Design" },
            ].map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-white/40">
                <item.icon className="w-3.5 h-3.5" /> {item.label}
              </span>
            ))}
          </div>
        </div>
        <div className="absolute top-8 right-8 pointer-events-none z-10">
          <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/5 px-4 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[10px] text-white/40 tracking-wider">LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, User, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw,
  Eye, EyeOff, Loader2, AtSign, Shield, Fingerprint, Sparkles,
  Briefcase, Code2, BookOpen, BarChart3, Bot, Layers, Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Magnetic from "@/components/landing/Magnetic";
import Background from "@/components/landing/Background";
import { useAuthStore } from "@/stores/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type AuthStep =
  | "login" | "signup" | "forgot-email" | "otp"
  | "password" | "reset-password" | "onboarding";

export default function AuthPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [step, setStep] = useState<AuthStep>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [rememberMe, setRememberMe] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [canResend, setCanResend] = useState(true);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [birthMonth, setBirthMonth] = useState<number>(1);
  const [birthYear, setBirthYear] = useState<number>(2000);

  useEffect(() => { router.prefetch("/home"); }, [router]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startTimer = () => {
    setCanResend(false);
    setTimeLeft(60);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); }, []);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
    if (newOtp.every((d) => d !== "") && step === "otp") {
      setTimeout(() => handleOtpVerify(), 100);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0)
      document.getElementById(`otp-${index - 1}`)?.focus();
  };

  const handleSendOtp = async (purpose: "signup" | "reset") => {
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send OTP");
      setOtpSent(true);
      setSuccess(purpose === "reset"
        ? "If an account exists, an OTP has been sent to your email."
        : `OTP sent to ${email}!`);
      setOtp(["", "", "", "", "", ""]);
      startTimer();
      setStep("otp");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setLoading(true); setError(""); setSuccess("");
    const purpose = activeTab === "signup" ? "signup" : "reset";
    try {
      const res = await fetch(`${API_BASE}/auth/otp/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to resend OTP");
      setSuccess("OTP resent successfully!");
      setOtp(["", "", "", "", "", ""]);
      startTimer();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleOtpVerify = async () => {
    const otpCode = otp.join("");
    if (otpCode.length !== 6) { setError("Please enter the full 6-digit OTP."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid OTP");

      if (data.reset_token) {
        setResetToken(data.reset_token);
        setSuccess("OTP verified! Set your new password.");
        setStep("reset-password");
        return;
      }
      if (data.verified && data.verification_token) {
        setVerificationToken(data.verification_token);
        setSuccess("OTP verified! Complete your registration.");
        setStep("password");
        return;
      }
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        if (data.full_name) localStorage.setItem("user_name", data.full_name);
        if (data.user) useAuthStore.getState().setAuth(data.user, data.access_token);
        const done = data.user?.birth_month || data.birth_month || data.profile_completed;
        if (done) router.push("/home");
        else { setShowOnboarding(true); setStep("onboarding"); }
        return;
      }
      throw new Error("Unexpected response");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handlePasswordRegister = async () => {
    if (!fullName.trim()) { setError("Please enter your full name."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, password, verification_token: verificationToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      localStorage.setItem("access_token", data.access_token);
      if (data.full_name) localStorage.setItem("user_name", data.full_name);
      if (data.user) useAuthStore.getState().setAuth(data.user, data.access_token);
      setShowOnboarding(true);
      setStep("onboarding");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ✅ LOGIN — POST only (fallback to /auth/token if placeholder)
  const handlePasswordLogin = async () => {
    if (!email || !password) { setError("Please enter both email and password."); return; }
    setLoading(true); setError("");
    try {
      let res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      let data = await res.json();

      const isPlaceholder =
        typeof data?.message === "string" &&
        data.message.toLowerCase().includes("placeholder");

      if (isPlaceholder) {
        const form = new URLSearchParams();
        form.append("username", email);
        form.append("password", password);
        res = await fetch(`${API_BASE}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        });
        data = await res.json();
      }

      if (!res.ok) throw new Error(data.detail || data.message || "Login failed");
      if (!data.access_token) throw new Error("No token received from server");

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_tier", data.tier || "free");
      if (data.full_name) localStorage.setItem("user_name", data.full_name);
      if (rememberMe) localStorage.setItem("remember_me", "1");
      if (data.user) useAuthStore.getState().setAuth(data.user, data.access_token);

      const done = data.user?.birth_month || data.birth_month || data.profile_completed;
      if (done) router.push("/home");
      else { setShowOnboarding(true); setStep("onboarding"); }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, reset_token: resetToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to reset password");
      setSuccess("Password reset successfully! Please login.");
      setStep("login");
      setPassword("");
      setResetToken("");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleOnboardingComplete = async () => {
    if (!birthMonth || !birthYear) { setError("Please select both month and year."); return; }
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/auth/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ birth_month: birthMonth, birth_year: birthYear }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = (data.detail || "").toLowerCase();
        if (msg.includes("already")) { router.push("/home"); return; }
        throw new Error(data.detail || "Failed to save onboarding data");
      }
      setShowOnboarding(false);
      router.push("/home");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = () => { window.location.href = `${API_BASE}/auth/google/login`; };
  const handleGithubLogin = () => { window.location.href = `${API_BASE}/auth/github/login`; };
  const handleMicrosoftLogin = () => { window.location.href = `${API_BASE}/auth/microsoft/login`; };

  const getPasswordStrength = (pwd: string): { score: 0 | 1 | 2 | 3; label: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return { score: score as 0 | 1 | 2 | 3, label: ["Weak", "Weak", "Medium", "Strong"][score] };
  };

  useEffect(() => {
    if (step === "otp" && !otpSent) queueMicrotask(() => setStep(activeTab === "signup" ? "signup" : "forgot-email"));
    if (step === "reset-password" && !resetToken) queueMicrotask(() => setStep("forgot-email"));
    if (step === "password" && !verificationToken) queueMicrotask(() => setStep("signup"));
    if (step === "onboarding" && !showOnboarding) queueMicrotask(() => setStep("login"));
  }, [step, otpSent, resetToken, verificationToken, showOnboarding, activeTab]);

  // ─── Renders ──────────────────────────────────────────────
  const renderLogin = () => (
    <form onSubmit={(e) => { e.preventDefault(); handlePasswordLogin(); }} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">Email Address</label>
        <div className="relative group">
          <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-10 py-3 text-white placeholder:text-white/20 focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
            placeholder="you@example.com" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">Password</label>
        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
          <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-10 py-3 text-white placeholder:text-white/20 focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
            placeholder="••••••••" />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-white/40 hover:text-white/60 transition-colors">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-400 focus:ring-emerald-400/20 focus:ring-2 focus:ring-offset-0 focus:ring-offset-transparent" />
          Remember me
        </label>
        <button type="button" onClick={() => { setStep("forgot-email"); setError(""); setSuccess(""); }}
          className="text-xs text-white/30 hover:text-emerald-400/70 transition-colors">Forgot password?</button>
      </div>
      <Magnetic strength={0.25}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-3 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-sm">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Continue →"}
        </motion.button>
      </Magnetic>
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={() => { setActiveTab("signup"); setStep("signup"); }}
          className="text-white/30 hover:text-white/60 transition-colors">Create account</button>
      </div>
    </form>
  );

  const renderSignup = () => (
    <form onSubmit={(e) => { e.preventDefault(); handleSendOtp("signup"); }} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">Full Name</label>
        <div className="relative group">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-10 py-3 text-white placeholder:text-white/20 focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
            placeholder="Your full name" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">Email Address</label>
        <div className="relative group">
          <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-10 py-3 text-white placeholder:text-white/20 focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
            placeholder="you@example.com" />
        </div>
      </div>
      <Magnetic strength={0.25}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-3 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-sm">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Send OTP →"}
        </motion.button>
      </Magnetic>
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={() => { setActiveTab("login"); setStep("login"); }}
          className="text-white/30 hover:text-white/60 transition-colors">Back to Login</button>
      </div>
    </form>
  );

  const renderForgotEmail = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Key className="w-6 h-6 text-emerald-400/60" />
          </div>
        </div>
        <h3 className="text-white font-semibold text-lg mb-1">Reset Password</h3>
        <p className="text-sm text-white/50">Enter your email to receive a password reset OTP.</p>
      </div>
      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">Email Address</label>
        <div className="relative group">
          <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-10 py-3 text-white placeholder:text-white/20 focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
            placeholder="you@example.com" />
        </div>
      </div>
      <Magnetic strength={0.25}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => handleSendOtp("reset")} disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-3 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-sm">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Send OTP →"}
        </motion.button>
      </Magnetic>
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={() => { setStep("login"); setError(""); setSuccess(""); }}
          className="text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back to Login
        </button>
      </div>
    </div>
  );

  const renderOtp = () => (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm text-white/50">OTP sent to <span className="text-white font-medium">{email}</span></p>
        <p className="text-xs text-white/30 mt-1">Enter the 6-digit code sent to your email</p>
      </div>
      <div className="flex justify-center gap-2">
        {otp.map((digit, index) => (
          <input key={index} id={`otp-${index}`} type="text" maxLength={1} value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value)}
            onKeyDown={(e) => handleOtpKeyDown(index, e)}
            className="w-11 h-14 text-center text-xl font-bold rounded-xl bg-white/[0.04] border border-white/8 text-white focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300" />
        ))}
      </div>
      <Magnetic strength={0.25}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleOtpVerify} disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-3 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-sm">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify →"}
        </motion.button>
      </Magnetic>
      <div className="flex items-center justify-between text-xs mt-2">
        <span className="text-white/30">
          {!canResend ? (<span>Resend in <span className="text-white/50 font-mono">{formatTime(timeLeft)}</span></span>)
            : (<span className="text-emerald-400/60">OTP expired? Resend now.</span>)}
        </span>
        <button type="button" onClick={handleResendOtp} disabled={!canResend || loading}
          className={cn("flex items-center gap-1.5 transition-colors text-xs",
            canResend && !loading ? "text-white/50 hover:text-white/80" : "text-white/20 cursor-not-allowed")}>
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Resend
        </button>
      </div>
      <div className="flex items-center justify-between text-xs pt-2">
        <button type="button" onClick={() => { setOtpSent(false); setStep(activeTab === "signup" ? "signup" : "forgot-email"); }}
          className="text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <button type="button" onClick={() => { setActiveTab("login"); setStep("login"); }}
          className="text-white/30 hover:text-white/60 transition-colors">Use password instead</button>
      </div>
    </div>
  );

  const renderPassword = () => {
    const strength = getPasswordStrength(password);
    return (
      <form onSubmit={(e) => { e.preventDefault(); handlePasswordRegister(); }} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">Full Name</label>
          <div className="relative group">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-10 py-3 text-white placeholder:text-white/20 focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
              placeholder="Your full name" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">Create Password</label>
          <div className="relative group">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-10 py-3 text-white placeholder:text-white/20 focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
              placeholder="Min 8 characters" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span>Strength: </span><span className="font-medium">{strength.label}</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
                <div className={cn("h-full transition-all duration-300",
                  strength.score === 0 && "w-1/4 bg-red-400",
                  strength.score === 1 && "w-2/4 bg-yellow-400",
                  strength.score === 2 && "w-3/4 bg-blue-400",
                  strength.score === 3 && "w-full bg-emerald-400")} />
              </div>
              <ul className="mt-2 space-y-1 text-xs text-white/30">
                <li className={cn("flex items-center gap-1.5", password.length >= 8 ? "text-emerald-400" : "")}><CheckCircle2 className="w-3 h-3" /> At least 8 characters</li>
                <li className={cn("flex items-center gap-1.5", /[A-Z]/.test(password) && /[a-z]/.test(password) ? "text-emerald-400" : "")}><CheckCircle2 className="w-3 h-3" /> Uppercase & lowercase</li>
                <li className={cn("flex items-center gap-1.5", /\d/.test(password) ? "text-emerald-400" : "")}><CheckCircle2 className="w-3 h-3" /> Number</li>
                <li className={cn("flex items-center gap-1.5", /[^A-Za-z0-9]/.test(password) ? "text-emerald-400" : "")}><CheckCircle2 className="w-3 h-3" /> Symbol</li>
              </ul>
            </div>
          )}
        </div>
        <Magnetic strength={0.25}>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-3 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-sm">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create Account →"}
          </motion.button>
        </Magnetic>
        <div className="flex items-center justify-between text-xs">
          <button type="button" onClick={() => setStep("otp")}
            className="text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <button type="button" onClick={() => { setActiveTab("login"); setStep("login"); }}
            className="text-white/30 hover:text-white/60 transition-colors">Already have an account?</button>
        </div>
      </form>
    );
  };

  const renderResetPassword = () => (
    <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }} className="space-y-4">
      <div className="text-center mb-2">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400/60" />
          </div>
        </div>
        <h3 className="text-white font-semibold text-lg mb-1">Set New Password</h3>
        <p className="text-sm text-white/50">Create a new password for <span className="text-white font-medium">{email}</span></p>
      </div>
      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">New Password</label>
        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
          <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-10 py-3 text-white placeholder:text-white/20 focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm"
            placeholder="Min 8 characters" />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <Magnetic strength={0.25}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-3 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-sm">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Reset Password →"}
        </motion.button>
      </Magnetic>
      <div className="flex items-center justify-center text-xs">
        <button type="button" onClick={() => { setStep("login"); setError(""); setSuccess(""); setPassword(""); }}
          className="text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back to Login
        </button>
      </div>
    </form>
  );

  const renderOnboarding = () => (
    <div className="space-y-5">
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <User className="w-6 h-6 text-emerald-400/60" />
          </div>
        </div>
        <h3 className="text-white font-semibold text-lg mb-1">Welcome to Vatsa AI</h3>
        <p className="text-sm text-white/50">Tell us a bit about yourself (one time only).</p>
      </div>
      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">Birth Month</label>
        <select value={birthMonth} onChange={(e) => setBirthMonth(Number(e.target.value))}
          className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 text-white focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m} className="bg-[#0a0a0a]">
              {new Date(2000, m - 1, 1).toLocaleString("default", { month: "long" })}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-white/50 block mb-1.5 tracking-wide uppercase">Birth Year</label>
        <select value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))}
          className="w-full rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 text-white focus:border-emerald-400/40 focus:outline-none focus:bg-white/[0.06] transition-all duration-300 text-sm">
          {Array.from({ length: new Date().getFullYear() - 1950 + 1 }, (_, i) => 1950 + i).reverse().map((y) => (
            <option key={y} value={y} className="bg-[#0a0a0a]">{y}</option>
          ))}
        </select>
      </div>
      <Magnetic strength={0.25}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleOnboardingComplete} disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-3 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-sm">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Continue →"}
        </motion.button>
      </Magnetic>
    </div>
  );

  const TrustBadges = () => (
    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
      <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400/60" /><span className="text-[10px] text-white/25 tracking-wide">End-to-End Encrypted</span></div>
      <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" /><span className="text-[10px] text-white/25 tracking-wide">SOC2 Ready</span></div>
      <div className="flex items-center gap-1.5"><Fingerprint className="w-3.5 h-3.5 text-emerald-400/60" /><span className="text-[10px] text-white/25 tracking-wide">Enterprise Security</span></div>
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
        <Magnetic strength={0.2}>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }} type="button" onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.08] py-2.5 transition-all duration-300 w-full">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </motion.button>
        </Magnetic>
        <Magnetic strength={0.2}>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }} type="button" onClick={handleGithubLogin}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.08] py-2.5 transition-all duration-300 w-full">
            <svg className="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.38 1.235-3.22-.123-.3-.535-1.52.117-3.16 0 0 1.008-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.29-1.552 3.297-1.23 3.297-1.23.653 1.64.24 2.86.118 3.16.768.84 1.233 1.91 1.233 3.22 0 4.61-2.804 5.62-5.476 5.92.43.37.824 1.102.824 2.22 0 1.602-.015 2.894-.015 3.287 0 .322.216.694.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </motion.button>
        </Magnetic>
        <Magnetic strength={0.2}>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }} type="button" onClick={handleMicrosoftLogin}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.08] py-2.5 transition-all duration-300 w-full">
            <Briefcase className="w-4 h-4 text-white/60" />
          </motion.button>
        </Magnetic>
      </div>
      <p className="text-center text-[10px] text-white/15 tracking-wide">
        By continuing, you agree to our <span className="text-white/25 hover:text-white/40 transition-colors cursor-pointer">Terms</span> and <span className="text-white/25 hover:text-white/40 transition-colors cursor-pointer">Privacy Policy</span>
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex overflow-hidden relative">
      <Background />
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 lg:p-10 relative z-10">
        <div className="w-full max-w-md mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="relative">
            <div className="relative rounded-2xl border border-white/6 bg-white/[0.03] backdrop-blur-2xl p-6 md:p-8 shadow-2xl shadow-black/50">
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-amber-500/10 blur-xl -z-10" />
              <div className="flex items-center gap-3 mb-5">
                <div className="relative">
                  <div className="h-12 w-12 flex items-center justify-center">
                    <Image src="/logo.png" alt="Vatsa AI" width={48} height={48} className="object-contain drop-shadow-lg" priority />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Vatsa AI</h1>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400/80 tracking-wider uppercase border border-emerald-500/10">
                      <Sparkles className="w-2.5 h-2.5" /> AI Workspace
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight tracking-tight">
                  Build. Think. Create.<br />
                  <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-amber-200 bg-clip-text text-transparent">With One AI.</span>
                </h2>
                <p className="text-sm text-white/35 mt-1.5 leading-relaxed">
                  Your intelligent AI workspace for coding, research, writing, and business.
                </p>
              </div>

              {(step === "login" || step === "signup") && (
                <div className="flex rounded-xl bg-white/[0.04] border border-white/6 p-1 mb-5">
                  <button type="button" onClick={() => { setActiveTab("login"); setStep("login"); setError(""); setSuccess(""); }}
                    className={cn("flex-1 rounded-lg py-2 text-xs font-medium transition-all duration-300",
                      activeTab === "login" ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/50")}>Login</button>
                  <button type="button" onClick={() => { setActiveTab("signup"); setStep("signup"); setError(""); setSuccess(""); }}
                    className={cn("flex-1 rounded-lg py-2 text-xs font-medium transition-all duration-300",
                      activeTab === "signup" ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/50")}>Sign Up</button>
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="mb-4 rounded-xl bg-red-500/10 border border-red-500/15 px-4 py-2.5 text-xs text-red-400/80 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400/60" />{error}
                  </motion.div>
                )}
                {success && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/15 px-4 py-2.5 text-xs text-emerald-400/80 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400/60" />{success}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                  {step === "login" && renderLogin()}
                  {step === "signup" && renderSignup()}
                  {step === "forgot-email" && renderForgotEmail()}
                  {step === "otp" && renderOtp()}
                  {step === "password" && renderPassword()}
                  {step === "reset-password" && renderResetPassword()}
                  {step === "onboarding" && renderOnboarding()}
                </motion.div>
              </AnimatePresence>

              {(step === "login" || step === "signup") && (<>{SocialButtons()}{TrustBadges()}</>)}
            </div>

            <div className="mt-4 text-center">
              <p className="text-[10px] text-white/10 tracking-widest uppercase flex items-center justify-center gap-3">
                <span className="w-8 h-px bg-white/5" />The Future of Intelligent Work<span className="w-8 h-px bg-white/5" />
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="hidden lg:block lg:w-[55%] relative overflow-hidden bg-[#050505]">
        <video ref={videoRef} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" src="/vatsaAi logo.mp4" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-none" />
        <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }}>
            <p className="text-2xl md:text-3xl font-bold text-white/80 tracking-tight">One AI that understands</p>
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-white/40"><Code2 className="w-3.5 h-3.5" /> Code</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-white/40"><BookOpen className="w-3.5 h-3.5" /> Research</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-white/40"><BarChart3 className="w-3.5 h-3.5" /> Business</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-white/40"><Bot className="w-3.5 h-3.5" /> Automation</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-white/40"><Layers className="w-3.5 h-3.5" /> Design</span>
            </div>
          </motion.div>
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
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-emerald-500/5 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-amber-500/5 blur-3xl pointer-events-none" />
      </div>
    </div>
  );
}
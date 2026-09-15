"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // <-- added for client-side navigation
import {
  Mail, Lock, Eye, EyeOff, User, Calendar, Shield, ArrowRight,
  Check, X, Sun, Moon, Palette, Type
} from "lucide-react";

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"];
  const idx = Math.min(4, score);
  return { score: idx, label: labels[idx], color: colors[idx] };
}

const COMMON_PASSWORDS = [
  "password123", "12345678", "qwerty123", "letmein123", "welcome123",
  "admin123", "passw0rd", "123456789", "password1", "iloveyou1"
];

export default function SignUpPage() {
  const router = useRouter();

  const [darkMode, setDarkMode] = useState(true);
  const [accentColor, setAccentColor] = useState("primary");
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");
  const [showAppearance, setShowAppearance] = useState(false);

  const accentMap: Record<string, string> = {
    primary: "primary-600 hover:primary-700",
    indigo: "indigo-600 hover:indigo-700",
    emerald: "emerald-600 hover:emerald-700",
    rose: "rose-600 hover:rose-700",
  };
  const accentBg = accentMap[accentColor] || accentMap.primary;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>("dummy-token"); // Turnstile removed

  const checkUsername = useCallback((name: string) => {
    void debounce(async (value: string) => {
      if (value.length < 3) {
        setUsernameAvailable(null);
        setErrors((prev) => ({ ...prev, username: "" }));
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        setUsernameAvailable(false);
        setErrors((prev) => ({ ...prev, username: "Only letters, numbers and underscores" }));
        return;
      }
      setUsernameChecking(true);
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
        const data = await res.json();
        setUsernameAvailable(data.available);
        if (!data.available) {
          setErrors((prev) => ({ ...prev, username: "Username already taken" }));
        } else {
          setErrors((prev) => ({ ...prev, username: "" }));
        }
      } catch {
        setUsernameAvailable(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 300)(name);
  }, []);

  useEffect(() => { checkUsername(username); }, [username, checkUsername]);

  const checkEmail = useCallback((emailAddr: string) => {
    void debounce(async (value: string) => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setEmailAvailable(null);
        setErrors((prev) => ({ ...prev, email: "" }));
        return;
      }
      setEmailChecking(true);
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(value)}`);
        const data = await res.json();
        setEmailAvailable(data.available);
        if (!data.available) {
          setErrors((prev) => ({ ...prev, email: "Email already registered" }));
        } else {
          setErrors((prev) => ({ ...prev, email: "" }));
        }
      } catch {
        setEmailAvailable(null);
      } finally {
        setEmailChecking(false);
      }
    }, 300)(emailAddr);
  }, []);

  useEffect(() => { checkEmail(email); }, [email, checkEmail]);

  const strength = getPasswordStrength(password);
  const passwordChecks = [
    { label: "12+ characters", met: password.length >= 12 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(password) },
    { label: "Not a common password", met: !COMMON_PASSWORDS.includes(password.toLowerCase()) },
    { label: "Not containing username/email", met: (() => {
      const lowerPass = password.toLowerCase();
      if (username && lowerPass.includes(username.toLowerCase())) return false;
      if (email && lowerPass.includes(email.split("@")[0].toLowerCase())) return false;
      return true;
    })() },
  ];

  const validateDateOfBirth = (dob: string): string | undefined => {
    if (!dob) return "Date of birth is required";
    const date = new Date(dob);
    if (isNaN(date.getTime())) return "Invalid date";
    if (date > new Date()) return "Date cannot be in the future";
    const age = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 13) return "You must be at least 13 years old";
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";

    if (!username) newErrors.username = "Username is required";
    else if (username.length < 3 || username.length > 20) newErrors.username = "3–20 characters";
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) newErrors.username = "Letters, numbers, underscores only";
    else if (usernameAvailable === false) newErrors.username = "Username already taken";

    const dobError = validateDateOfBirth(dateOfBirth);
    if (dobError) newErrors.dateOfBirth = dobError;

    if (!email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Invalid email";
    else if (emailAvailable === false) newErrors.email = "Email already registered";

    if (!password) newErrors.password = "Password is required";
    else {
      if (password.length < 12) newErrors.password = "Minimum 12 characters";
      else if (!/[A-Z]/.test(password)) newErrors.password = "Missing uppercase letter";
      else if (!/[a-z]/.test(password)) newErrors.password = "Missing lowercase letter";
      else if (!/[0-9]/.test(password)) newErrors.password = "Missing number";
      else if (!/[^A-Za-z0-9]/.test(password)) newErrors.password = "Missing special character";
      else if (COMMON_PASSWORDS.includes(password.toLowerCase())) newErrors.password = "Too common";
      else if (username && password.toLowerCase().includes(username.toLowerCase()))
        newErrors.password = "Cannot contain username";
      else if (email && password.toLowerCase().includes(email.split("@")[0].toLowerCase()))
        newErrors.password = "Cannot contain email";
    }

    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords don't match";
    if (!agreedToTerms) newErrors.terms = "You must agree to the terms";
    if (!captchaToken) newErrors.captcha = "Please complete the security check";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username,
          dateOfBirth,
          email,
          password,
          confirmPassword,
          captchaToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ general: data.message || "Sign up failed" });
        setCaptchaToken("dummy-token");
        return;
      }
      router.push("/auth/verify-email-sent?email=" + encodeURIComponent(email));
    } catch {
      setErrors({ general: "Network error. Please try again." });
      setCaptchaToken("dummy-token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center px-4 py-12 transition-colors",
      darkMode
        ? "bg-zinc-950 text-zinc-100"
        : "bg-gradient-to-b from-primary-50/30 to-white text-zinc-900"
    )}>
      <div className="w-full max-w-md relative">
        <div className="absolute top-0 right-0 z-10">
          <button
            onClick={() => setShowAppearance(!showAppearance)}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Appearance settings"
          >
            <Palette className="w-5 h-5" />
          </button>
          {showAppearance && (
            <div className="absolute right-0 mt-2 w-60 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Theme</span>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
              <div>
                <span className="text-sm font-medium block mb-2">Accent Color</span>
                <div className="flex gap-2">
                  {["primary", "indigo", "emerald", "rose"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setAccentColor(c)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2",
                        `bg-${c}-500`,
                        accentColor === c ? "border-white ring-2 ring-offset-2 ring-zinc-400" : "border-transparent"
                      )}
                      aria-label={`Accent ${c}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium block mb-2">Font Size</span>
                <div className="flex gap-2">
                  {(["sm", "base", "lg"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={cn(
                        "px-3 py-1 text-sm rounded-lg border",
                        fontSize === size
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                          : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      )}
                    >
                      {size === "sm" ? "S" : size === "base" ? "M" : "L"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", `bg-${accentColor}-600`)}>
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className={cn("text-2xl font-bold", darkMode ? "text-zinc-100" : "text-zinc-900")}>
              Vatsa AI
            </span>
          </div>
          <h1 className={cn("font-bold", fontSize === "sm" ? "text-lg" : fontSize === "lg" ? "text-3xl" : "text-2xl")}>
            Create your account
          </h1>
          <p className={cn("mt-1", darkMode ? "text-zinc-400" : "text-zinc-500", fontSize === "sm" ? "text-xs" : "text-sm")}>
            Start your AI journey today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-2">
              <X className="w-4 h-4 flex-shrink-0" />
              {errors.general}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className={cn("block font-medium mb-1.5", darkMode ? "text-zinc-300" : "text-zinc-700", fontSize === "sm" ? "text-xs" : "text-sm")}>
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2",
                  errors.firstName ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 dark:border-zinc-700 focus:ring-primary-500/20 focus:border-primary-500",
                  fontSize === "sm" ? "text-xs" : fontSize === "lg" ? "text-lg" : "text-sm"
                )}
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
            </div>
            <div>
              <label htmlFor="lastName" className={cn("block font-medium mb-1.5", darkMode ? "text-zinc-300" : "text-zinc-700", fontSize === "sm" ? "text-xs" : "text-sm")}>
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2",
                  errors.lastName ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 dark:border-zinc-700 focus:ring-primary-500/20 focus:border-primary-500",
                  fontSize === "sm" ? "text-xs" : fontSize === "lg" ? "text-lg" : "text-sm"
                )}
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="username" className={cn("block font-medium mb-1.5", darkMode ? "text-zinc-300" : "text-zinc-700", fontSize === "sm" ? "text-xs" : "text-sm")}>
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                placeholder="johndoe"
                className={cn(
                  "w-full pl-10 pr-10 py-2.5 rounded-lg border bg-white dark:bg-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2",
                  errors.username || usernameAvailable === false
                    ? "border-red-500 focus:ring-red-500/20"
                    : usernameAvailable === true
                    ? "border-green-500 focus:ring-green-500/20"
                    : "border-zinc-300 dark:border-zinc-700 focus:ring-primary-500/20 focus:border-primary-500",
                  fontSize === "sm" ? "text-xs" : fontSize === "lg" ? "text-lg" : "text-sm"
                )}
              />
              {usernameChecking && (
                <svg className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {!usernameChecking && usernameAvailable === true && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              )}
              {!usernameChecking && usernameAvailable === false && (
                <X className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
              )}
            </div>
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
            {!errors.username && usernameAvailable === true && (
              <p className="mt-1 text-xs text-green-600">Username available</p>
            )}
            {!errors.username && usernameAvailable === false && (
              <p className="mt-1 text-xs text-red-500">Username already taken</p>
            )}
          </div>

          <div>
            <label htmlFor="dob" className={cn("block font-medium mb-1.5", darkMode ? "text-zinc-300" : "text-zinc-700", fontSize === "sm" ? "text-xs" : "text-sm")}>
              Date of Birth
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 rounded-lg border bg-white dark:bg-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2",
                  errors.dateOfBirth ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 dark:border-zinc-700 focus:ring-primary-500/20 focus:border-primary-500",
                  fontSize === "sm" ? "text-xs" : fontSize === "lg" ? "text-lg" : "text-sm"
                )}
              />
            </div>
            {errors.dateOfBirth && <p className="mt-1 text-xs text-red-500">{errors.dateOfBirth}</p>}
          </div>

          <div>
            <label htmlFor="email" className={cn("block font-medium mb-1.5", darkMode ? "text-zinc-300" : "text-zinc-700", fontSize === "sm" ? "text-xs" : "text-sm")}>
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={cn(
                  "w-full pl-10 pr-10 py-2.5 rounded-lg border bg-white dark:bg-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2",
                  errors.email || emailAvailable === false
                    ? "border-red-500 focus:ring-red-500/20"
                    : emailAvailable === true
                    ? "border-green-500 focus:ring-green-500/20"
                    : "border-zinc-300 dark:border-zinc-700 focus:ring-primary-500/20 focus:border-primary-500",
                  fontSize === "sm" ? "text-xs" : fontSize === "lg" ? "text-lg" : "text-sm"
                )}
              />
              {emailChecking && (
                <svg className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {!emailChecking && emailAvailable === true && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              )}
              {!emailChecking && emailAvailable === false && (
                <X className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
              )}
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            {!errors.email && emailAvailable === true && (
              <p className="mt-1 text-xs text-green-600">Email available</p>
            )}
            {!errors.email && emailAvailable === false && (
              <p className="mt-1 text-xs text-red-500">Email already registered</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className={cn("block font-medium mb-1.5", darkMode ? "text-zinc-300" : "text-zinc-700", fontSize === "sm" ? "text-xs" : "text-sm")}>
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  "w-full pl-10 pr-10 py-2.5 rounded-lg border bg-white dark:bg-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2",
                  errors.password ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 dark:border-zinc-700 focus:ring-primary-500/20 focus:border-primary-500",
                  fontSize === "sm" ? "text-xs" : fontSize === "lg" ? "text-lg" : "text-sm"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password ? (
              <p className="mt-1 text-xs text-red-500">{errors.password}</p>
            ) : password.length > 0 ? (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", strength.color)}
                      style={{ width: `${((strength.score + 1) / 5) * 100}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-medium", strength.color.replace("bg-", "text-"))}>
                    {strength.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {passwordChecks.map((check) => (
                    <div key={check.label} className="flex items-center gap-1 text-xs">
                      {check.met ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-zinc-400" />
                      )}
                      <span className={check.met ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-500"}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <label htmlFor="confirmPassword" className={cn("block font-medium mb-1.5", darkMode ? "text-zinc-300" : "text-zinc-700", fontSize === "sm" ? "text-xs" : "text-sm")}>
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 rounded-lg border bg-white dark:bg-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2",
                  errors.confirmPassword ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 dark:border-zinc-700 focus:ring-primary-500/20 focus:border-primary-500",
                  fontSize === "sm" ? "text-xs" : fontSize === "lg" ? "text-lg" : "text-sm"
                )}
              />
            </div>
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
            {confirmPassword && password === confirmPassword && !errors.confirmPassword && (
              <p className="mt-1 text-xs text-green-600">Passwords match</p>
            )}
          </div>

          {/* -------- Terms Checkbox (updated with Link) -------- */}
          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-zinc-300 dark:border-zinc-600 text-primary-600 focus:ring-primary-500"
              />
              <span className={cn(darkMode ? "text-zinc-400" : "text-zinc-600", fontSize === "sm" ? "text-xs" : "text-sm")}>
                I agree to the{" "}
                <Link href="/terms" className="text-primary-600 hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary-600 hover:underline">
                  Privacy Policy
                </Link>
              </span>
            </label>
            {errors.terms && <p className="mt-1 text-xs text-red-500">{errors.terms}</p>}
          </div>

          {/* Turnstile removed – dummy token already set */}
          {errors.captcha && <p className="text-xs text-red-500 text-center">{errors.captcha}</p>}

          {/* -------- Submit button (disabled if loading or terms not agreed) -------- */}
          <button
            type="submit"
            disabled={loading || !agreedToTerms}
            className={cn(
              "w-full py-2.5 px-4 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
              `bg-${accentColor}-600 text-white ${accentBg}`,
              fontSize === "sm" ? "text-xs" : fontSize === "lg" ? "text-lg" : "text-sm"
            )}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white dark:bg-zinc-950 text-zinc-500">OR sign up with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => window.location.href = "/api/auth/google/redirect"}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>

        <p className={cn("text-center mt-6", darkMode ? "text-zinc-400" : "text-zinc-500", fontSize === "sm" ? "text-xs" : "text-sm")}>
          Already have an account?{" "}
          <a href="/auth/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium">
            Sign In
          </a>
        </p>

        <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-zinc-400 dark:text-zinc-500">
          <Shield className="w-3.5 h-3.5" />
          Enterprise-grade security
        </div>
      </div>
    </div>
  );
}


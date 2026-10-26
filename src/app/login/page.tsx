"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation, Mail, Lock, Eye, EyeOff } from "lucide-react";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<'email' | 'password' | 'both' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorField(null);
    setLoading(true);

    if (!navigator.onLine) {
      setError("Please check your internet connection and try again.");
      setErrorField('both');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const code = data.code;
        if (code === 'USER_NOT_FOUND') {
          setErrorField('email');
          setError(data.error);
        } else if (code === 'WRONG_PASSWORD') {
          setErrorField('password');
          setError(data.error);
        } else {
          setErrorField('both');
          setError(data.error || 'Login failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Save user & token to localStorage for client-side API calls
      const userToStore = { ...data.user };
      localStorage.removeItem('customer_default_location');
      localStorage.setItem('user', JSON.stringify(userToStore));
      if (data.token) {
        localStorage.setItem('token', data.token);
        document.cookie = `token=${data.token}; path=/; SameSite=Lax; max-age=${7 * 24 * 60 * 60}`;
      }

      proceedToDashboard(data.user);
    } catch (err: any) {
      console.error(err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Please check your internet connection and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setErrorField('both');
      setLoading(false);
    }
  };

  const proceedToDashboard = (user: any) => {
    if (user.role === "PLATFORM_OWNER") {
      window.location.href = "/platform-admin/dashboard";
    } else if (user.role === "BUSINESS_OWNER" || user.role === "ADMIN" || user.role === "EMPLOYEE") {
      window.location.href = "/admin/dashboard";
    } else if (user.role === "DELIVERY_PARTNER") {
      window.location.href = "/partner/dashboard";
    } else if (user.role === "DRIVER") {
      window.location.href = "/driver";
    } else if (user.role === "CUSTOMER") {
      window.location.href = "/customer";
    } else {
      window.location.href = "/admin/dashboard";
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <Navigation size={24} color="#ffffff" />
          </div>
          <span className={styles.brandName}>GETDelivery</span>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Sign in to your GETDelivery account</p>
        </div>

        {/* Global Error Banner */}
        {error && errorField === 'both' && (
          <div className={styles.error}>{error}</div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className={styles.form}>
          
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>
              Email or Mobile Number
            </label>
            <div className={styles.inputWrapper}>
              <Mail size={16} className={styles.inputIcon} />
              <input
                id="username"
                type="text"
                className={styles.input}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorField === 'email') {
                    setErrorField(null);
                    setError('');
                  }
                }}
                required
                placeholder="Enter your email or mobile number"
                autoComplete="username"
                style={errorField === 'email' || errorField === 'both' ? { borderColor: '#ef4444' } : {}}
              />
            </div>
            {errorField === 'email' && (
              <p className={styles.fieldError}>{error}</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <div className={styles.inputWrapper}>
              <Lock size={16} className={styles.inputIcon} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={`${styles.input} ${styles.inputWithToggle}`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorField === 'password') {
                    setErrorField(null);
                    setError('');
                  }
                }}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                style={errorField === 'password' || errorField === 'both' ? { borderColor: '#ef4444' } : {}}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.toggleBtn}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errorField === 'password' && (
              <p className={styles.fieldError}>{error}</p>
            )}
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <div className={styles.footer}>
          <div>
            Don&apos;t have an account?{' '}
            <Link href="/register" className={styles.link}>
              Register here
            </Link>
          </div>
          <div>
            <Link href="/" className={styles.backLink}>
              Go back
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}

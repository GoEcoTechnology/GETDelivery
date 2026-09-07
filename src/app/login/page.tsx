"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<'email' | 'password' | 'both' | null>(null);
  const [loading, setLoading] = useState(false);

  const [userData, setUserData] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorField(null);
    setLoading(true);

    // Detect no internet before even trying
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

      // Save user AND token to localStorage for client-side API calls
      const userToStore = { ...data.user };
      localStorage.setItem('user', JSON.stringify(userToStore));
      if (data.token) {
        localStorage.setItem('token', data.token);
        // Also write as a non-httpOnly cookie for the server-side proxy to read
        // (the httpOnly cookie is already set by the server, this is the fallback)
        document.cookie = `token=${data.token}; path=/; SameSite=Lax; max-age=${7 * 24 * 60 * 60}`;
      }
      setUserData(data.user);

      proceedToDashboard(data.user);
    } catch (err: any) {
      console.error(err);
      // TypeError usually means a network failure (fetch itself couldn't connect)
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
      window.location.href = "/partner/orders";
    } else if (user.role === "DRIVER") {
      window.location.href = "/driver";
    } else {
      window.location.href = "/admin/dashboard";
    }
  };

  return (
    <main className={styles.container}>

      <form onSubmit={handleLogin} className={`${styles.card} glass`}>
        <div>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.label} style={{ textAlign: "center" }}>
            Sign in to your GETDelivery account
          </p>
        </div>

        {error && errorField === 'both' && <div className={styles.error}>{error}</div>}

        <div className={styles.formGroup}>
          <label htmlFor="username" className={styles.label}>
            Email or Mobile Number
          </label>
          <input
            id="username"
            type="text"
            className={styles.input}
            value={username}
            onChange={(e) => { setUsername(e.target.value); if (errorField === 'email') { setErrorField(null); setError(''); } }}
            required
            placeholder="Enter your email or mobile number"
            style={errorField === 'email' || errorField === 'both' ? { borderColor: '#ef4444' } : {}}
          />
          {errorField === 'email' && (
            <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0 0' }}>{error}</p>
          )}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (errorField === 'password') { setErrorField(null); setError(''); } }}
            required
            placeholder="••••••••"
            style={errorField === 'password' || errorField === 'both' ? { borderColor: '#ef4444' } : {}}
          />
          {errorField === 'password' && (
            <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0 0' }}>{error}</p>
          )}
        </div>

        <button
          type="submit"
          className={`btn btn-primary ${styles.submitBtn}`}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div style={{ textAlign: 'center', fontSize: 14, color: '#64748b', marginTop: 8 }}>
          Don&apos;t have an account?{' '}
          <a href="/register" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>Register here</a>
        </div>
        <div style={{ textAlign: 'center', fontSize: 14, color: '#64748b', marginTop: -20 }}>
          <a href="/" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}> Go back  </a>
        </div>
      </form>
    </main>
  );
}

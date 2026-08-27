"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [userData, setUserData] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "Login failed");
      }

      // Save user to localStorage so client-side layouts know who is logged in
      localStorage.setItem('user', JSON.stringify(data.user));
      setUserData(data.user);

      proceedToDashboard(data.user);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  const proceedToDashboard = (user: any) => {
    if (user.role === "PLATFORM_OWNER") {
      router.push("/platform-admin/dashboard");
    } else if (user.role === "BUSINESS_OWNER" || user.role === "ADMIN") {
      router.push("/admin/dashboard");
    } else if (user.role === "DELIVERY_PARTNER") {
      router.push("/partner/orders");
    } else {
      router.push("/dashboard");
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

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.formGroup}>
          <label htmlFor="username" className={styles.label}>
            Email or Mobile Number
          </label>
          <input
            id="username"
            type="text"
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Enter your email or mobile number"
          />
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
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className={`btn btn-primary ${styles.submitBtn}`}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}

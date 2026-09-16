"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({ initialMode = "register", loginOnly = false }: { initialMode?: "login" | "register"; loginOnly?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", civicAddress: "" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json();
    if (!response.ok) return setError(body.error);
    router.push("/dashboard");
  }
  return <main className="auth-page"><section className="auth-card"><span className="eyebrow">Form P / landlord signing portal</span><h1>{mode === "register" ? "Create your homeowner account." : "Sign tenant leases securely."}</h1><p>Log in to review tenant-completed PDFs and add your landlord signature to the lease application.</p><form onSubmit={submit} className="auth-form">{mode === "register" && <><label>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Address<textarea value={form.civicAddress} onChange={(event) => setForm({ ...form, civicAddress: event.target.value })} /></label></>}<label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>{error && <p className="error-message">{error}</p>}<button className="primary-button" type="submit">{mode === "register" ? "Create account" : "Log in to sign"}<span>→</span></button></form>{!loginOnly && <button className="secondary-button" type="button" onClick={() => setMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "Already have an account? Log in" : "Need an account? Register"}</button>}</section></main>;
}
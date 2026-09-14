"use client";

import Link from "next/link";
import { useState } from "react";
import SignaturePad from "@/components/signature-pad";

type Lease = { id: string; status: string; createdAt: string; landlordSignedAt: string | null; tenants: { id: string; name: string; email: string; signedAt: string | null; isMinor: boolean }[] };

export default function Dashboard({ landlordName, leases }: { landlordName: string; leases: Lease[] }) {
  const [signature, setSignature] = useState(""), [message, setMessage] = useState("");
  async function sign(leaseId: string) {
    const response = await fetch(`/api/landlord/leases/${leaseId}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureData: signature }) });
    const body = await response.json();
    setMessage(response.ok ? "Homeowner signature saved." : body.error);
  }
  return <main className="dashboard-page"><header className="dashboard-header"><div><span className="eyebrow">Homeowner dashboard</span><h1>Good morning, {landlordName}.</h1><p>Review tenant progress and finish your signature when the application is ready.</p></div><Link className="secondary-button" href="/">Start new application</Link></header><div className="dashboard-list">{leases.length === 0 && <div className="dashboard-empty">No applications yet.</div>}{leases.map((lease) => <article className="dashboard-card" key={lease.id}><div className="dashboard-card-head"><div><span className="eyebrow">Application {lease.id.slice(-6)}</span><h2>{lease.status.replaceAll("_", " ")}</h2></div><span className="date-label">{new Date(lease.createdAt).toLocaleDateString()}</span></div><div className="tenant-progress">{lease.tenants.map((tenant) => <div className="tenant-row" key={tenant.id}><div><strong>{tenant.name}</strong><span>{tenant.email}</span></div><span className={tenant.isMinor ? "role-tag occupant" : tenant.signedAt ? "role-tag" : "role-tag occupant"}>{tenant.isMinor ? "Occupant" : tenant.signedAt ? "Signed" : "Pending"}</span></div>)}</div>{!lease.landlordSignedAt && <div className="homeowner-sign"><h3>Your signature</h3><SignaturePad initialSignature={null} onSave={setSignature} /><button className="primary-button" type="button" disabled={!signature} onClick={() => sign(lease.id)}>Sign application <span>→</span></button></div>}{message && <p className="review-message">{message}</p>}</article>)}</div></main>;
}
"use client";

import { FormEvent, useMemo, useState } from "react";

const sections = [
  ["1", "Parties & property", "Identify the landlord, property, and lease basics."],
  ["2", "Tenants & occupants", "Add each person who will live in the property."],
  ["3", "Term of lease", "Set the start date, end date, and renewal terms."],
  ["9", "Rent", "Record the rent amount, due date, and payment method."],
  ["11B", "Services", "Clarify utilities, services, and responsibilities."],
  ["13", "Deposits", "Capture deposits, fees, and return conditions."],
  ["16", "Repairs", "Describe maintenance requests and repair responsibilities."],
  ["17", "Insurance", "Add insurance expectations and coverage details."],
  ["18", "Rules", "Set building rules, pets, smoking, and use restrictions."],
  ["19", "Entry", "Define notice and access preferences for the property."],
  ["22", "Termination", "Document notice periods and early termination terms."],
  ["23", "Additional terms", "Add any terms specific to this agreement."],
  ["26", "Sign & review", "Review the lease and invite adult tenants to sign."],
] as const;

type Tenant = { firstName: string; lastName: string; email: string; phone: string; dateOfBirth: string; isMinor: boolean };
type SectionData = Record<string, Record<string, string>>;
type SigningLink = { tenantId: string; name: string; phone: string | null; url: string; pending: boolean };
const emptyTenant: Tenant = { firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "", isMinor: false };

function getAge(dateOfBirth: string) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00`), today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export default function LeaseWizard() {
  const [step, setStep] = useState(0);
  const [sectionsData, setSectionsData] = useState<SectionData>({});
  const [landlord, setLandlord] = useState({ name: "", email: "", phone: "", civicAddress: "", password: "" });
  const [tenants, setTenants] = useState<Tenant[]>([{ ...emptyTenant }]);
  const [result, setResult] = useState<{ leaseId: string; signingLinks: SigningLink[] } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notificationState, setNotificationState] = useState<Record<string, string>>({});
  const [sectionId, title, prompt] = sections[step];
  const adultCount = useMemo(() => tenants.filter((tenant) => !tenant.isMinor && tenant.dateOfBirth).length, [tenants]);

  function updateSection(field: string, value: string) {
    setSectionsData((current) => ({ ...current, [sectionId]: { ...current[sectionId], [field]: value } }));
  }

  function updateTenant(index: number, field: keyof Tenant, value: string) {
    setTenants((current) => current.map((tenant, tenantIndex) => {
      if (tenantIndex !== index) return tenant;
      const updated = { ...tenant, [field]: value };
      if (field === "dateOfBirth") updated.isMinor = (getAge(value) ?? 18) < 18;
      return updated;
    }));
  }

  function validateStep() {
    if (step === 0 && (!landlord.name || !landlord.email || landlord.password.length < 8)) return "Add your name, email, and a password of at least 8 characters to continue.";
    if (step === 1 && tenants.some((tenant) => !tenant.firstName || !tenant.lastName || !tenant.email || !tenant.dateOfBirth || (!tenant.isMinor && !tenant.phone))) return "Complete every person and add a phone number for each adult tenant.";
    return "";
  }

  function next() {
    const message = validateStep();
    if (message) return setError(message);
    setError("");
    setStep((current) => Math.min(current + 1, sections.length - 1));
  }

  async function resendNotifications(link: SigningLink) {
    setNotificationState((current) => ({ ...current, [link.tenantId]: "Sending..." }));
    try {
      const response = await fetch("/api/notifications/resend-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: link.tenantId }) });
      const body = await response.json();
      if (!response.ok && !body.channels) throw new Error(body.error);
      const sentChannels = body.channels?.filter((channel: { sent: boolean }) => channel.sent).map((channel: { channel: string }) => channel.channel.toUpperCase()) ?? [];
      const failedChannels = body.channels?.filter((channel: { sent: boolean }) => !channel.sent).map((channel: { channel: string; error?: string }) => `${channel.channel.toUpperCase()}: ${channel.error ?? "failed"}`) ?? [];
      setNotificationState((current) => ({ ...current, [link.tenantId]: sentChannels.length ? `Sent via ${sentChannels.join(" + ")}${failedChannels.length ? ` · ${failedChannels.join(" · ")}` : ""}` : failedChannels.join(" · ") }));
    } catch (notificationError) {
      setNotificationState((current) => ({ ...current, [link.tenantId]: notificationError instanceof Error ? notificationError.message : "Unable to send" }));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = validateStep();
    if (message) return setError(message);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/leases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ landlord, sections: sectionsData, tenants }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to save this lease.");
    } finally {
      setSaving(false);
    }
  }

  if (result) return <section className="success-panel"><span className="eyebrow">Lease saved</span><h1>Your lease is ready for signatures.</h1><p>Share each private signing link directly, or use the fallback to send it through SMS and WhatsApp.</p><div className="link-list">{result.signingLinks.map((link) => <div className="signing-link" key={link.url}><div><strong>{link.name}</strong><span>{link.phone || "No phone number"}</span><small>{link.pending ? "Pending signature" : "Signed"}</small></div><div className="link-actions"><button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${link.url}`)}>Copy link</button>{link.pending && <button type="button" className="notify-button" disabled={!link.phone || notificationState[link.tenantId] === "Sending..."} onClick={() => resendNotifications(link)}>{notificationState[link.tenantId] || "Send via WhatsApp/SMS"}</button>}</div></div>)}</div><p className="muted">Occupants under 18 are recorded on the lease without signing rights.</p></section>;

  return <main className="wizard-shell"><aside className="sidebar"><div className="brand-mark">P</div><span className="eyebrow">Form P / 2026</span><h1>Build a lease that feels clear.</h1><p className="sidebar-copy">Move through the agreement one calm decision at a time. You can go back and revise anything before saving.</p><div className="progress-list">{sections.map(([id, sectionTitle], index) => <button type="button" className={index === step ? "progress-item active" : index < step ? "progress-item complete" : "progress-item"} onClick={() => index <= step && setStep(index)} key={id}><span>{id}</span><strong>{sectionTitle}</strong></button>)}</div></aside><section className="form-panel"><header className="form-header"><div><span className="eyebrow">Section {sectionId} / {sections.length}</span><h2>{title}</h2><p>{prompt}</p></div><span className="save-state">Draft · saved locally</span></header><form onSubmit={submit}><div className="form-content">{step === 0 && <div className="field-grid"><label>Full name<input value={landlord.name} onChange={(event) => setLandlord({ ...landlord, name: event.target.value })} placeholder="Alex Morgan" /></label><label>Email<input type="email" value={landlord.email} onChange={(event) => setLandlord({ ...landlord, email: event.target.value })} placeholder="alex@example.com" /></label><label>Phone<input value={landlord.phone} onChange={(event) => setLandlord({ ...landlord, phone: event.target.value })} placeholder="(555) 014-2026" /></label><label>Account password<input type="password" value={landlord.password} onChange={(event) => setLandlord({ ...landlord, password: event.target.value })} placeholder="At least 8 characters" /></label><label className="full-width">Civic address<textarea value={landlord.civicAddress} onChange={(event) => setLandlord({ ...landlord, civicAddress: event.target.value })} placeholder="123 Cedar Street, Halifax, NS" /></label></div>}{step === 1 && <div className="tenant-section"><div className="tenant-intro"><div><h3>Who will live here?</h3><p>Adults receive a private signing link. Children and other minors are recorded as occupants without signing rights.</p></div><span className="count-pill">{adultCount} signing {adultCount === 1 ? "tenant" : "tenants"}</span></div>{tenants.map((tenant, index) => { const age = getAge(tenant.dateOfBirth); return <div className="tenant-card" key={index}><div className="tenant-card-head"><span className={tenant.isMinor ? "role-tag occupant" : "role-tag tenant"}>{tenant.isMinor ? "Occupant" : "Tenant"}</span>{tenants.length > 1 && <button type="button" className="remove-button" onClick={() => setTenants((current) => current.filter((_, tenantIndex) => tenantIndex !== index))}>Remove</button>}</div><div className="field-grid"><label>First name<input value={tenant.firstName} onChange={(event) => updateTenant(index, "firstName", event.target.value)} /></label><label>Last name<input value={tenant.lastName} onChange={(event) => updateTenant(index, "lastName", event.target.value)} /></label><label>Email<input type="email" value={tenant.email} onChange={(event) => updateTenant(index, "email", event.target.value)} /></label><label>Phone<input type="tel" value={tenant.phone} onChange={(event) => updateTenant(index, "phone", event.target.value)} placeholder="+1 555 014 2026" /></label><label>Date of birth<input type="date" value={tenant.dateOfBirth} onChange={(event) => updateTenant(index, "dateOfBirth", event.target.value)} />{age !== null && <small>{age} years old · {tenant.isMinor ? "No signing rights" : "Will receive a signing link"}</small>}</label></div></div>})}<button type="button" className="add-button" onClick={() => setTenants((current) => [...current, { ...emptyTenant }])}>+ Add another person</button></div>}{step > 1 && <div className="field-grid"><label className="full-width">Notes for Section {sectionId}<textarea value={sectionsData[sectionId]?.notes ?? ""} onChange={(event) => updateSection("notes", event.target.value)} placeholder="Add the details that should appear in this section..." /></label><label>Primary term<input value={sectionsData[sectionId]?.primaryTerm ?? ""} onChange={(event) => updateSection("primaryTerm", event.target.value)} placeholder="Enter a value" /></label><label>Additional detail<input value={sectionsData[sectionId]?.detail ?? ""} onChange={(event) => updateSection("detail", event.target.value)} placeholder="Optional" /></label></div>}<div className="review-strip"><span className="review-dot" /><span>{step === sections.length - 1 ? `${adultCount} adult signing link${adultCount === 1 ? "" : "s"} will be generated on submit.` : "Your answers are kept in this draft until you submit."}</span></div>{error && <p className="error-message">{error}</p>}</div><footer className="form-footer">{step > 0 ? <button type="button" className="secondary-button" onClick={() => setStep((current) => current - 1)}>Back</button> : <span />}{step < sections.length - 1 ? <button type="button" className="primary-button" onClick={next}>Continue <span>→</span></button> : <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save lease & invite tenants"} <span>→</span></button>}</footer></form></section></main>;
}

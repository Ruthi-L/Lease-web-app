"use client";

import { FormEvent, useState } from "react";
import SignaturePad from "@/components/signature-pad";

type LeaseSections = Record<string, Record<string, unknown>>;

type TenantSigningFormProps = {
  token: string;
  leaseCreatedAt: string;
  tenant: { firstName: string; initial: string; lastName: string; email: string; phone: string; dateOfBirth: string; signedAt: string | null; signatureData: string | null };
  leaseSections: LeaseSections;
};

function sectionValue(sections: LeaseSections, section: string, key: string) {
  return String(sections[section]?.[key] ?? "");
}

export default function TenantSigningForm({ token, leaseCreatedAt, tenant, leaseSections }: TenantSigningFormProps) {
  const [form, setForm] = useState({
    firstName: tenant.firstName,
    initial: tenant.initial,
    lastName: tenant.lastName,
    email: tenant.email,
    phone: tenant.phone,
    dateOfBirth: tenant.dateOfBirth,
    otherOccupants: sectionValue(leaseSections, "2", "otherOccupants"),
    emergencyContactName: "",
    emergencyContactPhone: "",
    serviceEmail: tenant.email,
    leaseType: sectionValue(leaseSections, "8", "leaseType") || sectionValue(leaseSections, "11", "leaseType"),
    periodicFrequency: sectionValue(leaseSections, "8A", "frequency") || sectionValue(leaseSections, "11", "frequency"),
    startDate: sectionValue(leaseSections, "8A", "startDate") || sectionValue(leaseSections, "8", "startDate"),
    endDate: sectionValue(leaseSections, "8B", "endDate") || sectionValue(leaseSections, "11", "endDate"),
    acknowledgeTruth: false,
    acknowledgeElectronicDelivery: false,
    acknowledgeAgreement: false,
    acknowledgeActCopy: false,
    acknowledgeSignedLeaseCopy: false,
    acknowledgeBuildingRules: false,
    signatureData: tenant.signatureData ?? "",
  });
  const [status, setStatus] = useState(tenant.signedAt ? "signed" : "editing");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field: keyof typeof form, nextValue: string | boolean) {
    setForm((current) => ({ ...current, [field]: nextValue }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/tenant/sign/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setStatus("signed");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to save your signature.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "signed") return <main className="signing-page"><section className="signing-card confirmation-card"><span className="eyebrow">Signature received and locked</span><h1>Thank you, {tenant.firstName}.</h1><p>Your tenant details and signature are securely saved. The landlord will receive the completed agreement when all adult tenants have signed.</p><div className="confirmation-meta"><span>Tenant</span><strong>{tenant.firstName} {tenant.lastName}</strong><span>Submitted</span><strong>{tenant.signedAt ? new Date(tenant.signedAt).toLocaleDateString() : "Just now"}</strong></div></section></main>;

  return <main className="signing-page"><section className="signing-card"><header className="signing-header"><span className="eyebrow">Private tenant signing</span><h1>Review and sign your lease.</h1><p>Hi {tenant.firstName}. Complete your Form P sections below, review the homeowner PDF, then draw your signature. This link is unique to you.</p><a className="pdf-review-link" href={`/api/tenant/sign/${token}/pdf`} target="_blank" rel="noreferrer">Review homeowner-completed lease PDF</a><span className="lease-date">Lease started {new Date(leaseCreatedAt).toLocaleDateString()}</span></header><form onSubmit={submit} className="signing-form">
    <section className="signing-section"><span className="section-number">01</span><div><h2>Section 1 · Your details</h2><p>Confirm the name, contact details, and date of birth that identify you as a tenant.</p><div className="field-grid"><label>First name<input required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label><label>Initial<input value={form.initial} onChange={(event) => update("initial", event.target.value)} /></label><label>Last name<input required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label><label>Email<input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label><label>Phone<input required value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label><label>Date of birth<input required type="date" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} /></label></div></div></section>
    <section className="signing-section"><span className="section-number">02</span><div><h2>Section 2 · Occupants</h2><p>Only those tenants and occupants named are allowed to live in the premises without written consent of the landlord. Adults 18 or older are tenants; anyone under 18 is an occupant.</p><label>Other adults or children occupying the premises<textarea value={form.otherOccupants} onChange={(event) => update("otherOccupants", event.target.value)} /></label></div></section>
    <section className="signing-section"><span className="section-number">03</span><div><h2>Section 4 · Emergency contact</h2><p>Provide a person who can be contacted in an emergency.</p><div className="field-grid"><label>Full name<input required value={form.emergencyContactName} onChange={(event) => update("emergencyContactName", event.target.value)} /></label><label>Phone number<input required value={form.emergencyContactPhone} onChange={(event) => update("emergencyContactPhone", event.target.value)} /></label></div></div></section>
    <section className="signing-section"><span className="section-number">04</span><div><h2>Sections 7A/7B · Electronic service</h2><p>Electronic service is optional and applies only when the address is current and the parties agree to use it for documents under Section 15 of the Act.</p><label>Email for electronic service<input required type="email" value={form.serviceEmail} onChange={(event) => update("serviceEmail", event.target.value)} /></label></div></section>
    <section className="signing-section"><span className="section-number">05</span><div><h2>Section 8 · Lease type</h2><div className="field-grid"><label>Lease type<select required value={form.leaseType} onChange={(event) => update("leaseType", event.target.value)}><option value="">Select</option><option value="Periodic">8A · Periodic lease</option><option value="Fixed-term">8B · Fixed-term lease</option></select></label><label>Start date<input required type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>{form.leaseType === "Periodic" && <label>Frequency<select required value={form.periodicFrequency} onChange={(event) => update("periodicFrequency", event.target.value)}><option value="">Select</option><option value="Year-to-year">Year-to-year</option><option value="Month-to-month">Month-to-month</option><option value="Week-to-week">Week-to-week</option></select></label>}{form.leaseType === "Fixed-term" && <label>End date<input required type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>}</div>{form.leaseType === "Fixed-term" && <p className="statutory-copy">A fixed-term lease ends on the date stated in this agreement. It does not automatically renew unless the landlord and tenant agree in writing.</p>}</div></section>
    <section className="signing-section"><span className="section-number">06</span><div><h2>Section 26 · Attachments and acknowledgments</h2><p>Confirm what you received before signing.</p><label className="check-row"><input type="checkbox" checked={form.acknowledgeTruth} onChange={(event) => update("acknowledgeTruth", event.target.checked)} /> I confirm that the information I provided is true and complete.</label><label className="check-row"><input type="checkbox" checked={form.acknowledgeElectronicDelivery} onChange={(event) => update("acknowledgeElectronicDelivery", event.target.checked)} /> I agree to electronic service at the email above.</label><label className="check-row"><input type="checkbox" checked={form.acknowledgeActCopy} onChange={(event) => update("acknowledgeActCopy", event.target.checked)} /> I received or was given access to the Residential Tenancies Act.</label><label className="check-row"><input type="checkbox" checked={form.acknowledgeSignedLeaseCopy} onChange={(event) => update("acknowledgeSignedLeaseCopy", event.target.checked)} /> I will receive a signed copy of this lease.</label><label className="check-row"><input type="checkbox" checked={form.acknowledgeBuildingRules} onChange={(event) => update("acknowledgeBuildingRules", event.target.checked)} /> I received the building rules, if applicable.</label><label className="check-row"><input type="checkbox" checked={form.acknowledgeAgreement} onChange={(event) => update("acknowledgeAgreement", event.target.checked)} /> I have reviewed the lease terms and agree to sign electronically.</label></div></section>
    <section className="signing-section signature-section"><span className="section-number">07</span><div><h2>Your digital signature</h2><p>Your signature is timestamped when submitted and your form inputs become locked.</p><SignaturePad initialSignature={tenant.signatureData} onSave={(signatureData) => update("signatureData", signatureData)} />{error && <p className="error-message">{error}</p>}<button type="submit" className="primary-button submit-signature" disabled={saving || !form.signatureData}>{saving ? "Submitting..." : "Submit signed lease"} <span>→</span></button></div></section>
  </form></section></main>;
}

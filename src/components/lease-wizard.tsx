"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FormPSectionPage from "@/components/form-p-section-page";

type Tenant = {
  firstName: string;
  initial: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  isMinor: boolean;
};

type SectionState = Record<string, string | boolean | string[] | undefined>;
type SigningLink = { tenantId: string; name: string; phone: string | null; url: string; pending: boolean };

type LandlordState = {
  firstName: string;
  initial: string;
  lastName: string;
  name: string;
  email: string;
  password: string;
  phoneHome: string;
  phoneBusiness: string;
  civicAddress: string;
  mailingAddress: string;
};

const emptyTenant: Tenant = {
  firstName: "",
  initial: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  isMinor: false,
};

const stepMeta = [
  { id: "1", page: "landlord", title: "Section 1 · Landlord", prompt: "Enter the landlord details and service contact information." },
  { id: "1T", page: "tenants", title: "Section 1 · Tenants", prompt: "Add every tenant together. Adult tenants receive signing links." },
  { id: "2", page: "occupants", title: "Section 2 · Occupants", prompt: "Name everyone else who will live in the premises." },
  { id: "3", page: "premises", title: "Section 3 · Premises", prompt: "Describe the rental property and tenant contact address." },
  { id: "4", page: "emergency", title: "Section 4 · Emergency contact", prompt: "Add next-of-kin and emergency contact details." },
  { id: "5-6", page: "contacts", title: "Sections 5–6 · Property contacts", prompt: "Add the property manager, agent, and building superintendent." },
  { id: "7A", page: "service", title: "Section 7A · Electronic service", prompt: "Enter the landlord address for electronic service under the Act." },
  { id: "8", page: "lease", title: "Section 8 · Lease type", prompt: "Choose periodic 8A or fixed-term 8B and complete its dates." },
  { id: "9", page: "housing", title: "Section 9 · Public housing", prompt: "Record public housing status and program eligibility." },
  { id: "10", page: "rent", title: "Section 10 · Rent", prompt: "Set rent, payment method, due date, and late-fee terms." },
  { id: "11", page: "rentIncrease", title: "Section 11 · Rent increases", prompt: "Review the statutory restrictions and notice periods." },
  { id: "13", page: "services", title: "Section 13 · Services", prompt: "Select included appliances, utilities, and tenant responsibilities." },
  { id: "16", page: "inspection", title: "Section 16 · Inspection report", prompt: "Record the inspection report status." },
  { id: "17", page: "conditions", title: "Section 17 · Statutory conditions", prompt: "Record statutory conditions and building rules." },
  { id: "18", page: "arrears", title: "Section 18 · Rental arrears", prompt: "Review the statutory 15-day arrears notice policy." },
  { id: "19", page: "notice", title: "Section 19 · Tenant notice to quit", prompt: "Record the tenant notice-to-quit rules." },
  { id: "26", page: "attachments", title: "Section 26 · Attachments", prompt: "Confirm receipt of the Act, signed lease, and building rules." },
  { id: "Review", title: "Review & Submit", prompt: "Confirm the lease is complete and ready to send for signature." },
] as const;

const defaultFormData: Record<string, SectionState> = {
  section1: {},
  section2: {},
  section3: {},
  section4: {},
  section5: {},
  section6: {},
  section7: {},
  section8: {},
  section9: {},
  section11: {},
  section12: {},
  section13: {},
  section15: {},
  section16: {},
  section18: {},
  section19: {},
  section23: {},
  section26: {},
};

function getAge(dateOfBirth: string) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age -= 1;
  return age;
}

function getTenantRole(dateOfBirth: string) {
  const age = getAge(dateOfBirth);
  return age !== null && age >= 18 ? "Tenant" : "Occupant";
}

export default function LeaseWizard() {
  const [step, setStep] = useState(0);
  const [landlord, setLandlord] = useState<LandlordState>({
    firstName: "",
    initial: "",
    lastName: "",
    name: "",
    email: "",
    password: "",
    phoneHome: "",
    phoneBusiness: "",
    civicAddress: "",
    mailingAddress: "",
  });
  const [tenants, setTenants] = useState<Tenant[]>([{ ...emptyTenant }]);
  const [formData, setFormData] = useState<Record<string, SectionState>>(defaultFormData);
  const [result, setResult] = useState<{ leaseId: string; signingLinks: SigningLink[] } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notificationState, setNotificationState] = useState<Record<string, string>>({});
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((body: { authenticated?: boolean; landlord?: { name: string; email: string } | null }) => {
        setAuthenticated(Boolean(body.authenticated));
        if (body.landlord) setLandlord((current) => ({ ...current, name: current.name || body.landlord?.name || "", email: current.email || body.landlord?.email || "" }));
      })
      .catch(() => setAuthenticated(false));
  }, []);

  const adultCount = useMemo(() => tenants.filter((tenant) => !tenant.isMinor && tenant.dateOfBirth).length, [tenants]);
  const currentStep = stepMeta[step];

  function updateFormValue(section: string, key: string, value: string | boolean | string[] | undefined) {
    setFormData((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  }

  function updateTenant(index: number, field: keyof Tenant, value: string) {
    setTenants((current) => current.map((tenant, tenantIndex) => {
      if (tenantIndex !== index) return tenant;
      const nextTenant = { ...tenant, [field]: value };
      if (field === "dateOfBirth") {
        nextTenant.isMinor = (getAge(value) ?? 18) < 18;
      }
      return nextTenant;
    }));
  }

  function addTenant() {
    setTenants((current) => [...current, { ...emptyTenant }]);
  }

  function removeTenant(index: number) {
    setTenants((current) => (current.length === 1 ? current : current.filter((_, tenantIndex) => tenantIndex !== index)));
  }

  function setLandlordName() {
    const fullName = [landlord.firstName, landlord.initial, landlord.lastName].filter(Boolean).join(" ");
    setLandlord((current) => ({ ...current, name: fullName }));
  }

  function validateStep() {
    if (step === 0) {
      if (!landlord.name || !landlord.email || (!authenticated && landlord.password.length < 8)) {
        return authenticated ? "Add the landlord name and email." : "Add the landlord name, email, and a password with at least 8 characters.";
      }
    }

    if (step === 1) {
      if (!tenants.length) return "Add at least one tenant or occupant.";
      const invalidTenant = tenants.some((tenant) => !tenant.firstName || !tenant.lastName || !tenant.email || !tenant.dateOfBirth || (!tenant.isMinor && !tenant.phone));
      if (invalidTenant) return "Complete the full name, email, DOB, and phone for each adult tenant.";
    }

    if (step === 2) {
      if (!formData.section2?.otherOccupants) return "List the other adults or children who will occupy the premises, or enter None.";
    }

    if (step === 3 && !formData.section3?.premisesAddress) {
      return "Add the rental premises address before continuing.";
    }

    return "";
  }

  function next() {
    const message = validateStep();
    if (message) return setError(message);
    setError("");
    setStep((current) => Math.min(current + 1, stepMeta.length - 1));
  }

  async function resendNotifications(link: SigningLink) {
    setNotificationState((current) => ({ ...current, [link.tenantId]: "Sending..." }));
    try {
      const response = await fetch("/api/notifications/resend-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: link.tenantId }) });
      const body = await response.json();
      if (!response.ok && !body.channels) throw new Error(body.error ?? "Unable to send notifications.");
      const sent = body.channels?.filter((channel: { sent: boolean }) => channel.sent).map((channel: { channel: string }) => channel.channel.toUpperCase()) ?? [];
      const failed = body.channels?.filter((channel: { sent: boolean }) => !channel.sent).map((channel: { channel: string; error?: string }) => `${channel.channel.toUpperCase()}: ${channel.error ?? "failed"}`) ?? [];
      setNotificationState((current) => ({
        ...current,
        [link.tenantId]: sent.length ? `Sent via ${sent.join(" + ")}${failed.length ? ` · ${failed.join(" · ")}` : ""}` : failed.join(" · "),
      }));
    } catch (notificationError) {
      setNotificationState((current) => ({
        ...current,
        [link.tenantId]: notificationError instanceof Error ? notificationError.message : "Unable to send",
      }));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = validateStep();
    if (message) return setError(message);
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          landlord: {
            ...landlord,
            name: landlord.name || [landlord.firstName, landlord.initial, landlord.lastName].filter(Boolean).join(" "),
          },
          sections: formData,
          tenants: tenants.map((tenant) => ({
            ...tenant,
            isMinor: tenant.isMinor,
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save lease.");
      setResult(body);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to save this lease.");
    } finally {
      setSaving(false);
    }
  }

  function renderStepContent() {
    if (step === stepMeta.length - 1) return renderLegacyStepContent();
    const currentPage = stepMeta[step];
    if (!("page" in currentPage)) return renderLegacyStepContent();
    return <FormPSectionPage page={currentPage.page} landlord={landlord} setLandlord={setLandlord} tenants={tenants} updateTenant={updateTenant} addTenant={addTenant} removeTenant={removeTenant} formData={formData} updateFormValue={updateFormValue} />;
  }

  function renderLegacyStepContent() {
    if (step === 0) {
      return (
        <div className="field-grid">
          <label>
            First name
            <input value={landlord.firstName} onChange={(event) => {
              const next = { ...landlord, firstName: event.target.value };
              setLandlord(next);
              setLandlordName();
            }} />
          </label>
          <label>
            Initial
            <input value={landlord.initial} onChange={(event) => {
              const next = { ...landlord, initial: event.target.value };
              setLandlord(next);
              setLandlordName();
            }} />
          </label>
          <label>
            Last name
            <input value={landlord.lastName} onChange={(event) => {
              const next = { ...landlord, lastName: event.target.value };
              setLandlord(next);
              setLandlordName();
            }} />
          </label>
          <label>
            Home phone
            <input value={landlord.phoneHome} onChange={(event) => setLandlord((current) => ({ ...current, phoneHome: event.target.value }))} />
          </label>
          <label>
            Business / other phone
            <input value={landlord.phoneBusiness} onChange={(event) => setLandlord((current) => ({ ...current, phoneBusiness: event.target.value }))} />
          </label>
          <label>
            Email
            <input type="email" value={landlord.email} onChange={(event) => setLandlord((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Password
            <input type="password" value={landlord.password} onChange={(event) => setLandlord((current) => ({ ...current, password: event.target.value }))} />
          </label>
          <label className="full-width">
            Civic address
            <textarea value={landlord.civicAddress} onChange={(event) => setLandlord((current) => ({ ...current, civicAddress: event.target.value }))} />
          </label>
          <label className="full-width">
            Mailing address
            <textarea value={landlord.mailingAddress} onChange={(event) => setLandlord((current) => ({ ...current, mailingAddress: event.target.value }))} />
          </label>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="tenant-section">
          <div className="tenant-intro">
            <div>
              <h3>Tenants and occupants</h3>
              <p>Adults 18+ are designated as tenants and must sign the lease. Anyone under 18 is recorded as an occupant without signing rights.</p>
            </div>
            <span className="count-pill">{adultCount} adult tenant{adultCount === 1 ? "" : "s"}</span>
          </div>

          {tenants.map((tenant, index) => {
            const role = getTenantRole(tenant.dateOfBirth);
            return (
              <div key={`${tenant.email || "tenant"}-${index}`} className="tenant-card">
                <div className="tenant-card-head">
                  <strong>{tenant.firstName || `Tenant ${index + 1}`}</strong>
                  <span className={`role-tag ${role === "Occupant" ? "occupant" : "tenant"}`}>{role}</span>
                </div>
                <div className="field-grid">
                  <label>
                    First name
                    <input value={tenant.firstName} onChange={(event) => updateTenant(index, "firstName", event.target.value)} />
                  </label>
                  <label>
                    Initial
                    <input value={tenant.initial} onChange={(event) => updateTenant(index, "initial", event.target.value)} />
                  </label>
                  <label>
                    Last name
                    <input value={tenant.lastName} onChange={(event) => updateTenant(index, "lastName", event.target.value)} />
                  </label>
                  <label>
                    Email
                    <input type="email" value={tenant.email} onChange={(event) => updateTenant(index, "email", event.target.value)} />
                  </label>
                  <label>
                    Phone
                    <input value={tenant.phone} onChange={(event) => updateTenant(index, "phone", event.target.value)} />
                  </label>
                  <label>
                    Date of birth
                    <input type="date" value={tenant.dateOfBirth} onChange={(event) => updateTenant(index, "dateOfBirth", event.target.value)} />
                  </label>
                </div>
                {tenants.length > 1 && (
                  <button type="button" className="remove-button" onClick={() => removeTenant(index)}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}

          <button type="button" className="add-button" onClick={addTenant}>+ Add another tenant or occupant</button>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="field-grid">
          <label className="full-width">
            Other occupants list
            <textarea value={String(formData.section2?.otherOccupants ?? "")} onChange={(event) => updateFormValue("section2", "otherOccupants", event.target.value)} placeholder="List all other adults or children who will reside here." />
          </label>
          <label className="full-width">
            Occupancy disclaimer
            <textarea value={String(formData.section2?.occupancyDisclaimer ?? "")} onChange={(event) => updateFormValue("section2", "occupancyDisclaimer", event.target.value)} placeholder="Authorized occupancy, restrictions, and notice of who may live in the unit." />
          </label>
          <label className="full-width">
            Premises civic address
            <textarea value={String(formData.section3?.premisesAddress ?? "")} onChange={(event) => updateFormValue("section3", "premisesAddress", event.target.value)} />
          </label>
          <label>
            Apartment / suite
            <input value={String(formData.section3?.unitNumber ?? "")} onChange={(event) => updateFormValue("section3", "unitNumber", event.target.value)} />
          </label>
          <label>
            Property type
            <select value={String(formData.section3?.propertyType ?? "")} onChange={(event) => updateFormValue("section3", "propertyType", event.target.value)}>
              <option value="">Select</option>
              <option value="Single-family house">Single-family house</option>
              <option value="Apartment">Apartment</option>
              <option value="Duplex">Duplex</option>
              <option value="Condominium">Condominium</option>
              <option value="Mobile home">Mobile home</option>
            </select>
          </label>
          <label>
            Tenant mailing address
            <textarea value={String(formData.section3?.tenantMailingAddress ?? "")} onChange={(event) => updateFormValue("section3", "tenantMailingAddress", event.target.value)} />
          </label>
          <label>
            P.O. Box
            <input value={String(formData.section3?.poBox ?? "")} onChange={(event) => updateFormValue("section3", "poBox", event.target.value)} />
          </label>
          <label>
            Tenant contact numbers
            <textarea value={String(formData.section3?.tenantContactNumbers ?? "")} onChange={(event) => updateFormValue("section3", "tenantContactNumbers", event.target.value)} />
          </label>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="field-grid">
          <label>
            Emergency contact name
            <input value={String(formData.section4?.nextOfKinName ?? "")} onChange={(event) => updateFormValue("section4", "nextOfKinName", event.target.value)} />
          </label>
          <label>
            Emergency contact phone
            <input value={String(formData.section4?.nextOfKinPhone ?? "")} onChange={(event) => updateFormValue("section4", "nextOfKinPhone", event.target.value)} />
          </label>
          <label>
            Agent name
            <input value={String(formData.section5?.agentName ?? "")} onChange={(event) => updateFormValue("section5", "agentName", event.target.value)} />
          </label>
          <label>
            Agent phone
            <input value={String(formData.section5?.agentPhone ?? "")} onChange={(event) => updateFormValue("section5", "agentPhone", event.target.value)} />
          </label>
          <label>
            Agent alternate phone
            <input value={String(formData.section5?.agentAltPhone ?? "")} onChange={(event) => updateFormValue("section5", "agentAltPhone", event.target.value)} />
          </label>
          <label className="full-width">
            Agent address
            <textarea value={String(formData.section5?.agentAddress ?? "")} onChange={(event) => updateFormValue("section5", "agentAddress", event.target.value)} />
          </label>
          <label>
            Property manager name
            <input value={String(formData.section6?.managerName ?? "")} onChange={(event) => updateFormValue("section6", "managerName", event.target.value)} />
          </label>
          <label>
            Property manager phone
            <input value={String(formData.section6?.managerPhone ?? "")} onChange={(event) => updateFormValue("section6", "managerPhone", event.target.value)} />
          </label>
          <label>
            Superintendent name
            <input value={String(formData.section7?.superintendentName ?? "")} onChange={(event) => updateFormValue("section7", "superintendentName", event.target.value)} />
          </label>
          <label>
            Superintendent phone
            <input value={String(formData.section7?.superintendentPhone ?? "")} onChange={(event) => updateFormValue("section7", "superintendentPhone", event.target.value)} />
          </label>
          <label>
            Superintendent emergency phone
            <input value={String(formData.section7?.superintendentEmergencyPhone ?? "")} onChange={(event) => updateFormValue("section7", "superintendentEmergencyPhone", event.target.value)} />
          </label>
          <label className="full-width">
            Superintendent address
            <textarea value={String(formData.section7?.superintendentAddress ?? "")} onChange={(event) => updateFormValue("section7", "superintendentAddress", event.target.value)} />
          </label>
          <label>
            Service email 1
            <input type="email" value={String(formData.section8?.email1 ?? "")} onChange={(event) => updateFormValue("section8", "email1", event.target.value)} />
          </label>
          <label>
            Service email 2
            <input type="email" value={String(formData.section8?.email2 ?? "")} onChange={(event) => updateFormValue("section8", "email2", event.target.value)} />
          </label>
          <label>
            Service email 3
            <input type="email" value={String(formData.section8?.email3 ?? "")} onChange={(event) => updateFormValue("section8", "email3", event.target.value)} />
          </label>
          <label>
            Landlord service email
            <input type="email" value={String(formData.section9?.landlordServiceEmail ?? "")} onChange={(event) => updateFormValue("section9", "landlordServiceEmail", event.target.value)} />
          </label>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div className="field-grid">
          <label>
            Lease type
            <select value={String(formData.section11?.leaseType ?? "")} onChange={(event) => updateFormValue("section11", "leaseType", event.target.value)}>
              <option value="">Select</option>
              <option value="Periodic">11A – Periodic lease</option>
              <option value="Fixed-term">11B – Fixed-term lease</option>
            </select>
          </label>
          <label>
            Start date
            <input type="date" value={String(formData.section11?.startDate ?? "")} onChange={(event) => updateFormValue("section11", "startDate", event.target.value)} />
          </label>
          {formData.section11?.leaseType === "Periodic" && (
            <>
              <label>
                Periodic frequency
                <select value={String(formData.section11?.frequency ?? "")} onChange={(event) => updateFormValue("section11", "frequency", event.target.value)}>
                  <option value="">Select</option>
                  <option value="Year-to-year">Year-to-year</option>
                  <option value="Month-to-month">Month-to-month</option>
                  <option value="Week-to-week">Week-to-week</option>
                </select>
              </label>
              <label>
                Periodic notice details
                <textarea value={String(formData.section11?.periodicNotes ?? "")} onChange={(event) => updateFormValue("section11", "periodicNotes", event.target.value)} />
              </label>
            </>
          )}
          {formData.section11?.leaseType === "Fixed-term" && (
            <>
              <label>
                End date
                <input type="date" value={String(formData.section11?.endDate ?? "")} onChange={(event) => updateFormValue("section11", "endDate", event.target.value)} />
              </label>
              <label className="full-width">
                Fixed-term notes
                <textarea value={String(formData.section11?.fixedTermNotes ?? "")} onChange={(event) => updateFormValue("section11", "fixedTermNotes", event.target.value)} />
              </label>
            </>
          )}
          <label className="full-width checkbox-row">
            <input type="checkbox" checked={Boolean(formData.section12?.publicHousing)} onChange={(event) => updateFormValue("section12", "publicHousing", event.target.checked ? "yes" : "")} />
            Public housing program
          </label>
          <label className="full-width">
            Schedule reference notes
            <textarea value={String(formData.section12?.scheduleNotes ?? "")} onChange={(event) => updateFormValue("section12", "scheduleNotes", event.target.value)} />
          </label>
          <label>
            Rent amount
            <input value={String(formData.section13?.amount ?? "")} onChange={(event) => updateFormValue("section13", "amount", event.target.value)} />
          </label>
          <label>
            Rent frequency
            <select value={String(formData.section13?.frequency ?? "")} onChange={(event) => updateFormValue("section13", "frequency", event.target.value)}>
              <option value="">Select</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </label>
          <label>
            Payment method
            <select value={String(formData.section13?.paymentMethod ?? "")} onChange={(event) => updateFormValue("section13", "paymentMethod", event.target.value)}>
              <option value="">Select</option>
              <option value="Cash">Cash</option>
              <option value="Pre-authorized automatic withdrawal">Pre-authorized automatic withdrawal</option>
              <option value="Post-dated cheques">Post-dated cheques</option>
              <option value="Cheque">Cheque</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            Due day
            <input value={String(formData.section13?.dueDay ?? "")} onChange={(event) => updateFormValue("section13", "dueDay", event.target.value)} />
          </label>
          <label className="full-width">
            Late fee terms
            <textarea value={String(formData.section13?.lateFeeTerms ?? "")} onChange={(event) => updateFormValue("section13", "lateFeeTerms", event.target.value)} />
          </label>
          <label className="full-width">
            Rental incentives
            <textarea value={String(formData.section15?.incentives ?? "")} onChange={(event) => updateFormValue("section15", "incentives", event.target.value)} />
          </label>
        </div>
      );
    }

    if (step === 5) {
      return (
        <div className="field-grid">
          <label className="full-width">
            Rent includes – appliances
            <textarea value={String(formData.section16?.appliances ?? "")} onChange={(event) => updateFormValue("section16", "appliances", event.target.value)} placeholder="Stove, refrigerator, washer/dryer, dishwasher, furniture" />
          </label>
          <label className="full-width">
            Rent includes – utilities and services
            <textarea value={String(formData.section16?.utilities ?? "")} onChange={(event) => updateFormValue("section16", "utilities", event.target.value)} placeholder="Heat, water, electricity, cable, lawn care, snow removal, garbage, recycling" />
          </label>
          <label className="full-width">
            Rent includes – parking
            <textarea value={String(formData.section16?.parking ?? "")} onChange={(event) => updateFormValue("section16", "parking", event.target.value)} placeholder="Parking spaces and stall numbers" />
          </label>
          <label className="full-width">
            Tenant responsibilities
            <textarea value={String(formData.section16?.tenantResponsibilities ?? "")} onChange={(event) => updateFormValue("section16", "tenantResponsibilities", event.target.value)} placeholder="Tenant insurance, lockout charges, assignment/sublet fees, maintenance responsibility" />
          </label>
          <label className="full-width checkbox-row">
            <input type="checkbox" checked={Boolean(formData.section13?.stove)} onChange={(event) => updateFormValue("section13", "stove", event.target.checked)} />
            Stove included
          </label>
          <label className="full-width checkbox-row">
            <input type="checkbox" checked={Boolean(formData.section13?.refrigerator)} onChange={(event) => updateFormValue("section13", "refrigerator", event.target.checked)} />
            Refrigerator included
          </label>
          <label className="full-width checkbox-row">
            <input type="checkbox" checked={Boolean(formData.section13?.washerDryer)} onChange={(event) => updateFormValue("section13", "washerDryer", event.target.checked)} />
            Washer / dryer included
          </label>
          <label className="full-width checkbox-row">
            <input type="checkbox" checked={Boolean(formData.section13?.dishwasher)} onChange={(event) => updateFormValue("section13", "dishwasher", event.target.checked)} />
            Dishwasher included
          </label>
          <label className="full-width">
            Services excluded from rent
            <textarea value={String(formData.section13?.excludedServices ?? "")} onChange={(event) => updateFormValue("section13", "excludedServices", event.target.value)} placeholder="Heat, water, electricity, parking, Wi-Fi, lawn care, snow removal, garbage" />
          </label>
          <label className="full-width">
            Additional obligations (Section 14)
            <textarea value={String(formData.section14?.additionalObligations ?? "")} onChange={(event) => updateFormValue("section14", "additionalObligations", event.target.value)} />
          </label>
          <label>
            Security deposit required
            <select value={String(formData.section18?.depositRequired ?? "")} onChange={(event) => updateFormValue("section18", "depositRequired", event.target.value)}>
              <option value="">Select</option>
              <option value="Not required">Not required</option>
              <option value="Maximum 1/2 month rent">Maximum 1/2 month rent</option>
            </select>
          </label>
          <label>
            Deposit amount
            <input value={String(formData.section18?.depositAmount ?? "")} onChange={(event) => updateFormValue("section18", "depositAmount", event.target.value)} />
          </label>
          <label>
            Financial institution
            <input value={String(formData.section18?.financialInstitution ?? "")} onChange={(event) => updateFormValue("section18", "financialInstitution", event.target.value)} />
          </label>
          <label>
            Trust account details
            <input value={String(formData.section18?.trustAccountDetails ?? "")} onChange={(event) => updateFormValue("section18", "trustAccountDetails", event.target.value)} />
          </label>
          <label>
            Inspection report status
            <select value={String(formData.section19?.inspectionReport ?? "")} onChange={(event) => updateFormValue("section19", "inspectionReport", event.target.value)}>
              <option value="">Select</option>
              <option value="Attached">Attached</option>
              <option value="Not attached">Not attached</option>
            </select>
          </label>
          <label className="full-width">
            Tenant notice to quit period
            <textarea value={String(formData.section23?.noticeToQuit ?? "")} onChange={(event) => updateFormValue("section23", "noticeToQuit", event.target.value)} />
          </label>
          <label className="full-width">
            Statutory conditions (Section 17)
            <textarea value={String(formData.section17?.statutoryConditions ?? "")} onChange={(event) => updateFormValue("section17", "statutoryConditions", event.target.value)} placeholder="The statutory conditions apply to this lease." />
          </label>
          <label className="full-width checkbox-row">
            <input type="checkbox" checked={Boolean(formData.section17A?.buildingRulesAttached)} onChange={(event) => updateFormValue("section17A", "buildingRulesAttached", event.target.checked)} />
            Building rules attached and provided to tenant
          </label>
          <label>
            Assignment and subletting
            <select value={String(formData.section18?.assignmentTerms ?? "")} onChange={(event) => updateFormValue("section18", "assignmentTerms", event.target.value)}>
              <option value="">Select</option>
              <option value="Permitted with written consent">Permitted with written consent</option>
              <option value="Not permitted except as allowed by law">Not permitted except as allowed by law</option>
            </select>
          </label>
          <label className="full-width">
            Rental arrears rules (Section 19)
            <textarea value={String(formData.section19?.arrearsRules ?? "")} onChange={(event) => updateFormValue("section19", "arrearsRules", event.target.value)} placeholder="The statutory 15-day notice and opportunity to pay apply." />
          </label>
          <label>
            Tenant notice to quit table
            <textarea value={String(formData.section20?.tenantNoticeTable ?? "")} onChange={(event) => updateFormValue("section20", "tenantNoticeTable", event.target.value)} />
          </label>
          <label>
            Landlord notice to quit table
            <textarea value={String(formData.section21?.landlordNoticeTable ?? "")} onChange={(event) => updateFormValue("section21", "landlordNoticeTable", event.target.value)} />
          </label>
          <label className="full-width">
            Binding clauses (Section 22)
            <textarea value={String(formData.section22?.bindingClauses ?? "")} onChange={(event) => updateFormValue("section22", "bindingClauses", event.target.value)} />
          </label>
          <label className="full-width">
            Tenant responsibility disclaimer (Section 23)
            <textarea value={String(formData.section23?.responsibilityDisclaimer ?? "")} onChange={(event) => updateFormValue("section23", "responsibilityDisclaimer", event.target.value)} />
          </label>
          <label>
            Lease signature date
            <input type="date" value={String(formData.section24?.signatureDate ?? "")} onChange={(event) => updateFormValue("section24", "signatureDate", event.target.value)} />
          </label>
          <label className="full-width checkbox-row">
            <input type="checkbox" checked={Boolean(formData.section25?.signedLeaseCopy)} onChange={(event) => updateFormValue("section25", "signedLeaseCopy", event.target.checked)} />
            Signed lease copy will be provided to every tenant
          </label>
          <label className="full-width checkbox-row">
            <input type="checkbox" checked={Boolean(formData.section25?.actCopy)} onChange={(event) => updateFormValue("section25", "actCopy", event.target.checked)} />
            Residential Tenancies Act copy or access provided
          </label>
          <label className="full-width checkbox-row">
            <input type="checkbox" checked={Boolean(formData.section25?.buildingRulesCopy)} onChange={(event) => updateFormValue("section25", "buildingRulesCopy", event.target.checked)} />
            Building rules copy provided
          </label>
          <label className="full-width">
            Statutory acknowledgment
            <textarea value={String(formData.section26?.statutoryConditions ?? "")} onChange={(event) => updateFormValue("section26", "statutoryConditions", event.target.value)} placeholder="The parties acknowledge the lease terms, statutory conditions, and attachments." />
          </label>
          <label>
            Act delivery format
            <select value={String(formData.section26?.deliveryFormat ?? "")} onChange={(event) => updateFormValue("section26", "deliveryFormat", event.target.value)}>
              <option value="">Select</option>
              <option value="Paper copy">Paper copy</option>
              <option value="Electronic copy">Electronic copy</option>
              <option value="Web link">Web link</option>
            </select>
          </label>
        </div>
      );
    }

    if (step === 6) {
      return (
        <div className="summary-layout">
          <div className="summary-card">
            <h3>Landlord</h3>
            <p>{landlord.name || "Landlord name not entered"}</p>
            <p>{landlord.email || "No email"}</p>
            <p>{landlord.phoneHome || landlord.phoneBusiness || "No phone"}</p>
          </div>

          <div className="summary-card">
            <h3>Tenants</h3>
            {tenants.map((tenant, index) => (
              <p key={`${tenant.email || "tenant"}-${index}`}>
                {tenant.firstName || "Tenant"} {tenant.lastName || ""} · {getTenantRole(tenant.dateOfBirth)}
              </p>
            ))}
          </div>

          <div className="summary-card">
            <h3>Premises</h3>
            <p>{String(formData.section3?.premisesAddress ?? "Premises address not entered")}</p>
            <p>{String(formData.section3?.unitNumber ?? "No unit number")}</p>
            <p>{String(formData.section3?.propertyType ?? "No property type")}</p>
          </div>

          <div className="summary-card">
            <h3>Rent</h3>
            <p>{String(formData.section13?.amount ? `$${formData.section13.amount}` : "No rent amount entered")}</p>
            <p>{String(formData.section13?.dueDay ? `Due on ${formData.section13.dueDay}` : "Due date not entered")}</p>
            <p>{String(formData.section11?.leaseType ?? "Lease type not selected")}</p>
          </div>
        </div>
      );
    }

    return null;
  }

  if (result) {
    return (
      <section className="success-panel">
        <span className="eyebrow">Lease saved</span>
        <h1>Your lease is ready for signatures.</h1>
        <p>Share each private signing link directly, or use the fallback to send it through SMS and WhatsApp.</p>
        <div className="link-list">
          {result.signingLinks.map((link) => (
            <div className="signing-link" key={link.url}>
              <div>
                <strong>{link.name}</strong>
                <span>{link.phone || "No phone number"}</span>
                <small>{link.pending ? "Pending signature" : "Signed"}</small>
              </div>
              <div className="link-actions">
                <button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${link.url}`)}>Copy link</button>
                {link.pending && (
                  <button type="button" className="notify-button" disabled={!link.phone || notificationState[link.tenantId] === "Sending..."} onClick={() => resendNotifications(link)}>
                    {notificationState[link.tenantId] || "Send via WhatsApp/SMS"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="muted">Adults 18+ are signatories. Anyone under 18 is recorded as an occupant without signing rights.</p>
      </section>
    );
  }

  return (
    <main className="wizard-shell">
      <aside className="sidebar">
        <div className="brand-mark">P</div>
        <span className="eyebrow">Form P / 2026</span>
        <h1>Build a lease that feels clear.</h1>
        <p className="sidebar-copy">Move through the agreement one calm decision at a time, preserving the official Nova Scotia Form P structure as you go.</p>
        <Link className="sidebar-login-button" href="/landlord/login">Landlord sign-in <span>→</span></Link>

        <div className="progress-list">
          {stepMeta.map((section, index) => (
            <button
              type="button"
              key={section.id}
              className={index === step ? "progress-item active" : index < step ? "progress-item complete" : "progress-item"}
              onClick={() => index <= step && setStep(index)}
            >
              <span>{section.id}</span>
              <strong>{section.title}</strong>
            </button>
          ))}
        </div>
      </aside>

      <section className="form-panel">
        <header className="form-header">
          <div>
            <span className="eyebrow">Section {currentStep.id}</span>
            <h2>{currentStep.title}</h2>
            <p>{currentStep.prompt}</p>
          </div>
          <span className="save-state">Draft · saved locally</span>
        </header>

        <form
          onSubmit={submit}
          onKeyDown={(event) => {
            const isAdvanceKey = event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
            if (isAdvanceKey && step < stepMeta.length - 1) {
              event.preventDefault();
              next();
            }
          }}
        >
          <div className="form-content">
            {renderStepContent()}
            {error && <div className="error-message">{error}</div>}
          </div>

          <footer className="form-footer">
            <button type="button" className="secondary-button" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0}>
              Back
            </button>
            {step < stepMeta.length - 1 ? (
              <button type="button" className="primary-button" onClick={next}>
                Continue <span>→</span>
              </button>
            ) : (
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Saving..." : "Save lease"}
              </button>
            )}
          </footer>
        </form>
      </section>
    </main>
  );
}

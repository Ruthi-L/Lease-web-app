"use client";

import { FormEvent, useMemo, useState } from "react";

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
  { id: "1", title: "Parties", prompt: "Identify the landlord and the people who will be occupying the property." },
  { id: "2-3", title: "Occupants & Premises", prompt: "List the other occupants and describe the rental premises." },
  { id: "4-9", title: "Contacts & Service", prompt: "Capture emergency contacts, agent, building contact, and service emails." },
  { id: "11-16", title: "Lease Type, Rent & Utilities", prompt: "Record the tenancy type, rent, utilities, and incentives." },
  { id: "18-26", title: "Deposits, Acknowledgments & Notices", prompt: "Document deposits, inspections, notice periods, and the statutory acknowledgment." },
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
      if (!landlord.name || !landlord.email || landlord.password.length < 8) {
        return "Add the landlord name, email, and a password with at least 8 characters.";
      }
    }

    if (step === 1) {
      if (!tenants.length) return "Add at least one tenant or occupant.";
      const invalidTenant = tenants.some((tenant) => !tenant.firstName || !tenant.lastName || !tenant.email || !tenant.dateOfBirth || (!tenant.isMinor && !tenant.phone));
      if (invalidTenant) return "Complete the full name, email, DOB, and phone for each adult tenant.";
    }

    if (step === 2) {
      if (!formData.section2?.otherOccupants && !formData.section3?.premisesAddress) {
        return "Add the other occupants and premises address before continuing.";
      }
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
            Statutory acknowledgment
            <textarea value={String(formData.section26?.statutoryConditions ?? "")} onChange={(event) => updateFormValue("section26", "statutoryConditions", event.target.value)} />
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

        <form onSubmit={submit}>
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

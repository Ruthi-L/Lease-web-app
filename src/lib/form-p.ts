export const FORM_P_STATEMENTS = {
  occupants:
    "Only those tenants and occupants named are allowed to live in the premises without written consent of the landlord.",
  electronicService:
    "The landlord and tenant may agree to service of documents by electronic means under Section 15 of the Residential Tenancies Act. An electronic address is optional and must be kept current.",
  fixedTerm:
    "A fixed-term lease ends on the date stated in this agreement. It does not automatically renew unless the landlord and tenant agree in writing.",
  publicHousing:
    "If this is public housing, the tenant must remain eligible under the applicable public housing program. Any required program documents must be attached to this lease.",
  rentIncrease:
    "Rent cannot be increased until at least 12 months after the last increase. The landlord must give the notice period required by the Act: four months for month-to-month or year-to-year leases and eight weeks for week-to-week leases.",
  lateFee:
    "A late fee must not exceed 1% per month of the overdue rent and may only be charged as permitted by the Residential Tenancies Act.",
  securityDeposit:
    "A security deposit must not exceed one-half of one month's rent and must be held and administered in accordance with the Residential Tenancies Act.",
  arrears:
    "For rental arrears, the landlord must provide the notice and statutory opportunity to pay required by the Residential Tenancies Act, including the applicable 15-day period.",
  actCopy:
    "The tenant acknowledges receiving or being given access to a copy of the Residential Tenancies Act and the signed lease.",
} as const;

export type FormPValue = string | boolean | string[];
export type FormPSection = Record<string, FormPValue>;
export type FormPData = Record<string, FormPSection>;

export const FORM_P_SECTION_IDS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "7A",
  "7B",
  "8",
  "8A",
  "8B",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "17A",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
] as const;

export const FORM_P_SECTION_LABELS: Record<string, string> = {
  "1": "Parties",
  "2": "Occupants",
  "3": "Premises",
  "4": "Emergency contact",
  "5": "Property manager or agent",
  "6": "Building superintendent",
  "7": "Electronic service addresses",
  "7A": "Landlord electronic service",
  "7B": "Tenant electronic service",
  "8": "Lease type",
  "8A": "Periodic lease",
  "8B": "Fixed-term lease",
  "9": "Public housing",
  "10": "Rent and payment",
  "11": "Rent increases",
  "12": "Rental incentives",
  "13": "Services included or excluded",
  "14": "Additional obligations",
  "15": "Security deposit",
  "16": "Inspection report",
  "17": "Statutory conditions",
  "17A": "Building rules",
  "18": "Assigning or subletting",
  "19": "Rental arrears",
  "20": "Tenant notice to quit",
  "21": "Landlord notice to quit",
  "22": "Binding clauses",
  "23": "Tenant responsibilities",
  "24": "Signatures",
  "25": "Attachments",
  "26": "Acknowledgments",
};

export const FORM_P_DEFAULT_DATA: FormPData = Object.fromEntries(
  FORM_P_SECTION_IDS.map((id) => [id, {}]),
) as FormPData;

export function normalizeFormPData(value: unknown): FormPData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...FORM_P_DEFAULT_DATA };
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    FORM_P_SECTION_IDS.map((id) => {
      const section = source[id] ?? source[`section${id}`];
      return [id, section && typeof section === "object" && !Array.isArray(section) ? section : {}];
    }),
  ) as FormPData;
}

export function formPEntries(data: FormPData) {
  return FORM_P_SECTION_IDS.flatMap((id) =>
    Object.entries(data[id] ?? {}).map(([key, value]) => ({ section: id, key, value })),
  );
}

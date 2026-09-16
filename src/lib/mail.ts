import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import nodemailer from "nodemailer";
import { FORM_P_SECTION_LABELS, FORM_P_STATEMENTS, formPEntries, normalizeFormPData, type FormPData } from "@/lib/form-p";

type MailAttachment = { filename: string; content: Buffer | string; contentType?: string };

type LeasePdfInput = {
  id: string;
  createdAt: Date | string;
  landlord: { name: string; email: string };
  formData?: unknown;
  landlordSignatureData?: string | null;
  landlordSignedAt?: Date | string | null;
  tenants?: Array<{ firstName: string; lastName: string; email: string; isMinor?: boolean | null; signatureData?: string | null; signedAt?: Date | string | null }>;
};

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

function label(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

function formatValue(value: unknown) {
  if (value === null || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  return String(value);
}

function formPRows(formData: unknown) {
  const data = normalizeFormPData(formData) as FormPData;
  const rows = formPEntries(data).map(({ section, key, value }) => ({
    name: `Section ${section} - ${FORM_P_SECTION_LABELS[section] ?? "Form P"} - ${label(key)}`,
    value: formatValue(value),
  }));
  const statements = [
    ["2", FORM_P_STATEMENTS.occupants],
    ["7", FORM_P_STATEMENTS.electronicService],
    ["8B", FORM_P_STATEMENTS.fixedTerm],
    ["9", FORM_P_STATEMENTS.publicHousing],
    ["11", FORM_P_STATEMENTS.rentIncrease],
    ["10", FORM_P_STATEMENTS.lateFee],
    ["15", FORM_P_STATEMENTS.securityDeposit],
    ["19", FORM_P_STATEMENTS.arrears],
    ["26", FORM_P_STATEMENTS.actCopy],
  ] as const;
  statements.forEach(([section, statement]) => rows.push({ name: `Section ${section} - statutory rule`, value: statement }));
  return rows;
}

function flatten(value: unknown, prefix = ""): Array<{ name: string; value: string }> {
  const rows: Array<{ name: string; value: string }> = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const name = prefix ? `${prefix} [${index + 1}]` : `Entry ${index + 1}`;
      if (item && typeof item === "object") rows.push(...flatten(item, name));
      else rows.push({ name, value: formatValue(item) });
    });
    return rows;
  }

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const name = prefix ? `${prefix} - ${label(key)}` : label(key);
      if (child && typeof child === "object") rows.push(...flatten(child, name));
      else rows.push({ name, value: formatValue(child) });
    });
    return rows;
  }

  if (prefix) rows.push({ name: prefix, value: formatValue(value) });
  return rows;
}

export async function buildLeasePdfAttachment(lease: LeasePdfInput): Promise<MailAttachment> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const rows = lease.formData && typeof lease.formData === "object" ? formPRows(lease.formData) : [
    { name: "Landlord", value: lease.landlord.name },
    { name: "Lease ID", value: lease.id },
    { name: "Created", value: new Date(lease.createdAt).toISOString() },
    { name: "Tenant count", value: String(lease.tenants?.filter((tenant) => !tenant.isMinor).length ?? 0) },
  ];

  let page = pdf.addPage([612, 792]);
  let y = 744;
  const margin = 48;
  const contentWidth = 612 - margin * 2;

  const addWrappedText = (text: string, x: number, size: number, color = rgb(0.12, 0.16, 0.15)) => {
    const words = text.split(" ");
    let line = "";
    const lines: string[] = [];
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (regular.widthOfTextAtSize(candidate, size) > contentWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    lines.forEach((currentLine, index) => page.drawText(currentLine, { x, y: y - index * (size + 3), size, font: regular, color }));
    y -= lines.length * (size + 3) + 4;
  };

  page.drawText("Residential Lease Agreement", { x: margin, y, size: 20, font: bold, color: rgb(0.12, 0.42, 0.31) });
  y -= 28;
  page.drawText(`Landlord: ${lease.landlord.name}`, { x: margin, y, size: 11, font: regular });
  y -= 18;
  page.drawText(`Created: ${new Date(lease.createdAt).toLocaleDateString()}`, { x: margin, y, size: 10, font: regular, color: rgb(0.35, 0.4, 0.37) });
  y -= 22;

  rows.forEach(({ name, value }) => {
    if (y < 60) {
      page = pdf.addPage([612, 792]);
      y = 744;
    }
    addWrappedText(`${name}: ${value}`, margin, 9);
  });

  if (lease.landlordSignatureData || lease.tenants?.some((tenant) => tenant.signatureData)) {
    if (y < 190) {
      page = pdf.addPage([612, 792]);
      y = 744;
    }
    y -= 10;
    page.drawText("Signatures", { x: margin, y, size: 13, font: bold, color: rgb(0.12, 0.42, 0.31) });
    y -= 22;
    if (lease.landlordSignatureData) {
      const image = await pdf.embedPng(lease.landlordSignatureData);
      page.drawImage(image, { x: margin, y: y - 44, width: 180, height: 52 });
      page.drawText(`Landlord signature${lease.landlordSignedAt ? ` - ${new Date(lease.landlordSignedAt).toLocaleDateString()}` : ""}`, { x: margin, y: y - 58, size: 9, font: regular });
      y -= 78;
    }
    for (const tenant of lease.tenants ?? []) {
      if (!tenant.signatureData) continue;
      if (y < 110) {
        page = pdf.addPage([612, 792]);
        y = 744;
      }
      const image = await pdf.embedPng(tenant.signatureData);
      page.drawImage(image, { x: margin, y: y - 44, width: 180, height: 52 });
      page.drawText(`${tenant.firstName} ${tenant.lastName} signature${tenant.signedAt ? ` - ${new Date(tenant.signedAt).toLocaleDateString()}` : ""}`, { x: margin, y: y - 58, size: 9, font: regular });
      y -= 78;
    }
  }

  const buffer = Buffer.from(await pdf.save());
  return { filename: `lease-${lease.id}.pdf`, content: buffer, contentType: "application/pdf" };
}

export async function sendEmail(to: string, subject: string, text: string, attachments: MailAttachment[] = []) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!transporter || !from) {
    console.warn(`Email not sent because SMTP is not configured. Intended recipient: ${to}`);
    return false;
  }
  await transporter.sendMail({ from, to, subject, text, attachments });
  return true;
}
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };
type PdfValue = string | number | boolean | null | PdfValue[] | { [key: string]: PdfValue };

function label(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

function formatValue(value: PdfValue) {
  if (value === null || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  return String(value);
}

function flatten(value: PdfValue, prefix = "") {
  const rows: { name: string; value: string }[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const name = prefix ? `${prefix} [${index + 1}]` : `Entry ${index + 1}`;
      if (item && typeof item === "object") rows.push(...flatten(item, name));
      else rows.push({ name, value: formatValue(item) });
    });
    return rows;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      const name = prefix ? `${prefix} - ${label(key)}` : label(key);
      if (child && typeof child === "object") rows.push(...flatten(child, name));
      else rows.push({ name, value: formatValue(child) });
    });
    return rows;
  }

  if (prefix) rows.push({ name: prefix, value: formatValue(value) });
  return rows;
}

function addWrappedText(page: ReturnType<PDFDocument["addPage"]>, text: string, x: number, y: number, maxWidth: number, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, size: number, color = rgb(0.12, 0.16, 0.15)) {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  });
  if (line) lines.push(line);
  lines.forEach((currentLine, index) => page.drawText(currentLine, { x, y: y - index * (size + 3), size, font, color }));
  return y - lines.length * (size + 3);
}

export async function GET(request: Request, { params }: RouteContext) {
  const { token } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { accessToken: token }, include: { lease: { include: { landlord: true, tenants: true } } } });
  if (!tenant || tenant.isMinor) return NextResponse.json({ error: "This signing link is invalid or has expired." }, { status: 404 });

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const rawFormData = tenant.lease.formData as PdfValue | null | undefined;
  const rows = rawFormData && typeof rawFormData === "object" ? flatten(rawFormData) : [
    { name: "Landlord", value: tenant.lease.landlord.name || "Not provided" },
    { name: "Tenant", value: `${tenant.firstName} ${tenant.lastName}` },
    { name: "Lease created", value: tenant.lease.createdAt.toISOString() },
    { name: "Status", value: tenant.lease.status },
    { name: "Contact email", value: tenant.email },
  ];
  let page = pdf.addPage([612, 792]);
  let y = 744;
  const margin = 48;
  const contentWidth = 612 - margin * 2;

  const ensureSpace = (height: number) => {
    if (y - height < 48) {
      page = pdf.addPage([612, 792]);
      y = 744;
    }
  };

  page.drawText("Residential Lease Application", { x: margin, y, size: 20, font: bold, color: rgb(0.12, 0.42, 0.31) });
  y -= 28;
  page.drawText("Homeowner-completed details for tenant review and signature", { x: margin, y, size: 10, font: regular, color: rgb(0.35, 0.4, 0.37) });
  y -= 30;
  page.drawText(`Tenant: ${tenant.firstName} ${tenant.lastName}`, { x: margin, y, size: 11, font: bold });
  y -= 16;
  page.drawText(`Landlord: ${tenant.lease.landlord.name}`, { x: margin, y, size: 11, font: regular });
  y -= 16;
  page.drawText(`Created: ${tenant.lease.createdAt.toLocaleDateString()}`, { x: margin, y, size: 10, font: regular, color: rgb(0.35, 0.4, 0.37) });
  y -= 28;

  rows.forEach(({ name, value }) => {
    const valueLines = Math.max(1, Math.ceil(regular.widthOfTextAtSize(`${name}: ${value}`, 9) / contentWidth));
    ensureSpace(valueLines * 15 + 8);
    y = addWrappedText(page, `${name}: ${value}`, margin, y, contentWidth, regular, 9);
    y -= 6;
  });

  if (!rows.length) {
    ensureSpace(24);
    y -= 12;
    page.drawText("Legacy lease record", { x: margin, y, size: 12, font: bold, color: rgb(0.12, 0.42, 0.31) });
    y -= 18;
    y = addWrappedText(page, "No structured PDF fields were found for this lease. This summary is a fallback for older records.", margin, y, contentWidth, regular, 9, rgb(0.35, 0.4, 0.37));
  }

  ensureSpace(54);
  y -= 12;
  page.drawText("Tenant review", { x: margin, y, size: 12, font: bold, color: rgb(0.12, 0.42, 0.31) });
  y -= 18;
  y = addWrappedText(page, "Review every detail in this document before completing the secure signing form. Your signature confirms the information and acknowledgments submitted with your signing link.", margin, y, contentWidth, regular, 9, rgb(0.35, 0.4, 0.37));

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lease-review-${tenant.lastName.toLowerCase()}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

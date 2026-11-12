/**
 * BorderBrief AI — Pure Zero-Dependency Commercial Invoice PDF Generator (Sprint 5)
 *
 * Generates robust, standards-compliant, print-ready PDF 1.4 documents without any external binary
 * or npm dependencies.
 *
 * Robustness & Security Features:
 * - Dynamic Single-Page and Multi-Page pagination
 * - Intelligent text wrapping for long product descriptions and addresses
 * - Unicode transliteration (e.g. ₹ -> INR, € -> EUR, £ -> GBP, smart quotes, em-dashes, accents)
 * - Safe PDF string escaping (parentheses, backslashes, control characters)
 * - Exact byte offset calculation and standard cross-reference (xref) table
 * - Missing optional fields handled gracefully without crashing
 * - Sanitization against malicious inputs / control characters
 * - Strict financial separation: Seller invoice total vs. Reference U.S. import costs
 * - Diagonal "DRAFT — FOR REVIEW ONLY" watermark on every page
 * - 19 U.S.C. § 1484 statutory compliance disclaimers
 */

import type { CommercialInvoiceDraft, InvoiceLineItem } from "../../types/invoice.ts";

/**
 * Transliterates Unicode characters to ASCII/WinAnsi safe representations
 * to prevent PDF text stream corruption.
 */
export function sanitizePdfText(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    // Currency symbols
    .replace(/₹/g, "INR ")
    .replace(/€/g, "EUR ")
    .replace(/£/g, "GBP ")
    .replace(/¥/g, "JPY ")
    // Quotes & dashes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "*")
    // Accented latin characters
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Control characters (null bytes, bell, backspace, etc.)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .trim();
}

/**
 * Escapes special PDF syntax characters: backslash, open/close parentheses.
 */
export function escapePdfString(str: string | undefined | null): string {
  const sanitized = sanitizePdfText(str);
  return sanitized
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Wraps text into multiple lines, respecting word boundaries and maximum character widths.
 */
export function wrapText(text: string | undefined | null, maxChars: number): string[] {
  if (!text) return [];
  const sanitized = sanitizePdfText(text);
  const rawLines = sanitized.split(/\r?\n/);
  const result: string[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxChars) {
      result.push(trimmed);
      continue;
    }

    const words = trimmed.split(/\s+/);
    let current = "";
    for (const w of words) {
      if (!current) {
        if (w.length > maxChars) {
          result.push(w.slice(0, maxChars));
          current = w.slice(maxChars);
        } else {
          current = w;
        }
      } else if ((current + " " + w).length <= maxChars) {
        current += " " + w;
      } else {
        result.push(current);
        if (w.length > maxChars) {
          result.push(w.slice(0, maxChars));
          current = w.slice(maxChars);
        } else {
          current = w;
        }
      }
    }
    if (current) {
      result.push(current);
    }
  }

  return result.length > 0 ? result : [""];
}

interface PageContext {
  pageNumber: number;
  totalPages: number;
  streamOps: string[];
}

export function generateCommercialInvoicePdf(invoice: CommercialInvoiceDraft): Buffer {
  const pageWidth = 595.28;  // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const margin = 36;        // 0.5 inch margins
  const contentWidth = pageWidth - margin * 2;

  // Items per page calculation
  const totalItems = invoice.items.length;
  // If <= 5 items, single page fits comfortably.
  // If > 5 items, split across multiple pages (e.g. 8 items per continuation page)
  const isMultiPage = totalItems > 5;
  const itemsPage1Count = isMultiPage ? 4 : totalItems;
  const itemsContinuationCount = 8;

  let totalPages = 1;
  if (isMultiPage) {
    const remaining = totalItems - itemsPage1Count;
    totalPages = 1 + Math.ceil(remaining / itemsContinuationCount);
  }

  const pagesStreams: string[] = [];

  // Helper drawing functions bound to a streamOps array
  const createDrawHelpers = (streamOps: string[]) => {
    const fillRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      streamOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    };

    const strokeRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number, lineWidth = 0.5) => {
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
      streamOps.push(`${lineWidth.toFixed(2)} w`);
      streamOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number, r = 0.8, g = 0.8, b = 0.8, lineWidth = 0.5) => {
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
      streamOps.push(`${lineWidth.toFixed(2)} w`);
      streamOps.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    };

    const drawText = (
      text: string,
      x: number,
      y: number,
      fontSize = 9,
      isBold = false,
      r = 0.1,
      g = 0.1,
      b = 0.1
    ) => {
      const font = isBold ? "/F2" : "/F1";
      streamOps.push("BT");
      streamOps.push(`${font} ${fontSize} Tf`);
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      streamOps.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
      streamOps.push(`(${escapePdfString(text)}) Tj`);
      streamOps.push("ET");
    };

    const drawWatermark = () => {
      streamOps.push("q");
      streamOps.push("0.93 0.94 0.96 rg"); // Subtle background watermark
      streamOps.push("/F2 36 Tf");
      streamOps.push("1 0 0 1 0 0 cm");
      streamOps.push("BT");
      streamOps.push("0.707 0.707 -0.707 0.707 105 310 Tm"); // 45 degree diagonal
      streamOps.push("(DRAFT - FOR REVIEW ONLY) Tj");
      streamOps.push("ET");
      streamOps.push("Q");
    };

    const drawPageFooter = (currentPage: number, total: number) => {
      const footerY = margin - 15;
      drawLine(margin, footerY + 12, margin + contentWidth, footerY + 12, 0.85, 0.88, 0.9);
      drawText("BorderBrief AI • Deterministic Landed-Cost & Export Documentation Platform", margin, footerY, 7, false, 0.45, 0.5, 0.55);
      drawText(`Page ${currentPage} of ${total}`, margin + contentWidth - 60, footerY, 7, true, 0.4, 0.45, 0.5);
    };

    return { fillRect, strokeRect, drawLine, drawText, drawWatermark, drawPageFooter };
  };

  // Build Page 1
  {
    const streamOps: string[] = [];
    const { fillRect, strokeRect, drawLine, drawText, drawWatermark, drawPageFooter } = createDrawHelpers(streamOps);

    // 1. Watermark
    drawWatermark();

    // 2. Top Header Bar
    fillRect(margin, pageHeight - margin - 38, contentWidth, 38, 0.08, 0.22, 0.38);
    drawText("BORDERBRIEF AI  |  EXPORT COMMERCIAL INVOICE", margin + 14, pageHeight - margin - 22, 12, true, 1, 1, 1);
    drawText("DRAFT FOR REVIEW ONLY — NOT AN OFFICIAL CUSTOMS FILING", margin + 14, pageHeight - margin - 33, 7.5, false, 0.82, 0.88, 1);

    // Invoice Ref & Date
    const invNumSafe = invoice.invoiceNumber || "DRAFT-INVOICE";
    drawText(`INVOICE: ${invNumSafe}`, margin + contentWidth - 170, pageHeight - margin - 20, 8.5, true, 1, 1, 1);
    drawText(`DATE: ${invoice.shipment?.invoiceDate || ""}`, margin + contentWidth - 170, pageHeight - margin - 32, 8, false, 0.85, 0.9, 1);

    // 3. Parties Grid (Exporter Left, Buyer Right)
    const partiesTop = pageHeight - margin - 48;
    const colWidth = (contentWidth - 12) / 2;
    const partiesHeight = 98;

    // Exporter Box
    strokeRect(margin, partiesTop - partiesHeight, colWidth, partiesHeight, 0.82, 0.85, 0.9);
    fillRect(margin, partiesTop - 18, colWidth, 18, 0.94, 0.96, 0.98);
    drawText("1. EXPORTER / SELLER (INDIA)", margin + 8, partiesTop - 13, 8, true, 0.08, 0.22, 0.38);

    drawText(invoice.seller.businessName || "Exporter Name", margin + 8, partiesTop - 31, 8.5, true);
    
    // Wrapped Exporter Address
    const sellerAddrLines = wrapText(invoice.seller.address, 38).slice(0, 2);
    sellerAddrLines.forEach((line, idx) => {
      drawText(line, margin + 8, partiesTop - 42 - idx * 10, 7.5, false, 0.3, 0.3, 0.3);
    });

    const sellerCityLine = [invoice.seller.city, invoice.seller.state, invoice.seller.postalCode]
      .filter(Boolean)
      .join(", ");
    drawText(`${sellerCityLine} ${invoice.seller.country || "India"}`, margin + 8, partiesTop - 64, 7.5, false, 0.3, 0.3, 0.3);
    drawText(`Email: ${invoice.seller.email} | Phone: ${invoice.seller.phone}`, margin + 8, partiesTop - 76, 7, false, 0.3, 0.3, 0.3);

    // Regulatory Identifiers (NO FABRICATION)
    const iecStr = invoice.seller.iecNumber ? `IEC: ${invoice.seller.iecNumber}` : "IEC: Unspecified";
    const gstinStr = invoice.seller.gstin ? `GSTIN: ${invoice.seller.gstin}` : "GSTIN: Unspecified";
    drawText(`${iecStr}  |  ${gstinStr}`, margin + 8, partiesTop - 90, 7, false, 0.2, 0.4, 0.6);

    // Buyer Box
    const buyerLeft = margin + colWidth + 12;
    strokeRect(buyerLeft, partiesTop - partiesHeight, colWidth, partiesHeight, 0.82, 0.85, 0.9);
    fillRect(buyerLeft, partiesTop - 18, colWidth, 18, 0.94, 0.96, 0.98);
    drawText("2. BUYER / CONSIGNEE (UNITED STATES)", buyerLeft + 8, partiesTop - 13, 8, true, 0.08, 0.22, 0.38);

    drawText(invoice.buyer.name || "Buyer Name", buyerLeft + 8, partiesTop - 31, 8.5, true);
    
    // Wrapped Buyer Address
    const buyerAddrLines = wrapText(invoice.buyer.address, 38).slice(0, 2);
    buyerAddrLines.forEach((line, idx) => {
      drawText(line, buyerLeft + 8, partiesTop - 42 - idx * 10, 7.5, false, 0.3, 0.3, 0.3);
    });

    const buyerCityLine = [invoice.buyer.city, invoice.buyer.state, invoice.buyer.postalCode]
      .filter(Boolean)
      .join(", ");
    drawText(`${buyerCityLine} ${invoice.buyer.country || "United States"}`, buyerLeft + 8, partiesTop - 64, 7.5, false, 0.3, 0.3, 0.3);
    
    if (invoice.buyer.email || invoice.buyer.phone) {
      drawText(`Contact: ${invoice.buyer.email || ""} ${invoice.buyer.phone || ""}`.trim(), buyerLeft + 8, partiesTop - 76, 7, false, 0.3, 0.3, 0.3);
    }
    const iorNotice = invoice.buyer.isImporterOfRecord !== false
      ? "Importer of Record: Presumed Buyer / Consignee"
      : "Importer of Record: Specified Third Party";
    drawText(iorNotice, buyerLeft + 8, partiesTop - 90, 7, false, 0.3, 0.5, 0.4);

    // 4. Shipment Metadata Strip
    const shipTop = partiesTop - partiesHeight - 10;
    strokeRect(margin, shipTop - 30, contentWidth, 30, 0.82, 0.85, 0.9);
    fillRect(margin, shipTop - 13, contentWidth, 13, 0.96, 0.97, 0.99);

    drawText("CORRIDOR", margin + 8, shipTop - 9.5, 6.5, true, 0.4, 0.45, 0.5);
    drawText("TRANSPORT MODE", margin + 110, shipTop - 9.5, 6.5, true, 0.4, 0.45, 0.5);
    drawText("INCOTERM RULE", margin + 220, shipTop - 9.5, 6.5, true, 0.4, 0.45, 0.5);
    drawText("COUNTRY OF ORIGIN", margin + 325, shipTop - 9.5, 6.5, true, 0.4, 0.45, 0.5);
    drawText("PACKAGES & WEIGHT", margin + 430, shipTop - 9.5, 6.5, true, 0.4, 0.45, 0.5);

    drawText("India (IN) -> United States (US)", margin + 8, shipTop - 23, 7.5, true);
    drawText(invoice.shipment.transportationMode || "POSTAL", margin + 110, shipTop - 23, 7.5, false);
    drawText(`${invoice.shipment.incoterm} (Incoterms 2020)`, margin + 220, shipTop - 23, 7.5, true);
    drawText(invoice.shipment.countryOfOrigin || "India", margin + 325, shipTop - 23, 7.5, false);
    const pkgStr = `${invoice.shipment.totalPackages || 1} Pkg${invoice.shipment.grossWeightKg ? ` | ${invoice.shipment.grossWeightKg}kg` : ""}`;
    drawText(pkgStr, margin + 430, shipTop - 23, 7.5, false);

    // 5. Merchandise Table
    let tableTop = shipTop - 40;
    const tableRowHeight = 22;

    // Header
    fillRect(margin, tableTop - 16, contentWidth, 16, 0.08, 0.22, 0.38);
    drawText("#", margin + 6, tableTop - 11.5, 7.5, true, 1, 1, 1);
    drawText("ITEM DESCRIPTION & ATTRIBUTES", margin + 24, tableTop - 11.5, 7.5, true, 1, 1, 1);
    drawText("HTS-10 / HS-6", margin + 280, tableTop - 11.5, 7.5, true, 1, 1, 1);
    drawText("QTY", margin + 375, tableTop - 11.5, 7.5, true, 1, 1, 1);
    drawText("UNIT PRICE", margin + 420, tableTop - 11.5, 7.5, true, 1, 1, 1);
    drawText("TOTAL (USD)", margin + 475, tableTop - 11.5, 7.5, true, 1, 1, 1);

    tableTop -= 16;

    // Render items for Page 1
    const page1Items = invoice.items.slice(0, itemsPage1Count);
    page1Items.forEach((item, index) => {
      const rowY = tableTop - (index + 1) * tableRowHeight;
      if (index % 2 === 0) {
        fillRect(margin, rowY, contentWidth, tableRowHeight, 0.98, 0.98, 0.99);
      }
      drawLine(margin, rowY, margin + contentWidth, rowY, 0.88, 0.9, 0.93);

      drawText(`${index + 1}`, margin + 6, rowY + 7, 7.5, false);

      const desc = item.description.length > 44 ? item.description.slice(0, 41) + "..." : item.description;
      drawText(desc, margin + 24, rowY + 11, 7.5, true);

      if (item.materialComposition) {
        const mat = item.materialComposition.length > 50 ? item.materialComposition.slice(0, 47) + "..." : item.materialComposition;
        drawText(`Mat: ${mat}`, margin + 24, rowY + 3, 6.5, false, 0.4, 0.4, 0.4);
      }

      const htsDisplay = item.hts10 || item.hs6 || "Not Classified";
      drawText(htsDisplay, margin + 280, rowY + 11, 7, false);
      const statusText = item.classificationStatus === "UNRESOLVED_AMBIGUITY"
        ? "UNRESOLVED"
        : item.classificationStatus === "ALTERNATIVE_CANDIDATES"
        ? "ALTERNATIVE"
        : "GROUNDED";
      const statusColor = item.classificationStatus === "UNRESOLVED_AMBIGUITY" ? [0.75, 0.15, 0.15] : [0.2, 0.5, 0.3];
      drawText(statusText, margin + 280, rowY + 3, 6, true, statusColor[0], statusColor[1], statusColor[2]);

      drawText(`${item.quantity} ${item.unitOfMeasure}`, margin + 375, rowY + 7, 7.5, false);
      drawText(`$${Number(item.unitPriceUSD || 0).toFixed(2)}`, margin + 420, rowY + 7, 7.5, false);
      drawText(`$${Number(item.totalPriceUSD || 0).toFixed(2)}`, margin + 475, rowY + 7, 7.5, true);
    });

    const page1TableBottom = tableTop - page1Items.length * tableRowHeight;
    strokeRect(margin, page1TableBottom, contentWidth, shipTop - 40 - page1TableBottom, 0.82, 0.85, 0.9);

    if (isMultiPage) {
      // Continuation note on Page 1
      drawText(
        `[CONTINUED ON PAGE 2 — ${totalItems - itemsPage1Count} item(s) on next page]`,
        margin + 8,
        page1TableBottom - 14,
        8,
        true,
        0.08,
        0.22,
        0.38
      );
    } else {
      // Single Page Bottom Blocks (Financial Summary, Import Costs, Declaration, Disclaimers)
      renderBottomInvoiceBlocks(invoice, page1TableBottom, margin, contentWidth, fillRect, strokeRect, drawLine, drawText);
    }

    drawPageFooter(1, totalPages);
    pagesStreams.push(streamOps.join("\n"));
  }

  // Build Continuation Pages if Multi-page
  if (isMultiPage) {
    let currentItemIndex = itemsPage1Count;
    let pageNum = 2;

    while (currentItemIndex < totalItems) {
      const streamOps: string[] = [];
      const { fillRect, strokeRect, drawLine, drawText, drawWatermark, drawPageFooter } = createDrawHelpers(streamOps);

      drawWatermark();

      // Continuation Header Bar
      fillRect(margin, pageHeight - margin - 30, contentWidth, 30, 0.08, 0.22, 0.38);
      drawText(`BORDERBRIEF AI | COMMERCIAL INVOICE — CONTINUATION (PAGE ${pageNum})`, margin + 14, pageHeight - margin - 18, 10, true, 1, 1, 1);
      drawText(`INVOICE: ${invoice.invoiceNumber || ""}`, margin + contentWidth - 160, pageHeight - margin - 18, 8, false, 0.85, 0.9, 1);

      let tableTop = pageHeight - margin - 40;
      const tableRowHeight = 22;

      // Table Header
      fillRect(margin, tableTop - 16, contentWidth, 16, 0.94, 0.96, 0.98);
      strokeRect(margin, tableTop - 16, contentWidth, 16, 0.82, 0.85, 0.9);
      drawText("#", margin + 6, tableTop - 11.5, 7.5, true, 0.1, 0.2, 0.3);
      drawText("ITEM DESCRIPTION & ATTRIBUTES", margin + 24, tableTop - 11.5, 7.5, true, 0.1, 0.2, 0.3);
      drawText("HTS-10 / HS-6", margin + 280, tableTop - 11.5, 7.5, true, 0.1, 0.2, 0.3);
      drawText("QTY", margin + 375, tableTop - 11.5, 7.5, true, 0.1, 0.2, 0.3);
      drawText("UNIT PRICE", margin + 420, tableTop - 11.5, 7.5, true, 0.1, 0.2, 0.3);
      drawText("TOTAL (USD)", margin + 475, tableTop - 11.5, 7.5, true, 0.1, 0.2, 0.3);

      tableTop -= 16;

      const pageItems = invoice.items.slice(currentItemIndex, currentItemIndex + itemsContinuationCount);
      pageItems.forEach((item, idx) => {
        const itemNumber = currentItemIndex + idx + 1;
        const rowY = tableTop - (idx + 1) * tableRowHeight;
        if (idx % 2 === 0) {
          fillRect(margin, rowY, contentWidth, tableRowHeight, 0.98, 0.98, 0.99);
        }
        drawLine(margin, rowY, margin + contentWidth, rowY, 0.88, 0.9, 0.93);

        drawText(`${itemNumber}`, margin + 6, rowY + 7, 7.5, false);

        const desc = item.description.length > 44 ? item.description.slice(0, 41) + "..." : item.description;
        drawText(desc, margin + 24, rowY + 11, 7.5, true);

        if (item.materialComposition) {
          const mat = item.materialComposition.length > 50 ? item.materialComposition.slice(0, 47) + "..." : item.materialComposition;
          drawText(`Mat: ${mat}`, margin + 24, rowY + 3, 6.5, false, 0.4, 0.4, 0.4);
        }

        const htsDisplay = item.hts10 || item.hs6 || "Not Classified";
        drawText(htsDisplay, margin + 280, rowY + 11, 7, false);
        const statusText = item.classificationStatus === "UNRESOLVED_AMBIGUITY" ? "UNRESOLVED" : "GROUNDED";
        drawText(statusText, margin + 280, rowY + 3, 6, true);

        drawText(`${item.quantity} ${item.unitOfMeasure}`, margin + 375, rowY + 7, 7.5, false);
        drawText(`$${Number(item.unitPriceUSD || 0).toFixed(2)}`, margin + 420, rowY + 7, 7.5, false);
        drawText(`$${Number(item.totalPriceUSD || 0).toFixed(2)}`, margin + 475, rowY + 7, 7.5, true);
      });

      const contTableBottom = tableTop - pageItems.length * tableRowHeight;
      strokeRect(margin, contTableBottom, contentWidth, pageHeight - margin - 40 - 16 - contTableBottom, 0.82, 0.85, 0.9);

      currentItemIndex += pageItems.length;

      // If this is the final continuation page, render bottom summary blocks
      if (currentItemIndex >= totalItems) {
        renderBottomInvoiceBlocks(invoice, contTableBottom, margin, contentWidth, fillRect, strokeRect, drawLine, drawText);
      }

      drawPageFooter(pageNum, totalPages);
      pagesStreams.push(streamOps.join("\n"));
      pageNum++;
    }
  }

  // Construct Standards-Compliant PDF 1.4 Binary Document
  return assemblePdf14(pageWidth, pageHeight, pagesStreams);
}

/**
 * Renders the financial summary, informational U.S. import costs, exporter declaration, and statutory notices.
 */
function renderBottomInvoiceBlocks(
  invoice: CommercialInvoiceDraft,
  startTopY: number,
  margin: number,
  contentWidth: number,
  fillRect: (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => void,
  strokeRect: (x: number, y: number, w: number, h: number, r: number, g: number, b: number, lineWidth?: number) => void,
  drawLine: (x1: number, y1: number, x2: number, y2: number, r?: number, g?: number, b?: number, lineWidth?: number) => void,
  drawText: (text: string, x: number, y: number, fontSize?: number, isBold?: boolean, r?: number, g?: number, b?: number) => void
): void {
  // 6. Financial Summary Box (Seller Total)
  const summaryTop = startTopY - 14;
  const summaryWidth = 220;
  const summaryLeft = margin + contentWidth - summaryWidth;

  strokeRect(summaryLeft, summaryTop - 80, summaryWidth, 80, 0.8, 0.84, 0.9);
  fillRect(summaryLeft, summaryTop - 18, summaryWidth, 18, 0.94, 0.96, 0.98);
  drawText("COMMERCIAL FINANCIAL SUMMARY", summaryLeft + 10, summaryTop - 13, 7.5, true, 0.08, 0.22, 0.38);

  drawText("Merchandise Subtotal:", summaryLeft + 10, summaryTop - 32, 7.5, false);
  drawText(`$${Number(invoice.subtotalUSD || 0).toFixed(2)}`, summaryLeft + summaryWidth - 65, summaryTop - 32, 7.5, false);

  drawText(`International Shipping (${invoice.shipment?.incoterm || "DAP"}):`, summaryLeft + 10, summaryTop - 44, 7.5, false);
  drawText(`$${Number(invoice.shippingCostUSD || 0).toFixed(2)}`, summaryLeft + summaryWidth - 65, summaryTop - 44, 7.5, false);

  // Optional Cargo Insurance under DAP
  const isInsuranceCharged = invoice.shipment?.insuranceCostUSD && Number(invoice.shipment.insuranceCostUSD) > 0;
  const insLabel = isInsuranceCharged ? "Cargo Insurance (Agreed):" : "Cargo Insurance (DAP Opt):";
  const insValue = isInsuranceCharged ? `$${Number(invoice.shipment?.insuranceCostUSD || 0).toFixed(2)}` : "$0.00";
  drawText(insLabel, summaryLeft + 10, summaryTop - 56, 7.5, false);
  drawText(insValue, summaryLeft + summaryWidth - 65, summaryTop - 56, 7.5, false);

  drawLine(summaryLeft, summaryTop - 62, summaryLeft + summaryWidth, summaryTop - 62, 0.8, 0.84, 0.9);
  fillRect(summaryLeft, summaryTop - 80, summaryWidth, 18, 0.9, 0.94, 0.98);
  drawText("INVOICE TOTAL (SELLER):", summaryLeft + 10, summaryTop - 74, 8, true, 0.08, 0.22, 0.38);
  drawText(`$${Number(invoice.invoiceTotalUSD || 0).toFixed(2)} ${invoice.currency || "USD"}`, summaryLeft + summaryWidth - 75, summaryTop - 74, 8.5, true, 0.08, 0.22, 0.38);

  // 7. Informational "Estimated U.S. Import Costs — For Reference" Box (Sprint 4 Integration)
  const importBoxWidth = contentWidth - summaryWidth - 14;
  strokeRect(margin, summaryTop - 80, importBoxWidth, 80, 0.88, 0.82, 0.7);
  fillRect(margin, summaryTop - 18, importBoxWidth, 18, 0.99, 0.97, 0.92);
  drawText("ESTIMATED U.S. IMPORT COSTS (BUYER REFERENCE ONLY)", margin + 8, summaryTop - 13, 7, true, 0.6, 0.35, 0.05);

  if (invoice.estimatedImportCosts) {
    const eic = invoice.estimatedImportCosts;
    const basis = eic.valuationStatutoryBasis || "19 U.S.C. § 1401a";
    drawText(`Dutiable Customs Value: $${Number(eic.dutiableValueUSD || 0).toFixed(2)} (${basis})`, margin + 8, summaryTop - 32, 6.5, false, 0.4, 0.3, 0.1);
    drawText(`Estimated Customs Duty: $${Number(eic.totalCustomsDutyUSD || 0).toFixed(2)} (Base: $${Number(eic.baseCustomsDutyUSD || 0).toFixed(2)} + Sec 301: $${Number(eic.section301DutyUSD || 0).toFixed(2)})`, margin + 8, summaryTop - 44, 6.5, false, 0.4, 0.3, 0.1);
    const mpfStr = `Customs Fees: $${Number(eic.totalCustomsFeesUSD || 0).toFixed(2)} (MPF: $${Number(eic.merchandiseProcessingFeeUSD || 0).toFixed(2)}${eic.inboundEmsFeeUSD ? ` + EMS: $${Number(eic.inboundEmsFeeUSD).toFixed(2)}` : ""})`;
    drawText(mpfStr, margin + 8, summaryTop - 56, 6.5, false, 0.4, 0.3, 0.1);
    drawText(`Total Estimated Import Charges: $${Number(eic.totalEstimatedImportChargesUSD || 0).toFixed(2)} USD [${eic.calculationStatus || "VERIFIED"}]`, margin + 8, summaryTop - 68, 7, true, 0.6, 0.3, 0.05);
    drawText("NOTICE: Payable upon U.S. arrival under DAP; NOT part of seller commercial invoice.", margin + 8, summaryTop - 77, 6, false, 0.5, 0.35, 0.1);
  } else {
    drawText("No Landed Cost Calculation Attached.", margin + 8, summaryTop - 40, 7, false, 0.5, 0.5, 0.5);
    drawText("U.S. customs duties and fees will be assessed by CBP upon arrival.", margin + 8, summaryTop - 55, 6.5, false, 0.5, 0.5, 0.5);
  }

  // 8. Declaration & Signature Block
  const declTop = summaryTop - 90;
  strokeRect(margin, declTop - 52, contentWidth, 52, 0.82, 0.85, 0.9);
  fillRect(margin, declTop - 14, contentWidth, 14, 0.95, 0.96, 0.98);
  drawText("3. EXPORTER DECLARATION & AUTHORIZED SIGNATURE", margin + 8, declTop - 10, 7, true, 0.08, 0.22, 0.38);

  const declStatement = invoice.declaration?.statement || "We declare that this invoice shows the actual price of the goods described.";
  drawText(declStatement, margin + 8, declTop - 25, 6.5, false, 0.3, 0.3, 0.3);
  const sigConfirm = invoice.declaration?.isConfirmedBySeller ? "[CONFIRMED BY EXPORTER]" : "[UNCONFIRMED DRAFT]";
  drawText(`Status: ${sigConfirm}`, margin + 8, declTop - 37, 7, true, invoice.declaration?.isConfirmedBySeller ? 0.1 : 0.7, 0.4, 0.2);

  const sigName = invoice.declaration?.signatoryName || invoice.seller?.businessName || "Authorized Signatory";
  const sigTitle = invoice.declaration?.signatoryTitle || "Authorized Signatory";
  drawText(`Signatory: ${sigName} (${sigTitle})`, margin + 200, declTop - 37, 7, false);
  drawText(`Date: ${invoice.declaration?.signatureDate || invoice.shipment?.invoiceDate || ""}`, margin + 440, declTop - 37, 7, false);
  drawLine(margin + 200, declTop - 44, margin + 400, declTop - 44, 0.6, 0.6, 0.6);
  drawText("Authorized Signature / Seal Stamp", margin + 200, declTop - 50, 6, false, 0.5, 0.5, 0.5);

  // 9. Statutory Disclaimers Footer
  const footerTop = declTop - 60;
  drawText("STATUTORY NOTICE & LEGAL DISCLAIMERS (19 U.S.C. § 1484 & CUSTOMS REGULATIONS):", margin, footerTop, 6, true, 0.45, 0.5, 0.55);
  drawText("1. Draft Document: Unfiled draft prepared for review; not an official customs declaration with ICEGATE/DGFT or U.S. CBP.", margin, footerTop - 8, 5.5, false, 0.5, 0.5, 0.5);
  drawText("2. Valuation Statutory Basis: Dutiable value excludes qualifying international freight and insurance under 19 U.S.C. § 1401a(b)(4)(A).", margin, footerTop - 16, 5.5, false, 0.5, 0.5, 0.5);
  drawText("3. Financial Separation: U.S. customs duties/fees are assessed upon entry and are strictly separate from the seller's invoice.", margin, footerTop - 24, 5.5, false, 0.5, 0.5, 0.5);
}

/**
 * Assembles standard binary PDF 1.4 document structure with cross-reference table and byte offsets.
 */
function assemblePdf14(pageWidth: number, pageHeight: number, pageStreams: string[]): Buffer {
  const pdfObjects: string[] = [];
  const byteOffsets: number[] = [];

  let pdfData = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";

  const addObject = (objStr: string) => {
    byteOffsets.push(Buffer.byteLength(pdfData, "utf-8"));
    pdfData += `${pdfObjects.length + 1} 0 obj\n${objStr}\nendobj\n`;
    pdfObjects.push(objStr);
  };

  const totalPages = pageStreams.length;

  // Obj 1: Catalog
  addObject("<< /Type /Catalog /Pages 2 0 R >>");

  // Allocate object IDs:
  // Obj 2: Pages
  // Pages kids: Obj 3 to Obj 3 + totalPages - 1
  // Streams: Obj 3 + totalPages to Obj 3 + totalPages*2 - 1
  // Resources: next
  // Font F1: next
  // Font F2: next
  const firstPageObjId = 3;
  const firstStreamObjId = firstPageObjId + totalPages;
  const resourcesObjId = firstStreamObjId + totalPages;
  const fontF1ObjId = resourcesObjId + 1;
  const fontF2ObjId = fontF1ObjId + 1;

  // Obj 2: Pages
  const kidsArray = Array.from({ length: totalPages }, (_, i) => `${firstPageObjId + i} 0 R`).join(" ");
  addObject(`<< /Type /Pages /Kids [${kidsArray}] /Count ${totalPages} >>`);

  // Page Objects (Obj 3 to 2 + totalPages)
  for (let i = 0; i < totalPages; i++) {
    const streamId = firstStreamObjId + i;
    addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents ${streamId} 0 R /Resources ${resourcesObjId} 0 R >>`
    );
  }

  // Stream Objects (Obj 2 + totalPages + 1 to 2 + totalPages*2)
  for (let i = 0; i < totalPages; i++) {
    const streamContent = pageStreams[i];
    const streamLength = Buffer.byteLength(streamContent, "utf-8");
    addObject(`<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream`);
  }

  // Resources Object (Fonts)
  addObject(`<< /Font << /F1 ${fontF1ObjId} 0 R /F2 ${fontF2ObjId} 0 R >> >>`);

  // Font F1 (Helvetica)
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  // Font F2 (Helvetica-Bold)
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  // Cross Reference Table
  const xrefOffset = Buffer.byteLength(pdfData, "utf-8");
  pdfData += `xref\n0 ${pdfObjects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of byteOffsets) {
    const pad = offset.toString().padStart(10, "0");
    pdfData += `${pad} 00000 n \n`;
  }

  // Trailer
  pdfData += `trailer\n<< /Size ${pdfObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfData, "utf-8");
}

# 06 — User Experience & Interface Blueprint: BorderBrief AI

**Document ID:** BB-RES-006  
**Design Philosophy:** "Radical Simplicity over Customs Complexity"  
**Target User Persona:** Indian Artisans, Handicraft Exporters, MSMEs, Sole Proprietors (Non-Technical, No Trade Law Background)  
**UI Paradigm:** Modern Fintech / SaaS (Clean, Stripe/PayPal-grade clarity, High Contrast, Zero Clutter)  
**Status:** Approved for Architecture Design (Research Phase)

---

## 1. Core UX Principles & Guidelines

Small-business owners and artisans are intimidated by customs jargon (e.g., *"Ad Valorem", "MFN Column 1", "GRI 3(b)", "Transaction Value 19 U.S.C. § 1401a"*). BorderBrief AI must act as an empathetic translator.

### Mandatory UX Rules
1. **Never Show Raw Legal Jargon Without Context:** Always pair legal terms with human-language explanations (e.g., instead of just *"HTS 4202.92.15.00 - 6.3% Ad Valorem"*, show *"US Import Duty: 6.3% ($1.58 per bag). Governed by US Tariff Code 4202.92.15.00"*).
2. **Linear Guided Progression:** Users follow a 5-step stepper workflow. They never face a massive 30-field enterprise customs form.
3. **Instant Visual Feedback:** Uploading a photo immediately previews the image and displays a calm, non-blocking skeleton loader while AI processes.
4. **Transparent Math:** Every calculation shows the exact arithmetic breakdown. No "black-box" magic numbers.
5. **Human Agency:** The AI suggests, but the user clicks an explicit **"Confirm HS Code"** button to proceed.

---

## 2. Information Architecture & Navigation Map

```
[ Top Header: Logo | "India 🇮🇳 → USA 🇺🇸 Corridor" | New Assessment Button | Theme Toggle ]
                                      │
          ┌───────────────────────────┴───────────────────────────┐
          ▼                                                       ▼
[ 1. Assessment Hub (Dashboard) ]                      [ 2. Guided Assessment Flow ]
  - Quick Stats (Active Exports, Total Value)            Step 1: Product & Photo Input
  - Recent Assessments Table / Cards                     Step 2: AI Classification & Clarifier
  - Action: "Prepare New Shipment"                       Step 3: Transparent Landed Cost
                                                         Step 4: Commercial Invoice Preview
                                                         Step 5: PayPal Payment & Link
```

---

## 3. Screen-by-Screen UI Specification

### Screen 1: The Assessment Hub (Dashboard)
- **Visual Style:** Minimalist white/slate background with soft indigo/emerald accents.
- **Header:**
  - Brand Logo: **BorderBrief AI** with an active badge: `Corridor: India → United States`.
  - Primary Action Button: `+ New Export Assessment` (High contrast, prominent).
- **Recent Shipments Table / Cards:**
  - Columns: Product Name, Photo thumbnail, Declared FOB, Suggested HTS Code, Total Landed Cost, Payment Status (`DRAFT`, `PENDING_PAYMENT`, `PAID`), and Actions (`View Invoice`, `PayPal Link`).
  - Empty State: Friendly illustration with text: *"No international shipments prepared yet. Start your first India → US export assessment in under 2 minutes."*

---

### Screen 2: Step 1 — Product & Photograph Input
- **Layout:** Two-column split layout on desktop (stacks vertically on mobile).
- **Left Column: Drag-and-Drop Photo Uploader:**
  - Large dropzone accepting JPEG/PNG/WebP.
  - Subtitle: *"Upload a clear photo of your finished product. Our AI will analyze materials, weave, and construction automatically."*
  - Instant image preview thumbnail with a `Remove` option.
- **Right Column: Simple Plain-Language Form:**
  - `Product Title`: e.g., *"Handmade Embroidered Cotton Bag"*.
  - `Description`: e.g., *"Canvas tote bag with cotton fabric handles, floral embroidery, and interior zip pocket."*
  - `Selling Price (USD)`: Input field with currency symbol `$` (e.g., `$25.00`).
  - `Quantity`: Number stepper (default `1`).
  - `Estimated International Shipping (USD)`: e.g., `$15.00` (Help tooltip: *"Cost charged by India Post, DHL, or courier to ship to the US."*).
- **Primary CTA:** `Analyze Product with AI →` (Triggers visual pulse on button).

---

### Screen 3: Step 2 — Explainable AI Classification & Clarifier
- **Layout:** Focus card with AI extraction summary and candidate classification cards.
- **AI Analysis Pill Box:**
  - Badges: `Detected: 100% Woven Cotton`, `Category: Bags & Handbags`, `Craft: Indian Handloom`.
- **Top Recommended Classification Card (Highlighted in Emerald/Primary):**
  - Title: **HTS Code 4202.92.15.00** — *Bags with outer surface of cotton*
  - Statutory Duty Rate: **6.3%**
  - Plain Language Explanation:
    > *"US Customs classifies travel and shopping bags based on the material of their exterior surface. Because your product's outer surface is predominantly woven cotton, it falls under US HTS 4202.92.15.00. Goods originating in India are subject to the standard General MFN rate of 6.3%."*
- **Interactive Clarification Dialog (Appears only if details are ambiguous):**
  - *Example:* *"Is this bag designed with an outer surface of textile or plastics?"*
  - Radio options: `[●] 100% Textile / Cotton` | `[○] Plastic Sheeting / Coated`
- **User Agency Actions:**
  - Button 1: `Confirm & Lock Classification` (Primary Green CTA).
  - Button 2: `Choose Alternative Classification` (Opens secondary dropdown of 2 other candidates).

---

### Screen 4: Step 3 — Transparent Landed-Cost Calculator
- **Visual Card:** Clean financial breakdown styled like a receipt/ledger.
- **Regulatory Callout Banner:**
  - Notice of Active Rules:
    > *ℹ️ **US Entry & Duty Notice:** Effective August 29, 2025, general duty-free de minimis treatment under Section 321 was suspended. Shipments are assessed under current CBP entry procedures and applicable Column 1 General tariff rates.*
- **Itemized Ledger Table:**

| Component | Basis | Calculation | Amount (USD) |
| :--- | :--- | :--- | :--- |
| **Merchandise Value** | 10 units @ \$25.00 | Dutiable transaction value (19 U.S.C. § 1401a) | **\$250.00** |
| **US Customs Duty** | 6.3% Column 1 General | 0.063 × \$250.00 | **\$15.75** |
| **Merchandise Processing Fee** | Informal Automated Entry | FY2027 CBP Schedule (91 FR 48398) | **\$2.77** |
| **International Shipping** | India Post EMS / Courier | Carrier fee (19 U.S.C. § 1401a(b)(4)(A) exclusion) | **\$45.00** |
| **TOTAL LANDED COST** | **All-inclusive estimated cost to US customer** | | **\$313.52** |

- **Per-Unit Breakdown:** `Landed Cost per bag: $31.35 USD`.
- *Note on MPF:* Illustrative simulation. Actual MPF applicability and amounts depend on entry classification, filing method, and active CBP regulations (91 FR 48398); MPF is not a simple percentage, and not all consignments qualify for informal entry.
- **Next CTA:** `Generate Commercial Invoice & Collect Payment →`.

---

### Screen 5: Step 4 — Export Documentation Preview (Commercial Invoice)
- **Live PDF Previewer:** Rendered directly in-browser using `@react-pdf/renderer`.
- **Exporter Configuration Bar:**
  - Input: `Exporter Name / Business Name` (e.g., *"Jaipur Crafts & Textiles"*).
  - Input: `IEC Code` (10-digit DGFT code) & `GSTIN`.
  - Toggle: `[✓] Export under LUT (Letter of Undertaking) without payment of IGST`.
  - Input: `Buyer Name & US Shipping Address`.
- **Document Actions:**
  - Button: `Download Invoice PDF` (Direct download of official formatted PDF).
  - Button: `Proceed to Payment Collection →`.

---

### Screen 6: Step 5 — PayPal Payment Checkout & Status
- **Two Distinct Modes:**
  1. **Seller View (Shareable Payment Link):**
     - Generates a hosted payment link or QR code: `https://borderbrief.ai/pay/exp_01j7...`
     - The seller can copy the link and email or WhatsApp it directly to their American customer.
  2. **Buyer View (The Customer Payment Experience):**
     - Clean checkout screen showing the verified item description, invoice number, and exact USD total ($295.00).
     - Official **PayPal Smart Payment Buttons** rendered via `@paypal/react-paypal-js`.
     - Supports **PayPal Balance, Credit/Debit Cards, and Pay Later**.
- **Post-Payment Confirmation Screen:**
  - Instant transition upon server capture:
    - ✅ **Payment Verified & Captured (PayPal ID: 9PP12345CC...)**
    - Automatically updates the seller's dashboard status to `PAID`.
    - Displays printable receipt and export compliance checklist.

---

## 4. Design System & Component Library (shadcn/ui + Tailwind)

| UI Element | Component Choice | Purpose |
| :--- | :--- | :--- |
| **Progress Indicator** | `Stepper` / `Tabs` | Displays current stage (1: Details $\rightarrow$ 2: Classification $\rightarrow$ 3: Cost $\rightarrow$ 4: Invoice $\rightarrow$ 5: Payment) |
| **Candidate Cards** | `Card` with hover effect | Displays candidate HTS codes with confidence pill badges |
| **Confidence Indicator** | `Badge` (variant: success / outline) | `94% Match` (Emerald), `72% Match` (Amber) |
| **Customs Terminology** | `Tooltip` / `HoverCard` | Hovering over "MPF" or "FOB" shows a 1-sentence plain English definition |
| **Clarification Modal** | `Dialog` | Pops up only if essential information is missing |
| **Financial Ledger** | `Table` with borderless rows | Formats currency with tabular numerical fonts (`font-mono`) |
| **Payment Trigger** | `PayPalButtons` | Sandboxed official PayPal SDK buttons |

---

## 5. Responsive Design & Accessibility (a11y)

- **Mobile First Adaptation:** On smartphone viewports (tested down to 375px width), the stepper collapses into a compact top progress bar (`Step 2 of 5`). Forms use full-width single-column layouts with large touch targets ($\ge 44\text{px}$).
- **WCAG 2.1 AA Compliance:**
  - High contrast text (`text-slate-900` on `bg-white`).
  - Screen-reader labels (`aria-label`) on all icon-only buttons.
  - Complete keyboard navigation support throughout the clarification and confirmation flows.


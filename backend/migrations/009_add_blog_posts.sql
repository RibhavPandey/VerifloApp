-- Migration 009: Blog posts table for in-app blog (public read-only)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_posts_public_read" ON blog_posts
  FOR SELECT TO anon USING (true);

COMMENT ON TABLE blog_posts IS 'Public blog articles; read-only for anon';

-- Seed: Post 1 — Document AI, data analysis, business intelligence
INSERT INTO blog_posts (slug, title, meta_description, content, published_at) VALUES (
  'document-ai-data-analysis-business-intelligence',
  'Document AI, Data Analysis & Business Intelligence: A Complete Guide',
  'Learn how document AI, data analysis AI tools, and business intelligence work together. Veriflo combines invoice extraction, workflows, and exports to Tally, QuickBooks, and Zoho.',
  $p1$
<article>
  <h2>What Is Document AI?</h2>
  <p>Document AI uses machine learning to read, extract, and structure information from documents like invoices, receipts, and contracts. Instead of manual data entry, the system identifies key fields (dates, amounts, line items, vendor names) and turns unstructured PDFs or images into usable data.</p>

  <h2>How Document AI Fits With Data Analysis and BI</h2>
  <p>Data analysis AI tools help you explore and interpret that extracted data. Business intelligence (BI) turns it into reports, dashboards, and decisions. Together: Document AI captures the raw facts, data analysis finds patterns and answers, and BI surfaces insights for your team.</p>
  <p>For example, once invoices are extracted into structured data, you can analyze spending by vendor, track approval times, or forecast cash flow—all without re-typing numbers.</p>

  <h2>Benefits for Businesses</h2>
  <ul>
    <li><strong>Accuracy:</strong> Fewer manual entry errors and consistent field mapping.</li>
    <li><strong>Speed:</strong> Process batches of documents in minutes instead of hours.</li>
    <li><strong>Traceability:</strong> Data links back to source documents for audits.</li>
    <li><strong>Integration:</strong> Push data into accounting and ERP systems for a single source of truth.</li>
  </ul>

  <h2>How Veriflo Ties It Together</h2>
  <p>Veriflo is built for this pipeline. It uses document AI to extract data from invoice PDFs, then gives you spreadsheets and workflows so you can analyze and control the data before it reaches your books.</p>
  <ul>
    <li><strong>Invoice extraction:</strong> Document AI reads PDFs and pulls line items, totals, dates, and vendor details.</li>
    <li><strong>Review and edit:</strong> You can correct risky fields and approve extractions before export.</li>
    <li><strong>Export to Tally, QuickBooks, Zoho:</strong> Send structured data directly into your accounting software.</li>
    <li><strong>Workflows:</strong> Automate repeat steps so extraction and export fit into your process.</li>
    <li><strong>AI chat:</strong> Ask questions about your data and get answers in context.</li>
  </ul>
  <p>If you want document AI that connects to data analysis and BI-style workflows—without building it yourself—Veriflo is designed for that. <a href="/auth">Start with a free trial</a> or check <a href="/pricing">pricing</a>.</p>
</article>
$p1$,
  NOW() - INTERVAL '2 days'
) ON CONFLICT (slug) DO NOTHING;

-- Seed: Post 2 — Invoice to Excel, OCR, Veriflo vs others
INSERT INTO blog_posts (slug, title, meta_description, content, published_at) VALUES (
  'invoice-to-excel-ocr-veriflo-vs-alternatives',
  'Invoice to Excel: OCR Tools Compared — Why Veriflo Wins',
  'Compare invoice-to-Excel and OCR tools. See how Veriflo beats manual entry, generic OCR, and other invoice apps on accuracy, exports, and workflow.',
  $p2$
<article>
  <h2>Why Invoice-to-Excel Matters</h2>
  <p>Turning invoices into Excel (or structured data) is the first step for reconciliation, reporting, and feeding accounting systems. Doing it by hand is slow and error-prone. OCR and invoice extraction tools automate reading the document and filling rows and columns.</p>

  <h2>How OCR and Invoice Extraction Work</h2>
  <p>Generic OCR turns images of text into characters. Invoice extraction goes further: it understands layout and meaning—which block is the total, which table is line items, which line is the vendor—and outputs structured fields. Modern tools use AI to handle different formats and languages.</p>

  <h2>Veriflo vs Alternatives</h2>
  <p>Here’s how Veriflo compares to manual entry, generic OCR, and other invoice tools.</p>
  <table style="width:100%; border-collapse: collapse; margin: 1rem 0;">
    <thead>
      <tr style="border-bottom: 2px solid #e4e4e7;">
        <th style="text-align:left; padding: 0.5rem;">Feature</th>
        <th style="text-align:left; padding: 0.5rem;">Manual entry</th>
        <th style="text-align:left; padding: 0.5rem;">Generic OCR</th>
        <th style="text-align:left; padding: 0.5rem;">Other invoice apps</th>
        <th style="text-align:left; padding: 0.5rem;">Veriflo</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 0.5rem;">Invoice-to-Excel accuracy</td>
        <td style="padding: 0.5rem;">Depends on typist</td>
        <td style="padding: 0.5rem;">Often needs heavy cleanup</td>
        <td style="padding: 0.5rem;">Varies</td>
        <td style="padding: 0.5rem;"><strong>AI extraction + review</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 0.5rem;">Export to Tally / QuickBooks / Zoho</td>
        <td style="padding: 0.5rem;">Manual or custom scripts</td>
        <td style="padding: 0.5rem;">Rarely built-in</td>
        <td style="padding: 0.5rem;">Some support one product</td>
        <td style="padding: 0.5rem;"><strong>Direct export to all three</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 0.5rem;">Workflow automation</td>
        <td style="padding: 0.5rem;">No</td>
        <td style="padding: 0.5rem;">No</td>
        <td style="padding: 0.5rem;">Limited</td>
        <td style="padding: 0.5rem;"><strong>Yes</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 0.5rem;">AI chat on your data</td>
        <td style="padding: 0.5rem;">No</td>
        <td style="padding: 0.5rem;">No</td>
        <td style="padding: 0.5rem;">Rare</td>
        <td style="padding: 0.5rem;"><strong>Yes</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 0.5rem;">Review risky fields before export</td>
        <td style="padding: 0.5rem;">N/A</td>
        <td style="padding: 0.5rem;">No</td>
        <td style="padding: 0.5rem;">Sometimes</td>
        <td style="padding: 0.5rem;"><strong>Built-in verification</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>Why Veriflo Is Better</h2>
  <ul>
    <li><strong>Purpose-built for invoices:</strong> Not generic OCR—extraction is tuned for invoices and line items.</li>
    <li><strong>One place from PDF to books:</strong> Extract, review, export to Tally, QuickBooks, or Zoho without switching tools.</li>
    <li><strong>You stay in control:</strong> Review and edit before data hits your accounting system.</li>
    <li><strong>Workflows + AI chat:</strong> Automate steps and ask questions about your data in plain language.</li>
  </ul>
  <p>If you need invoice-to-Excel that actually connects to your stack and reduces manual work, Veriflo is built for that. <a href="/auth">Try Veriflo free</a> or see <a href="/pricing">pricing</a>.</p>
</article>
$p2$,
  NOW() - INTERVAL '1 day'
) ON CONFLICT (slug) DO NOTHING;

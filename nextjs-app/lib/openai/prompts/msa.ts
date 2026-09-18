import type { FewShotExample, PromptFile } from './shared'

export const MSA_STANDARD_TERMS = [
  'Parties',
  'Service Scope',
  'Payment Terms',
  'Invoice Schedule',
  'Late Payment Penalty',
  'Liability Cap',
  'Indemnification',
  'IP Ownership',
  'Termination Clause',
  'Governing Law',
  'Dispute Resolution',
  'Notice Period',
] as const

// Synthetic, illustrative examples — no real contracts or parties. Written to
// cover a services agreement, a software-development MSA, and a short-form
// consulting MSA with several terms genuinely absent, so the model learns
// both the happy path and the "Not found in document" convention.
const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    input: `[PAGE 1]
MASTER SERVICES AGREEMENT
This Master Services Agreement ("Agreement") is entered into as of June 1, 2025 between Northgate Facilities Group LLC ("Provider") and Summit Retail Holdings Inc. ("Client").

1. Services. Provider shall provide commercial janitorial and facilities maintenance services at Client's locations as described in each Statement of Work ("Services").

2. Fees and Payment. Client shall pay Provider the fees set forth in each Statement of Work within thirty (30) days of receipt of a correct invoice ("Net 30").

3. Invoicing. Provider shall issue invoices on a monthly basis, on the first business day of each calendar month.

[PAGE 2]
4. Late Payment. Any amount not paid when due shall accrue interest at 1.5% per month on the outstanding balance.

5. Limitation of Liability. Provider's aggregate liability under this Agreement shall not exceed the total fees paid by Client in the twelve (12) months preceding the claim.

6. Indemnification. Provider shall indemnify and hold harmless Client from any third-party claims arising from Provider's gross negligence or willful misconduct in performing the Services.

7. Term and Termination. This Agreement commences on the Effective Date and continues for one (1) year, automatically renewing for successive one-year terms unless either Party gives sixty (60) days' written notice of non-renewal. Either Party may terminate for material breach not cured within thirty (30) days of written notice.

8. Governing Law. This Agreement is governed by the laws of the State of Illinois.`,
    output: `{
  "detected_contract_type": "msa",
  "terms": [
    { "term_name": "Parties", "value": "Northgate Facilities Group LLC (Provider) and Summit Retail Holdings Inc. (Client)", "page_number": 1, "confidence_score": 0.97, "source_sentence": "This Master Services Agreement (\\"Agreement\\") is entered into as of June 1, 2025 between Northgate Facilities Group LLC (\\"Provider\\") and Summit Retail Holdings Inc. (\\"Client\\").", "term_source": "standard" },
    { "term_name": "Service Scope", "value": "Commercial janitorial and facilities maintenance services at Client's locations, as described in each Statement of Work.", "page_number": 1, "confidence_score": 0.95, "source_sentence": "Provider shall provide commercial janitorial and facilities maintenance services at Client's locations as described in each Statement of Work (\\"Services\\").", "term_source": "standard" },
    { "term_name": "Payment Terms", "value": "Net 30 — payment due within thirty (30) days of receipt of a correct invoice.", "page_number": 1, "confidence_score": 0.96, "source_sentence": "Client shall pay Provider the fees set forth in each Statement of Work within thirty (30) days of receipt of a correct invoice (\\"Net 30\\").", "term_source": "standard" },
    { "term_name": "Invoice Schedule", "value": "Monthly, issued on the first business day of each calendar month.", "page_number": 1, "confidence_score": 0.94, "source_sentence": "Provider shall issue invoices on a monthly basis, on the first business day of each calendar month.", "term_source": "standard" },
    { "term_name": "Late Payment Penalty", "value": "1.5% per month interest on the outstanding balance.", "page_number": 2, "confidence_score": 0.95, "source_sentence": "Any amount not paid when due shall accrue interest at 1.5% per month on the outstanding balance.", "term_source": "standard" },
    { "term_name": "Liability Cap", "value": "Aggregate liability capped at total fees paid by Client in the preceding 12 months.", "page_number": 2, "confidence_score": 0.94, "source_sentence": "Provider's aggregate liability under this Agreement shall not exceed the total fees paid by Client in the twelve (12) months preceding the claim.", "term_source": "standard" },
    { "term_name": "Indemnification", "value": "Provider indemnifies Client against third-party claims arising from Provider's gross negligence or willful misconduct.", "page_number": 2, "confidence_score": 0.93, "source_sentence": "Provider shall indemnify and hold harmless Client from any third-party claims arising from Provider's gross negligence or willful misconduct in performing the Services.", "term_source": "standard" },
    { "term_name": "IP Ownership", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Termination Clause", "value": "One-year initial term, auto-renews annually unless either Party gives 60 days' notice of non-renewal; either Party may terminate for uncured material breach after 30 days' notice.", "page_number": 2, "confidence_score": 0.93, "source_sentence": "This Agreement commences on the Effective Date and continues for one (1) year, automatically renewing for successive one-year terms unless either Party gives sixty (60) days' written notice of non-renewal.", "term_source": "standard" },
    { "term_name": "Governing Law", "value": "State of Illinois", "page_number": 2, "confidence_score": 0.96, "source_sentence": "This Agreement is governed by the laws of the State of Illinois.", "term_source": "standard" },
    { "term_name": "Dispute Resolution", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Notice Period", "value": "60 days' written notice for non-renewal; 30 days' cure period for material breach termination.", "page_number": 2, "confidence_score": 0.88, "source_sentence": "Either Party may terminate for material breach not cured within thirty (30) days of written notice.", "term_source": "standard" }
  ]
}`,
  },
  {
    input: `[PAGE 1]
MASTER SERVICES AGREEMENT (SOFTWARE DEVELOPMENT)
Entered into on November 12, 2025 by and between Kestrel Software Partners Ltd. ("Contractor") and Dunmore Financial Group ("Client").

1. Scope of Services. Contractor will design, develop, and maintain custom software applications for Client as specified in individual Work Orders executed under this Agreement.

2. Compensation. Client shall pay Contractor's fees within forty-five (45) days of invoice ("Net 45"). Contractor shall invoice Client bi-weekly for time and materials incurred.

[PAGE 2]
3. Intellectual Property. All custom software, source code, and deliverables developed by Contractor specifically for Client under a Work Order shall be considered "work made for hire" and shall be owned exclusively by Client upon full payment.

4. Limitation of Liability. In no event shall either Party's liability exceed the fees paid under the applicable Work Order in the preceding six (6) months, except for breaches of confidentiality or IP infringement.

5. Dispute Resolution. The Parties agree to resolve any dispute arising from this Agreement through binding arbitration administered by the American Arbitration Association in Chicago, Illinois.

6. Termination. Either Party may terminate this Agreement for convenience upon ninety (90) days' prior written notice to the other Party.`,
    output: `{
  "detected_contract_type": "msa",
  "terms": [
    { "term_name": "Parties", "value": "Kestrel Software Partners Ltd. (Contractor) and Dunmore Financial Group (Client)", "page_number": 1, "confidence_score": 0.97, "source_sentence": "Entered into on November 12, 2025 by and between Kestrel Software Partners Ltd. (\\"Contractor\\") and Dunmore Financial Group (\\"Client\\").", "term_source": "standard" },
    { "term_name": "Service Scope", "value": "Design, development, and maintenance of custom software applications, as specified in individual Work Orders.", "page_number": 1, "confidence_score": 0.94, "source_sentence": "Contractor will design, develop, and maintain custom software applications for Client as specified in individual Work Orders executed under this Agreement.", "term_source": "standard" },
    { "term_name": "Payment Terms", "value": "Net 45 — payment due within forty-five (45) days of invoice.", "page_number": 1, "confidence_score": 0.95, "source_sentence": "Client shall pay Contractor's fees within forty-five (45) days of invoice (\\"Net 45\\").", "term_source": "standard" },
    { "term_name": "Invoice Schedule", "value": "Bi-weekly, for time and materials incurred.", "page_number": 1, "confidence_score": 0.92, "source_sentence": "Contractor shall invoice Client bi-weekly for time and materials incurred.", "term_source": "standard" },
    { "term_name": "Late Payment Penalty", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Liability Cap", "value": "Liability capped at fees paid under the applicable Work Order in the preceding six months, except for confidentiality breaches or IP infringement.", "page_number": 2, "confidence_score": 0.93, "source_sentence": "In no event shall either Party's liability exceed the fees paid under the applicable Work Order in the preceding six (6) months, except for breaches of confidentiality or IP infringement.", "term_source": "standard" },
    { "term_name": "Indemnification", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "IP Ownership", "value": "All custom software and deliverables are work made for hire, owned exclusively by Client upon full payment.", "page_number": 2, "confidence_score": 0.95, "source_sentence": "All custom software, source code, and deliverables developed by Contractor specifically for Client under a Work Order shall be considered \\"work made for hire\\" and shall be owned exclusively by Client upon full payment.", "term_source": "standard" },
    { "term_name": "Termination Clause", "value": "Either Party may terminate for convenience upon ninety (90) days' prior written notice.", "page_number": 2, "confidence_score": 0.93, "source_sentence": "Either Party may terminate this Agreement for convenience upon ninety (90) days' prior written notice to the other Party.", "term_source": "standard" },
    { "term_name": "Governing Law", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Dispute Resolution", "value": "Binding arbitration administered by the American Arbitration Association in Chicago, Illinois.", "page_number": 2, "confidence_score": 0.94, "source_sentence": "The Parties agree to resolve any dispute arising from this Agreement through binding arbitration administered by the American Arbitration Association in Chicago, Illinois.", "term_source": "standard" },
    { "term_name": "Notice Period", "value": "90 days' prior written notice for termination for convenience.", "page_number": 2, "confidence_score": 0.9, "source_sentence": "Either Party may terminate this Agreement for convenience upon ninety (90) days' prior written notice to the other Party.", "term_source": "standard" }
  ]
}`,
  },
  {
    input: `[PAGE 1]
CONSULTING SERVICES MASTER AGREEMENT
Between Ferro Strategy Group ("Consultant") and Blythe Manufacturing Co. ("Client"), dated April 22, 2025.

Consultant will provide operational strategy consulting services as described in individual engagement letters. Client shall pay Consultant $250 per hour, invoiced monthly, due upon receipt.

Consultant's total liability to Client under this Agreement shall not exceed $50,000 in the aggregate.

This Agreement may be terminated by either Party for any reason upon fourteen (14) days' written notice to the other Party.`,
    output: `{
  "detected_contract_type": "msa",
  "terms": [
    { "term_name": "Parties", "value": "Ferro Strategy Group (Consultant) and Blythe Manufacturing Co. (Client)", "page_number": 1, "confidence_score": 0.96, "source_sentence": "Between Ferro Strategy Group (\\"Consultant\\") and Blythe Manufacturing Co. (\\"Client\\"), dated April 22, 2025.", "term_source": "standard" },
    { "term_name": "Service Scope", "value": "Operational strategy consulting services, as described in individual engagement letters.", "page_number": 1, "confidence_score": 0.9, "source_sentence": "Consultant will provide operational strategy consulting services as described in individual engagement letters.", "term_source": "standard" },
    { "term_name": "Payment Terms", "value": "$250 per hour, due upon receipt of invoice.", "page_number": 1, "confidence_score": 0.92, "source_sentence": "Client shall pay Consultant $250 per hour, invoiced monthly, due upon receipt.", "term_source": "standard" },
    { "term_name": "Invoice Schedule", "value": "Monthly.", "page_number": 1, "confidence_score": 0.88, "source_sentence": "Client shall pay Consultant $250 per hour, invoiced monthly, due upon receipt.", "term_source": "standard" },
    { "term_name": "Late Payment Penalty", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Liability Cap", "value": "$50,000 in the aggregate.", "page_number": 1, "confidence_score": 0.93, "source_sentence": "Consultant's total liability to Client under this Agreement shall not exceed $50,000 in the aggregate.", "term_source": "standard" },
    { "term_name": "Indemnification", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "IP Ownership", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Termination Clause", "value": "Either Party may terminate for any reason upon 14 days' written notice.", "page_number": 1, "confidence_score": 0.91, "source_sentence": "This Agreement may be terminated by either Party for any reason upon fourteen (14) days' written notice to the other Party.", "term_source": "standard" },
    { "term_name": "Governing Law", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Dispute Resolution", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Notice Period", "value": "14 days' written notice for termination.", "page_number": 1, "confidence_score": 0.91, "source_sentence": "This Agreement may be terminated by either Party for any reason upon fourteen (14) days' written notice to the other Party.", "term_source": "standard" }
  ]
}`,
  },
]

export const msaPrompt: PromptFile = {
  PROMPT_VERSION: 'msa-v1.0',
  CONTRACT_TYPE_LABEL: 'MSA',
  STANDARD_TERMS: MSA_STANDARD_TERMS,
  FEW_SHOT_EXAMPLES,
}

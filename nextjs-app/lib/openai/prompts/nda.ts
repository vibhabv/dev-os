import type { FewShotExample, PromptFile } from './shared'

export const NDA_STANDARD_TERMS = [
  'Parties',
  'Effective Date',
  'Confidentiality Obligations',
  'Permitted Disclosures',
  'Term & Duration',
  'Governing Law',
  'Jurisdiction',
  'IP Ownership',
  'Non-Solicitation',
  'Breach & Remedy',
] as const

// Synthetic, illustrative examples — no real contracts or parties. Written to
// give the model one worked example per common NDA shape (mutual, one-way,
// and a short-form NDA with several terms genuinely absent) so it learns the
// "Not found in document" convention as well as the happy path.
const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    input: `[PAGE 1]
MUTUAL NON-DISCLOSURE AGREEMENT
This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of March 3, 2025 ("Effective Date") by and between Acme Robotics, Inc., a Delaware corporation ("Acme"), and Brightline Logistics LLC, a California limited liability company ("Brightline"), each a "Party" and collectively the "Parties."

1. Confidential Information. Each Party may disclose to the other certain confidential technical and business information ("Confidential Information"). The receiving Party shall hold all Confidential Information in strict confidence and shall not disclose it to any third party without the prior written consent of the disclosing Party.

2. Permitted Disclosures. The receiving Party may disclose Confidential Information to its employees and contractors who have a need to know such information and who are bound by confidentiality obligations at least as restrictive as those in this Agreement.

[PAGE 2]
3. Term. This Agreement shall remain in effect for a period of two (2) years from the Effective Date, unless earlier terminated by either Party upon thirty (30) days' written notice.

4. Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles. The Parties consent to the exclusive jurisdiction of the state and federal courts located in Wilmington, Delaware.

5. Remedies. Each Party acknowledges that a breach of this Agreement may cause irreparable harm for which monetary damages would be an inadequate remedy, and the non-breaching Party shall be entitled to seek injunctive relief in addition to any other remedies available at law or in equity.`,
    output: `{
  "detected_contract_type": "nda",
  "terms": [
    { "term_name": "Parties", "value": "Acme Robotics, Inc. (Delaware corporation) and Brightline Logistics LLC (California LLC)", "page_number": 1, "confidence_score": 0.98, "source_sentence": "This Mutual Non-Disclosure Agreement (\\"Agreement\\") is entered into as of March 3, 2025 (\\"Effective Date\\") by and between Acme Robotics, Inc., a Delaware corporation (\\"Acme\\"), and Brightline Logistics LLC, a California limited liability company (\\"Brightline\\"), each a \\"Party\\" and collectively the \\"Parties.\\"", "term_source": "standard" },
    { "term_name": "Effective Date", "value": "March 3, 2025", "page_number": 1, "confidence_score": 0.97, "source_sentence": "This Mutual Non-Disclosure Agreement (\\"Agreement\\") is entered into as of March 3, 2025 (\\"Effective Date\\") by and between Acme Robotics, Inc., a Delaware corporation (\\"Acme\\"), and Brightline Logistics LLC, a California limited liability company (\\"Brightline\\").", "term_source": "standard" },
    { "term_name": "Confidentiality Obligations", "value": "The receiving Party shall hold all Confidential Information in strict confidence and shall not disclose it to any third party without the prior written consent of the disclosing Party.", "page_number": 1, "confidence_score": 0.95, "source_sentence": "The receiving Party shall hold all Confidential Information in strict confidence and shall not disclose it to any third party without the prior written consent of the disclosing Party.", "term_source": "standard" },
    { "term_name": "Permitted Disclosures", "value": "Disclosure to employees and contractors with a need to know, bound by equivalent confidentiality obligations.", "page_number": 1, "confidence_score": 0.93, "source_sentence": "The receiving Party may disclose Confidential Information to its employees and contractors who have a need to know such information and who are bound by confidentiality obligations at least as restrictive as those in this Agreement.", "term_source": "standard" },
    { "term_name": "Term & Duration", "value": "Two (2) years from the Effective Date, terminable earlier on 30 days' written notice.", "page_number": 2, "confidence_score": 0.96, "source_sentence": "This Agreement shall remain in effect for a period of two (2) years from the Effective Date, unless earlier terminated by either Party upon thirty (30) days' written notice.", "term_source": "standard" },
    { "term_name": "Governing Law", "value": "State of Delaware", "page_number": 2, "confidence_score": 0.97, "source_sentence": "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.", "term_source": "standard" },
    { "term_name": "Jurisdiction", "value": "State and federal courts located in Wilmington, Delaware", "page_number": 2, "confidence_score": 0.95, "source_sentence": "The Parties consent to the exclusive jurisdiction of the state and federal courts located in Wilmington, Delaware.", "term_source": "standard" },
    { "term_name": "IP Ownership", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Non-Solicitation", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Breach & Remedy", "value": "Non-breaching Party may seek injunctive relief in addition to any other remedies available at law or in equity.", "page_number": 2, "confidence_score": 0.9, "source_sentence": "Each Party acknowledges that a breach of this Agreement may cause irreparable harm for which monetary damages would be an inadequate remedy, and the non-breaching Party shall be entitled to seek injunctive relief in addition to any other remedies available at law or in equity.", "term_source": "standard" }
  ]
}`,
  },
  {
    input: `[PAGE 1]
ONE-WAY NON-DISCLOSURE AGREEMENT
This Non-Disclosure Agreement ("Agreement") is made effective as of January 15, 2026, by and between Harlow Studios Inc. ("Disclosing Party") and Priya Nandakumar, an individual consultant ("Receiving Party").

Disclosing Party intends to share certain proprietary game design documents and unreleased trailers ("Confidential Information") with Receiving Party solely for the purpose of evaluating a potential consulting engagement.

Receiving Party agrees not to use the Confidential Information for any purpose other than the Evaluation, and not to disclose it to any third party. Receiving Party further agrees not to solicit for hire any employee or contractor of Disclosing Party for a period of twelve (12) months following the date of this Agreement.

All materials, ideas, and intellectual property disclosed by Disclosing Party remain the sole and exclusive property of Disclosing Party. Nothing in this Agreement grants Receiving Party any license or ownership interest in such materials.

This Agreement shall terminate automatically eighteen (18) months from the effective date above.`,
    output: `{
  "detected_contract_type": "nda",
  "terms": [
    { "term_name": "Parties", "value": "Harlow Studios Inc. (Disclosing Party) and Priya Nandakumar, individual consultant (Receiving Party)", "page_number": 1, "confidence_score": 0.97, "source_sentence": "This Non-Disclosure Agreement (\\"Agreement\\") is made effective as of January 15, 2026, by and between Harlow Studios Inc. (\\"Disclosing Party\\") and Priya Nandakumar, an individual consultant (\\"Receiving Party\\").", "term_source": "standard" },
    { "term_name": "Effective Date", "value": "January 15, 2026", "page_number": 1, "confidence_score": 0.96, "source_sentence": "This Non-Disclosure Agreement (\\"Agreement\\") is made effective as of January 15, 2026, by and between Harlow Studios Inc. (\\"Disclosing Party\\") and Priya Nandakumar, an individual consultant (\\"Receiving Party\\").", "term_source": "standard" },
    { "term_name": "Confidentiality Obligations", "value": "Receiving Party agrees not to use the Confidential Information for any purpose other than the Evaluation, and not to disclose it to any third party.", "page_number": 1, "confidence_score": 0.94, "source_sentence": "Receiving Party agrees not to use the Confidential Information for any purpose other than the Evaluation, and not to disclose it to any third party.", "term_source": "standard" },
    { "term_name": "Permitted Disclosures", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Term & Duration", "value": "Terminates automatically 18 months from the effective date.", "page_number": 1, "confidence_score": 0.92, "source_sentence": "This Agreement shall terminate automatically eighteen (18) months from the effective date above.", "term_source": "standard" },
    { "term_name": "Governing Law", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Jurisdiction", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "IP Ownership", "value": "All materials, ideas, and intellectual property disclosed remain the sole and exclusive property of Disclosing Party.", "page_number": 1, "confidence_score": 0.93, "source_sentence": "All materials, ideas, and intellectual property disclosed by Disclosing Party remain the sole and exclusive property of Disclosing Party.", "term_source": "standard" },
    { "term_name": "Non-Solicitation", "value": "Receiving Party may not solicit for hire any employee or contractor of Disclosing Party for 12 months following the date of the Agreement.", "page_number": 1, "confidence_score": 0.91, "source_sentence": "Receiving Party further agrees not to solicit for hire any employee or contractor of Disclosing Party for a period of twelve (12) months following the date of this Agreement.", "term_source": "standard" },
    { "term_name": "Breach & Remedy", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" }
  ]
}`,
  },
  {
    input: `[PAGE 1]
CONFIDENTIALITY AGREEMENT
Between: Vantage Health Analytics Corp ("Company") and Meridian Capital Partners ("Recipient")
Date: September 9, 2025

Company wishes to share certain financial projections and clinical trial summaries with Recipient in connection with a possible investment ("Purpose"). Recipient shall keep such information confidential and use it solely for the Purpose. This obligation survives for three (3) years after disclosure.

Recipient may disclose the information to its officers, directors, and legal or financial advisors who need to know it for the Purpose, provided such persons are informed of its confidential nature.

Any dispute arising under this Agreement shall be resolved in the courts of New York County, New York, applying New York law.`,
    output: `{
  "detected_contract_type": "nda",
  "terms": [
    { "term_name": "Parties", "value": "Vantage Health Analytics Corp (Company) and Meridian Capital Partners (Recipient)", "page_number": 1, "confidence_score": 0.96, "source_sentence": "Between: Vantage Health Analytics Corp (\\"Company\\") and Meridian Capital Partners (\\"Recipient\\")", "term_source": "standard" },
    { "term_name": "Effective Date", "value": "September 9, 2025", "page_number": 1, "confidence_score": 0.9, "source_sentence": "Date: September 9, 2025", "term_source": "standard" },
    { "term_name": "Confidentiality Obligations", "value": "Recipient shall keep such information confidential and use it solely for the Purpose.", "page_number": 1, "confidence_score": 0.94, "source_sentence": "Recipient shall keep such information confidential and use it solely for the Purpose.", "term_source": "standard" },
    { "term_name": "Permitted Disclosures", "value": "Disclosure to officers, directors, and legal or financial advisors who need to know for the Purpose and are informed of the confidential nature.", "page_number": 1, "confidence_score": 0.92, "source_sentence": "Recipient may disclose the information to its officers, directors, and legal or financial advisors who need to know it for the Purpose, provided such persons are informed of its confidential nature.", "term_source": "standard" },
    { "term_name": "Term & Duration", "value": "Confidentiality obligation survives for three (3) years after disclosure.", "page_number": 1, "confidence_score": 0.93, "source_sentence": "This obligation survives for three (3) years after disclosure.", "term_source": "standard" },
    { "term_name": "Governing Law", "value": "New York law", "page_number": 1, "confidence_score": 0.92, "source_sentence": "Any dispute arising under this Agreement shall be resolved in the courts of New York County, New York, applying New York law.", "term_source": "standard" },
    { "term_name": "Jurisdiction", "value": "Courts of New York County, New York", "page_number": 1, "confidence_score": 0.92, "source_sentence": "Any dispute arising under this Agreement shall be resolved in the courts of New York County, New York, applying New York law.", "term_source": "standard" },
    { "term_name": "IP Ownership", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Non-Solicitation", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" },
    { "term_name": "Breach & Remedy", "value": "Not found in document", "page_number": 1, "confidence_score": 0, "source_sentence": "", "term_source": "standard" }
  ]
}`,
  },
]

export const ndaPrompt: PromptFile = {
  PROMPT_VERSION: 'nda-v1.0',
  CONTRACT_TYPE_LABEL: 'NDA',
  STANDARD_TERMS: NDA_STANDARD_TERMS,
  FEW_SHOT_EXAMPLES,
}

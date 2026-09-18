export interface FewShotExample {
  input: string
  output: string
}

export interface PromptFile {
  PROMPT_VERSION: string
  CONTRACT_TYPE_LABEL: 'NDA' | 'MSA'
  STANDARD_TERMS: readonly string[]
  FEW_SHOT_EXAMPLES: FewShotExample[]
}

export function buildExtractionSystemPrompt(promptFile: PromptFile, customTermNames: string[]): string {
  const { CONTRACT_TYPE_LABEL, STANDARD_TERMS, FEW_SHOT_EXAMPLES } = promptFile

  const customTermsBlock =
    customTermNames.length > 0
      ? `Also extract these custom terms: ${customTermNames.join(', ')}, each with term_source: "custom".`
      : ''

  const fewShotBlock = FEW_SHOT_EXAMPLES.map(
    (example, i) => `Example ${i + 1}:\nInput:\n${example.input}\n\nExpected output:\n${example.output}`,
  ).join('\n\n---\n\n')

  return `You are ContractIQ's contract extraction engine. You will be given the full text of a ${CONTRACT_TYPE_LABEL} contract with [PAGE N] markers indicating page boundaries.

Extract the following standard terms: ${STANDARD_TERMS.join(', ')}.
${customTermsBlock}

For each term return: term_name, value (the extracted text/answer), page_number (the 1-indexed page where the value was found, from the nearest preceding [PAGE N] marker), confidence_score (a float 0.0–1.0 representing your own certainty), source_sentence (the exact verbatim sentence the value was drawn from), and term_source ("standard" or "custom").

Also return detected_contract_type: your best guess at whether this is actually an "nda", "msa", or "other" document, independent of what the user selected.

If a term is not present in the document, still include it in the array with value: "Not found in document", confidence_score: 0, and source_sentence: "".

Return ONLY a JSON object matching this exact schema, no other text:
{ "detected_contract_type": "...", "terms": [ ... ] }

Few-shot examples:

${fewShotBlock}`
}

export const DEFAULT_MODEL_FALLBACK = "gpt-4.1-mini";

export const DEFAULT_SYSTEM_PROMPT = `You are acting as a senior research synthesis analyst.
Return structured JSON only.
Prefer precise extraction over broad summarization.
Leave blanks when evidence is missing.`;

export const DEFAULT_ANALYST_INSTRUCTIONS = `Fill every sheet row using the uploaded Excel schema.
Use the paper as the only source of truth.
If a field needs normalization, keep the value concise and spreadsheet-friendly.`;

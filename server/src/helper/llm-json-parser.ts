/**
 * Robust JSON parser for LLM responses.
 * Handles: markdown code fences, truncated output, trailing commas, control characters.
 *
 * 5-stage pipeline:
 *   1. Strip markdown fences
 *   2. Direct JSON.parse
 *   3. Regex extraction of JSON object/array
 *   4. Sanitize control chars + trailing commas
 *   5. Repair truncated JSON (close unclosed brackets/braces)
 */
export function parseLlmJson<T = unknown>(content: string): T | null {
  if (!content?.trim()) return null;

  let text = content.trim();

  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '');

  // 2. Try direct parse
  try {
    return JSON.parse(text) as T;
  } catch {
    // continue
  }

  // 3. Extract JSON object or array via regex
  const jsonMatch = text.match(/(\{[\s\S]*\})/) || text.match(/(\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as T;
    } catch {
      // continue
    }
  }

  // 4. Sanitize: remove control chars, fix trailing commas, double commas
  let sanitized = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(sanitized) as T;
  } catch {
    // continue
  }

  // 5. Repair truncated JSON — count unclosed brackets/braces and close them
  let repaired = sanitized;

  // Find the first { or [ to start from (skip any preamble text)
  const firstBrace = repaired.indexOf('{');
  const firstBracket = repaired.indexOf('[');
  let startIdx = -1;
  if (firstBrace >= 0 && firstBracket >= 0) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace >= 0) {
    startIdx = firstBrace;
  } else if (firstBracket >= 0) {
    startIdx = firstBracket;
  }

  if (startIdx < 0) return null; // No JSON structure found at all
  repaired = repaired.substring(startIdx);

  // Track nesting with a stack so we close in correct reverse order
  const nestingStack: ('{' | '[')[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of repaired) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') nestingStack.push('{');
    else if (ch === '}') { if (nestingStack.length && nestingStack[nestingStack.length - 1] === '{') nestingStack.pop(); }
    else if (ch === '[') nestingStack.push('[');
    else if (ch === ']') { if (nestingStack.length && nestingStack[nestingStack.length - 1] === '[') nestingStack.pop(); }
  }

  // Close unclosed string
  if (inString) repaired += '"';

  // Trim trailing incomplete key-value pair (e.g. `"key": "partial val`)
  repaired = repaired.replace(/,\s*"[^"]*"?\s*:\s*"?[^"]*$/, '');

  // Close unclosed structures in reverse nesting order
  for (let i = nestingStack.length - 1; i >= 0; i--) {
    repaired += nestingStack[i] === '{' ? '}' : ']';
  }

  // Final trailing comma cleanup
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(repaired) as T;
  } catch {
    // All attempts exhausted
  }

  return null;
}

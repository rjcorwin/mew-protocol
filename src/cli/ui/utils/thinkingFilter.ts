// @ts-nocheck
/**
 * Thinking tag filter
 *
 * Removes private reasoning/thinking sections from model output intended for display.
 * Examples removed:
 *   <thinking>...</thinking>
 *   <think>...</think>
 *   <reasoning>...</reasoning>
 *   <scratchpad>...</scratchpad>
 */
function stripThinkingTags(text) {
  if (!text) return '';
  let result = String(text);
  // Remove known reasoning blocks (non-greedy across newlines)
  const tagPattern = /<\s*(thinking|think|reasoning|scratchpad)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
  result = result.replace(tagPattern, '');
  // Also remove XML comments if present
  result = result.replace(/<!--([\s\S]*?)-->/g, '');
  // Collapse excessive blank lines and trailing spaces
  result = result
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return result;
}

export { stripThinkingTags };

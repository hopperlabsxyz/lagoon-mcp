/**
 * Test helper for parsing JSON from tool outputs that include disclaimers
 *
 * Tools append legal disclaimers after JSON output, which breaks standard JSON.parse().
 * This helper extracts the JSON portion before the disclaimer and parses it.
 *
 * @module test-helpers/json-parser
 */

/**
 * Parse JSON from text that may contain appended disclaimer
 *
 * Handles tool outputs in the format:
 * ```
 * {"key": "value", ...}
 *
 * ---
 *
 * ⚠️ **DISCLAIMER**: ...
 * ```
 *
 * @param text - Text containing JSON followed by optional disclaimer
 * @returns Parsed JSON object
 * @throws {SyntaxError} If JSON portion is invalid
 *
 * @example
 * ```typescript
 * const result = await executeTool(input);
 * const content = parseJsonWithDisclaimer(result.content[0].text as string);
 * expect(content.data).toBeDefined();
 * ```
 */
export function parseJsonWithDisclaimer(text: string): any {
  // Find where disclaimer starts - look for common disclaimer markers
  const disclaimerMarkers = [
    '\n\n---\n', // Full disclaimer marker
    '\n---\n', // Compact disclaimer marker
    '\n\n⚠️', // Warning emoji start
    '\n⚠️', // Warning emoji start (no double newline)
    '\n\n*Disclaimer:', // Minimal disclaimer start
    '\n*Disclaimer:', // Minimal disclaimer start (no double newline)
  ];

  let jsonText = text;

  // Find the earliest disclaimer marker
  for (const marker of disclaimerMarkers) {
    const markerIndex = text.indexOf(marker);
    if (markerIndex !== -1) {
      // Extract only the JSON portion before the disclaimer
      jsonText = text.substring(0, markerIndex);
      break;
    }
  }

  // Trim any trailing whitespace
  jsonText = jsonText.trim();

  // Parse and return the JSON
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new SyntaxError(
      `Failed to parse JSON from text. Error: ${error instanceof Error ? error.message : String(error)}\nText: ${jsonText.substring(0, 200)}...`
    );
  }
}

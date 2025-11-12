/**
 * Sanitize JSON-like strings that mistakenly use semicolons as delimiters.
 * The routine attempts to remove semicolons that appear before closing braces
 * and to convert semicolons that sit between values into commas so the string
 * becomes valid JSON again.
 *
 * @param {string} jsonLike The original JSON string that might contain stray semicolons.
 * @returns {string} A sanitized string that should be safe to hand to JSON.parse.
 */
export function sanitizeLooseSemicolons(jsonLike) {
  if (typeof jsonLike !== "string") {
    throw new TypeError("sanitizeLooseSemicolons expects a string input");
  }

  let sanitized = "";
  let inString = false;
  let escaping = false;
  let lastSignificantChar = "";

  for (let index = 0; index < jsonLike.length; index += 1) {
    const char = jsonLike[index];

    if (inString) {
      sanitized += char;

      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
        lastSignificantChar = "\"";
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      sanitized += char;
      continue;
    }

    if (/\s/.test(char)) {
      sanitized += char;
      continue;
    }

    if (char === ";") {
      const nextIndex = findNextNonWhitespaceIndex(jsonLike, index + 1);

      if (nextIndex === -1) {
        // Trailing semicolon at the end of the document.
        continue;
      }

      const nextChar = jsonLike[nextIndex];

      if (nextChar === "}" || nextChar === "]") {
        // Drop semicolons that appear right before a closing token.
        continue;
      }

      if (
        !lastSignificantChar ||
        lastSignificantChar === "{" ||
        lastSignificantChar === "[" ||
        lastSignificantChar === ":" ||
        lastSignificantChar === ","
      ) {
        // The semicolon follows a token where a separator does not make sense.
        continue;
      }

      sanitized += ",";
      lastSignificantChar = ",";
      continue;
    }

    sanitized += char;

    if (!/\s/.test(char)) {
      lastSignificantChar = char;
    }
  }

  return sanitized;
}

function findNextNonWhitespaceIndex(text, startIndex) {
  for (let index = startIndex; index < text.length; index += 1) {
    if (!/\s/.test(text[index])) {
      return index;
    }
  }

  return -1;
}

/**
 * Parse JSON text while being forgiving about stray semicolons. When sanitizing
 * still leaves the payload invalid, the thrown SyntaxError includes the
 * sanitized payload for easier debugging.
 *
 * @template T
 * @param {string} jsonLike The JSON string that may contain semicolons.
 * @param {{ sanitize?: boolean, includeSanitized?: boolean }} [options]
 *        sanitize          When true (default), semicolons are sanitized before parsing.
 *        includeSanitized  When true, the sanitized string is returned alongside the value.
 * @returns {T | { value: T, sanitized: string }} Either the parsed value or an object with
 *          the value and sanitized representation when includeSanitized is enabled.
 */
export function safeJsonParse(jsonLike, options = {}) {
  const { sanitize = true, includeSanitized = false } = options;

  if (typeof jsonLike !== "string") {
    throw new TypeError("safeJsonParse expects a string input");
  }

  const prepared = sanitize ? sanitizeLooseSemicolons(jsonLike) : jsonLike;

  try {
    const parsed = JSON.parse(prepared);

    if (includeSanitized) {
      return { value: parsed, sanitized: prepared };
    }

    return parsed;
  } catch (error) {
    const syntaxError = new SyntaxError(
      sanitize
        ? `Unable to parse JSON even after sanitizing loose semicolons: ${error.message}`
        : error.message
    );

    syntaxError.cause = error;

    if (sanitize) {
      syntaxError.sanitized = prepared;
    }

    throw syntaxError;
  }
}

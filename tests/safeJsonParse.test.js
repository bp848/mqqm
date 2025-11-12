import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeLooseSemicolons, safeJsonParse } from "../services/safeJsonParse.js";

test("sanitizeLooseSemicolons replaces semicolons acting as property separators", () => {
  const source = '{"first": 1; "second": 2;}';
  const expected = '{"first": 1, "second": 2}';

  assert.strictEqual(sanitizeLooseSemicolons(source), expected);
});

test("sanitizeLooseSemicolons keeps semicolons that live inside strings", () => {
  const source = '{"note": "Line one; line two"; "count": 2; }';
  const expected = '{"note": "Line one; line two", "count": 2 }';

  assert.strictEqual(sanitizeLooseSemicolons(source), expected);
});

test("safeJsonParse tolerates semicolons and returns the parsed value", () => {
  const input = '{"flag": true; "values": [1; 2; 3]; "title": "Hello";}';
  const { value, sanitized } = safeJsonParse(input, { includeSanitized: true });

  assert.deepStrictEqual(value, { flag: true, values: [1, 2, 3], title: "Hello" });
  assert.strictEqual(sanitized, '{"flag": true, "values": [1, 2, 3], "title": "Hello"}');
});

test("safeJsonParse reports the sanitized payload when parsing still fails", () => {
  const input = '{"a": 1;; }';

  assert.throws(
    () => safeJsonParse(input),
    (error) => {
      assert.ok(error instanceof SyntaxError);
      assert.match(error.message, /Unable to parse JSON even after sanitizing/);
      assert.strictEqual(error.sanitized, '{"a": 1, }');
      return true;
    }
  );
});

test("safeJsonParse can opt out of sanitizing", () => {
  const input = '{"value": 1}';
  assert.deepStrictEqual(safeJsonParse(input, { sanitize: false }), { value: 1 });
});

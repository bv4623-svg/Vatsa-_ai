// Runs frontend/src/lib/home/imageQuery.ts against the cases shared with the
// backend (shared/image-intent-cases.json; Backend/tests/test_image_intent.py
// runs the same file against detect_image_gen). Node strips the TypeScript
// types itself, so this needs no test framework.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractImagePrompt, isImageGenQuery } from "../src/lib/home/imageQuery.ts";

const cases = JSON.parse(readFileSync(new URL("../../shared/image-intent-cases.json", import.meta.url), "utf8"));
const failures = [];

for (const { text, prompt } of cases.chat) {
  const got = extractImagePrompt(text, "chat");
  if (got !== prompt || isImageGenQuery(text) !== (prompt !== null)) failures.push({ text, expected: prompt, got });
}
for (const { text, prompt } of cases.code_workspace) {
  const got = extractImagePrompt(text, "code");
  if (got !== prompt) failures.push({ text, workspace: "code", expected: prompt, got });
}
const long = extractImagePrompt("generate an image of " + "a very long scene ".repeat(200));
if (!long || long.length > 1000) failures.push({ text: "(prompt length cap)", got: long?.length });

const images = cases.chat.filter((c) => c.prompt !== null).length;
const texts = cases.chat.length - images;
assert.ok(images >= 15 && texts >= 6, `need at least 15 image and 6 text cases, have ${images} and ${texts}`);

if (failures.length) {
  console.error(`image intent: ${failures.length} case(s) disagree with the backend:`);
  for (const f of failures) console.error("  ", JSON.stringify(f));
  process.exit(1);
}
console.log(`image intent: all ${cases.chat.length + cases.code_workspace.length} shared cases match (${images} image, ${texts} text, ${cases.code_workspace.length} code workspace)`);

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const readmePath = path.join(repositoryRoot, "README.md");
const readme = readFileSync(readmePath, "utf8");

const blockedPatterns = [
  {
    pattern: /^## Repository guide$/m,
    message: "Public README must not include internal repository guide content."
  },
  {
    pattern: /`\.github\/copilot-instructions\.md`/,
    message: "Public README must not reference .github/copilot-instructions.md."
  },
  {
    pattern: /`\.specify\/memory\/constitution\.md`/,
    message: "Public README must not reference .specify/memory/constitution.md."
  },
  {
    pattern: /`product\/`/,
    message: "Public README must not reference the internal product/ directory."
  },
  {
    pattern: /`architecture\/`/,
    message: "Public README must not reference the internal architecture/ directory."
  }
];

const violations = blockedPatterns
  .filter(({ pattern }) => pattern.test(readme))
  .map(({ message }) => message);

if (violations.length > 0) {
  console.error("README.md contains internal-only content that must not be published:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("README.md passed public documentation validation.");

import { mkdir, readFile, writeFile } from "node:fs/promises";

async function readLatestEvalReport() {
  try {
    return JSON.parse(await readFile(new URL("../evals/results/latest.json", import.meta.url), "utf8"));
  } catch {
    return null;
  }
}

const report = await readLatestEvalReport();
const generatedAt = new Date().toISOString();
const status = report && report.totals.score >= 90 && report.totals.criticalFailures === 0 ? "Ready for MVP testing" : "Needs review";

const body = `# Persona Studio AI Test Report

Generated at: ${generatedAt}

## Overall Status

${status}

## Eval Summary

- Dataset version: ${report?.datasetVersion || "Not run"}
- Total cases: ${report?.totals.cases ?? 0}
- Passed: ${report?.totals.passed ?? 0}
- Failed: ${report?.totals.failed ?? 0}
- Score: ${report?.totals.score ?? 0}%
- Critical failures: ${report?.totals.criticalFailures ?? 0}

## Metrics

- Intent accuracy: ${report?.metrics.intentAccuracy ?? 0}%
- Answer mode accuracy: ${report?.metrics.answerModeAccuracy ?? 0}%
- External info routing accuracy: ${report?.metrics.externalInfoNeedAccuracy ?? 0}%
- Web-search decision accuracy: ${report?.metrics.webSearchDecisionAccuracy ?? 0}%
- Fallback accuracy: ${report?.metrics.fallbackAccuracy ?? 0}%

## Failed Cases

${
  report?.cases?.filter((item) => !item.passed).length
    ? report.cases
        .filter((item) => !item.passed)
        .map(
          (item) =>
            `- ${item.personaId}/${item.promptId}: expected intent ${item.expectedIntent}, got ${item.actualIntent}; expected mode ${item.expectedAnswerMode}, got ${item.actualAnswerMode}; expected external info ${item.expectedExternalInfoNeed}, got ${item.actualExternalInfoNeed}; expected web ${item.expectedWeb}, got ${item.actualWeb}; expected fallback ${item.expectedFallback}, got ${item.actualFallback}`,
        )
        .join("\n")
    : "- None"
}

## Manual Checks Still Required

- Create a creator account.
- Create or edit a persona.
- Publish persona.
- Open the fan URL.
- Sign in as fan.
- Test greeting, vague, real, risky, and web-needed prompts.
- Confirm creator dashboard metrics update.

`;

await mkdir(new URL("../Test documentation", import.meta.url), { recursive: true });
await writeFile(new URL("../Test documentation/Test Report.md", import.meta.url), body);
console.log("Wrote Test documentation/Test Report.md");

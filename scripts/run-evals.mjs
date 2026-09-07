import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

async function importPersonaRuntime() {
  const source = await readFile(new URL("../lib/persona.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const dir = await mkdtemp(path.join(tmpdir(), "persona-evals-"));
  const file = path.join(dir, "persona.mjs");
  await writeFile(file, output);
  return import(file);
}

const runtime = await importPersonaRuntime();
const dataset = JSON.parse(await readFile(new URL("../evals/golden-dataset.json", import.meta.url), "utf8"));

function personaRecord(persona) {
  return {
    creator_name: persona.creatorName,
    creator_handle: persona.creatorHandle,
    source_content: persona.sourceContent,
    profile: persona.profile,
    enabled_guardrails: {
      identity: true,
      medical: true,
      financial: true,
      legal: true,
      politics: true,
      personal: true,
    },
    custom_boundary: "",
    fallback_text: "I cannot speak to that one from approved public context.",
    monetization: "free",
    price_cents: 0,
    status: "live",
  };
}

const cases = [];

for (const persona of dataset.personas) {
  const record = personaRecord(persona);
  const retrievedContext = persona.profile.retrievalChunks.join("\n\n");

  for (const prompt of persona.prompts) {
    const flagReason = runtime.findFlag(record, prompt.input);
    const intent = runtime.detectChatIntent(prompt.input, flagReason);
    const answerMode = runtime.detectAnswerMode(prompt.input, intent);
    const externalInfoNeed = runtime.detectExternalInfoNeed(prompt.input, intent, flagReason);
    const useWeb = runtime.shouldUseWebSearchForPersona(
      prompt.input,
      intent,
      flagReason,
      retrievedContext,
      record.profile,
      record.source_content,
    );
    const fallback = Boolean(flagReason);
    const expectedAnswerMode = prompt.expectedAnswerMode || "chat";
    const expectedExternalInfoNeed = prompt.expectedExternalInfoNeed || "none";
    const passed =
      intent === prompt.expectedIntent &&
      answerMode === expectedAnswerMode &&
      externalInfoNeed === expectedExternalInfoNeed &&
      useWeb === prompt.expectWeb &&
      fallback === prompt.expectFallback;

    cases.push({
      personaId: persona.id,
      promptId: prompt.id,
      input: prompt.input,
      expectedIntent: prompt.expectedIntent,
      actualIntent: intent,
      expectedAnswerMode,
      actualAnswerMode: answerMode,
      expectedExternalInfoNeed,
      actualExternalInfoNeed: externalInfoNeed,
      expectedWeb: prompt.expectWeb,
      actualWeb: useWeb,
      expectedFallback: prompt.expectFallback,
      actualFallback: fallback,
      flagReason,
      passed,
    });
  }
}

const passed = cases.filter((item) => item.passed).length;
const failed = cases.length - passed;
const score = Math.round((passed / cases.length) * 100);
const criticalFailures = cases.filter(
    (item) =>
      !item.passed &&
    (item.expectedIntent === "risky" ||
      item.expectedFallback ||
      item.actualWeb !== item.expectedWeb ||
      item.actualAnswerMode !== item.expectedAnswerMode ||
      item.actualExternalInfoNeed !== item.expectedExternalInfoNeed),
);

const report = {
  datasetVersion: dataset.version,
  generatedAt: new Date().toISOString(),
  totals: {
    cases: cases.length,
    passed,
    failed,
    score,
    criticalFailures: criticalFailures.length,
  },
  metrics: {
    intentAccuracy: Math.round((cases.filter((item) => item.expectedIntent === item.actualIntent).length / cases.length) * 100),
    webSearchDecisionAccuracy: Math.round((cases.filter((item) => item.expectedWeb === item.actualWeb).length / cases.length) * 100),
    fallbackAccuracy: Math.round((cases.filter((item) => item.expectedFallback === item.actualFallback).length / cases.length) * 100),
    answerModeAccuracy: Math.round(
      (cases.filter((item) => item.expectedAnswerMode === item.actualAnswerMode).length / cases.length) * 100,
    ),
    externalInfoNeedAccuracy: Math.round(
      (cases.filter((item) => item.expectedExternalInfoNeed === item.actualExternalInfoNeed).length / cases.length) * 100,
    ),
  },
  cases,
};

await mkdir(new URL("../evals/results", import.meta.url), { recursive: true });
await writeFile(new URL("../evals/results/latest.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);

console.log(`Persona eval score: ${score}% (${passed}/${cases.length})`);
if (failed) {
  for (const item of cases.filter((entry) => !entry.passed)) {
    console.log(`FAIL ${item.personaId}/${item.promptId}: intent ${item.actualIntent}/${item.expectedIntent}, mode ${item.actualAnswerMode}/${item.expectedAnswerMode}, external ${item.actualExternalInfoNeed}/${item.expectedExternalInfoNeed}, web ${item.actualWeb}/${item.expectedWeb}, fallback ${item.actualFallback}/${item.expectedFallback}`);
  }
}

if (score < 90 || criticalFailures.length) {
  process.exitCode = 1;
}

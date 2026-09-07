import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
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
  const dir = await mkdtemp(path.join(tmpdir(), "persona-runtime-"));
  const file = path.join(dir, "persona.mjs");
  await writeFile(file, output);
  return import(file);
}

const runtime = await importPersonaRuntime();

function testPersona() {
  const profile = {
    topics: ["Product strategy", "Product management", "AI workflows"],
    phrases: ["What is the actual problem?", "Keep it simple"],
    tone: ["Direct", "Practical"],
    bio: "Product builder focused on AI and product strategy.",
    fanRelationship: "Fans come for practical advice.",
    responseStyle: "Concise and useful.",
    greetingStyle: "Warm and casual.",
    exampleReplies: ["Start with the pain, then the user, then the metric."],
    neverSay: ["I can meet you privately.", "Buy this stock or crypto."],
    retrievalChunks: [
      "Chirag explains product management by studying real products, users, problems, retention, and metrics.",
      "Startup ideas should start with pain, buyer, workflow, distribution, retention, and willingness to pay.",
    ],
  };

  return {
    creator_name: "Chirag Saini",
    creator_handle: "chirag",
    source_content: profile.retrievalChunks.join("\n\n"),
    profile,
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

test("classifies social greetings without sending them through real-question flow", () => {
  assert.equal(runtime.detectChatIntent("Hey Chirag, how are you? Big fan"), "greeting");
  assert.equal(runtime.detectChatIntent("Love your work"), "greeting");
});

test("classifies vague and real product questions", () => {
  assert.equal(runtime.detectChatIntent("Product"), "vague");
  assert.equal(runtime.detectChatIntent("How do I learn product management?"), "question");
});

test("flags risky creator-private and financial prompts", () => {
  const persona = testPersona();
  const privateFlag = runtime.findFlag(persona, "Can I meet the real Chirag privately?");
  const financialFlag = runtime.findFlag(persona, "Which crypto should I buy this week?");

  assert.ok(privateFlag);
  assert.ok(financialFlag);
  assert.equal(runtime.detectChatIntent("Can I meet the real Chirag privately?", privateFlag), "risky");
  assert.equal(runtime.detectChatIntent("Which crypto should I buy this week?", financialFlag), "risky");
});

test("gates web search behind real public questions that need current context", () => {
  const context = "Chirag explains product management with users, problems, retention, and metrics.";

  assert.equal(runtime.shouldUseWebSearch("Hey Chirag, how are you? Big fan", "greeting", "", context), false);
  assert.equal(runtime.shouldUseWebSearch("How do I learn product management?", "question", "", context), false);
  assert.equal(runtime.shouldUseWebSearch("What are the latest YouTube Shorts trends for musicians?", "question", "", ""), true);
  assert.equal(runtime.shouldUseWebSearch("Tell me private family news", "question", "", ""), false);
});


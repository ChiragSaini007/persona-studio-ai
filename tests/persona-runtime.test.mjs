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
    supportedLanguages: ["English", "Hinglish"],
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

test("supports creator-approved Hinglish greetings", () => {
  const persona = testPersona();
  const intent = runtime.classifyPersonaMessage("bhai kaise ho", persona.profile, persona.source_content);

  assert.equal(intent, "greeting");
  assert.equal(runtime.detectSupportedLanguage("bhai kaise ho", persona.profile), "Hinglish");
  assert.match(runtime.buildLocalReply(persona, "bhai kaise ho", ""), /Arre bhai/i);
});

test("classifies vague and real product questions", () => {
  assert.equal(runtime.detectChatIntent("Product"), "vague");
  assert.equal(runtime.detectChatIntent("How do I learn product management?"), "question");
});

test("uses recent chat context to classify short case-study follow ups", () => {
  const history = [
    { role: "fan", text: "Lets do a live case study on zepto" },
    { role: "persona", text: "Let's break Zepto down with a business strategy framework." },
    { role: "fan", text: "Lets do a complete case on Zepto." },
  ];

  assert.equal(runtime.detectChatIntent("Target market"), "vague");
  assert.equal(runtime.detectChatIntentWithHistory("Target market", "", history), "question");
  assert.equal(runtime.detectChatIntentWithHistory("Pricing", "", history), "question");
});

test("resolves short metric follow ups into the active business case", () => {
  const history = [
    { role: "fan", text: "Lets do a business case on Swiggy" },
    { role: "persona", text: "Swiggy is a fascinating case. We can break down user base, model, competition, and expansion." },
    { role: "fan", text: "Explain me with some numbers" },
  ];
  const intent = runtime.detectChatIntentWithHistory("user growth", "", history);
  const resolved = runtime.resolveQuestionWithHistory("user growth", intent, history);

  assert.equal(intent, "question");
  assert.match(resolved, /Swiggy/);
  assert.match(resolved, /numbers|concrete/i);
  assert.equal(runtime.detectExternalInfoNeed(resolved, intent), "live_public_fact");
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
  const persona = testPersona();

  assert.equal(runtime.shouldUseWebSearch("Hey Chirag, how are you? Big fan", "greeting", "", context), false);
  assert.equal(runtime.shouldUseWebSearch("How do I learn product management?", "question", "", context), false);
  assert.equal(runtime.shouldUseWebSearch("What are the latest YouTube Shorts trends for musicians?", "question", "", ""), true);
  assert.equal(runtime.shouldUseWebSearch("I want to estimate the damage that has happened in Nepal floods in INR.", "question", "", ""), true);
  assert.equal(runtime.shouldUseWebSearch("What is the weather in Nepal today?", "question", "", ""), true);
  assert.equal(runtime.shouldUseWebSearch("What is USD to INR today?", "question", "", ""), true);
  assert.equal(runtime.shouldUseWebSearch("Tell me private family news", "question", "", ""), false);
  assert.equal(
    runtime.shouldUseWebSearchForPersona("What is the weather in Nepal today?", "question", "", "", persona.profile, persona.source_content),
    false,
  );
  assert.equal(
    runtime.shouldUseWebSearchForPersona(
      "I want to estimate the damage that has happened in Nepal floods in INR.",
      "question",
      "",
      "",
      persona.profile,
      persona.source_content,
    ),
    true,
  );
});

test("detects live external information needs for tool-backed answers", () => {
  assert.equal(runtime.detectExternalInfoNeed("What is the weather in Nepal today?", "question"), "weather");
  assert.equal(runtime.detectExternalInfoNeed("What is USD to INR today?", "question"), "currency");
  assert.equal(runtime.detectExternalInfoNeed("How did Zepto grow so fast?", "question"), "live_public_fact");
  assert.equal(runtime.detectExternalInfoNeed("How do I learn product management?", "question"), "none");
  assert.equal(runtime.detectExternalInfoNeed("Give me your private phone number", "question"), "none");
});

test("detects estimation questions as a separate answer mode", () => {
  assert.equal(runtime.detectAnswerMode("How do I learn product management?", "question"), "chat");
  assert.equal(runtime.detectAnswerMode("Show me an example calculation", "question"), "estimation");
  assert.equal(runtime.detectAnswerMode("Estimate Nepal flood damage in INR", "question"), "estimation");
  assert.equal(runtime.detectAnswerMode("Hey Chirag", "greeting"), "chat");
});

test("keeps random fan topics outside the creator domain", () => {
  const persona = testPersona();
  const dinosaurIntent = runtime.classifyPersonaMessage(
    "Lets discuss about Dinosaur",
    persona.profile,
    persona.source_content,
  );
  const movieIntent = runtime.classifyPersonaMessage(
    "Loved your Movie sir",
    persona.profile,
    persona.source_content,
  );

  assert.equal(dinosaurIntent, "off_topic");
  assert.equal(movieIntent, "identity_confusion");
  assert.match(runtime.buildLocalReply(persona, "Lets discuss about Dinosaur", ""), /not really Chirag's lane/i);
  assert.match(runtime.buildLocalReply(persona, "Loved your Movie sir", ""), /may not be the person you meant/i);
});

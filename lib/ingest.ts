import { extractText, getDocumentProxy } from "unpdf";

export type IngestResult = { text: string; chars: number; kind: "pdf" | "audio" | "text"; warnings: string[] };

const audioTypes = new Set(["mp3", "m4a", "wav", "webm", "mp4", "mpeg", "mpga", "ogg", "oga", "flac"]);

export function fileKind(name: string): "pdf" | "audio" | "text" | null {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "pdf";
  if (audioTypes.has(ext)) return "audio";
  if (["txt", "md", "srt", "vtt", "csv", "json"].includes(ext)) return "text";
  return null;
}

export async function readPdf(buffer: Buffer): Promise<IngestResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const warnings: string[] = [];
  if (clean.length < 50 * Math.max(1, totalPages)) {
    warnings.push("Very little text was found. This may be a scanned PDF made of images. Scanned PDFs need OCR, which is not supported yet.");
  }
  return { text: clean, chars: clean.length, kind: "pdf", warnings };
}

// Transcribes speech with OpenAI. Files up to 25 MB; auto-detects the language (including Hindi and other Indian languages).
export async function transcribeAudio(buffer: Buffer, name: string): Promise<IngestResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("Transcription needs an OpenAI key");
  const models = ["gpt-4o-transcribe", "whisper-1"];
  let lastError = "";
  for (const model of models) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)]), name);
    form.append("model", model);
    form.append("response_format", "json");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!response.ok) {
      lastError = `${model}: ${response.status} ${(await response.text()).slice(0, 200)}`;
      continue;
    }
    const data = (await response.json()) as { text?: string };
    const text = (data.text || "").trim();
    const warnings = text.length < 20 ? ["Almost nothing was transcribed. Check that the file has clear speech."] : [];
    return { text, chars: text.length, kind: "audio", warnings };
  }
  throw new Error(`Transcription failed. ${lastError}`);
}

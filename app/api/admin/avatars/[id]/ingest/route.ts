import { NextRequest, NextResponse } from "next/server";
import { activeAgreement, adminError, downloadTrainingFile, logAudit, requireStaff } from "../../../../../../lib/admin";
import { loadAvatar } from "../../../../../../lib/admin-avatars";
import { fileKind, IngestResult, readPdf, transcribeAudio } from "../../../../../../lib/ingest";

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 300;

// Step 2: reads the uploaded file and returns its text. Nothing is saved to the avatar until staff review and save it.
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await request.json();
  const path = typeof body.path === "string" ? body.path : "";
  const name = typeof body.name === "string" ? body.name : "";

  if (!path.startsWith(`${id}/`) || path.includes("..")) return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  const kind = fileKind(name);
  if (!kind) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    if (!(await activeAgreement(id, "text"))) {
      return NextResponse.json({ error: "Upload an active signed text agreement before adding content" }, { status: 400 });
    }

    const buffer = await downloadTrainingFile(path);
    let result: IngestResult;
    if (kind === "pdf") result = await readPdf(buffer);
    else if (kind === "audio") result = await transcribeAudio(buffer, name);
    else result = { text: buffer.toString("utf8").trim(), chars: buffer.toString("utf8").trim().length, kind: "text", warnings: [] };

    await logAudit(auth.staff, "content_file_ingested", id, { file: name, kind: result.kind, bytes: buffer.length, chars: result.chars, path });
    return NextResponse.json({ ...result, name });
  } catch (error) {
    return adminError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { adminError, createTrainingUpload, maxTrainingFileBytes, requireStaff } from "../../../../../../../lib/admin";
import { loadAvatar } from "../../../../../../../lib/admin-avatars";
import { fileKind } from "../../../../../../../lib/ingest";

type Context = { params: Promise<{ id: string }> };

// Step 1 of file ingestion: hands the browser a short-lived link to upload straight to storage.
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name : "";
  const size = Number(body.size || 0);

  if (!fileKind(name)) {
    return NextResponse.json({ error: "Use a PDF, audio file (mp3, m4a, wav, webm, mp4, ogg, flac) or text file (txt, md, srt, vtt, csv, json)" }, { status: 400 });
  }
  if (size > maxTrainingFileBytes) {
    return NextResponse.json({ error: "Files must be 25 MB or smaller. Compress or split longer recordings." }, { status: 400 });
  }
  try {
    const avatar = await loadAvatar(id);
    if (!avatar) return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${id}/${Date.now()}-${safeName}`;
    const uploadUrl = await createTrainingUpload(path);
    return NextResponse.json({ uploadUrl, path });
  } catch (error) {
    return adminError(error);
  }
}

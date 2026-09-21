import { env } from "cloudflare:workers";
import { ensureSchema, getD1 } from "../../../../db";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const configuredAdmin = ((env.ADMIN_EMAIL as string | undefined) ?? process.env.ADMIN_EMAIL)?.toLowerCase();
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");

  if (!user || !configuredAdmin || user.email.toLowerCase() !== configuredAdmin) {
    return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }

  const formData = await request.formData();
  if (formData.get("confirm") !== "RESET_TEST_DATA") {
    return Response.json({ error: "초기화 확인값이 올바르지 않습니다." }, { status: 400 });
  }

  await ensureSchema();
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM choices"),
    db.prepare("DELETE FROM participants WHERE is_sample = 0"),
  ]);

  return Response.redirect(new URL("/admin?reset=done", request.url), 303);
}

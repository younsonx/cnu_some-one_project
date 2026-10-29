import { env } from "cloudflare:workers";
import { ensureSchema, getD1 } from "../../../../db";
import { getChatGPTUser } from "../../../chatgpt-auth";

const DEPARTED_JOB = "중도퇴장";

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
  const participantId = String(formData.get("participantId") ?? "");
  const action = formData.get("action");
  if (!participantId || (action !== "depart" && action !== "restore")) {
    return Response.json({ error: "참가자 상태 요청이 올바르지 않습니다." }, { status: 400 });
  }

  await ensureSchema();
  const db = getD1();
  const event = await db.prepare("SELECT current_stage AS currentStage FROM event_state WHERE id = 1")
    .first<{ currentStage: number }>();
  if ((event?.currentStage ?? 1) >= 4) {
    return Response.json({ error: "최종 결과 공개 후에는 참가 상태를 변경할 수 없습니다." }, { status: 409 });
  }

  const participant = await db.prepare("SELECT id FROM participants WHERE id = ? AND is_sample = 0 LIMIT 1")
    .bind(participantId).first<{ id: string }>();
  if (!participant) return Response.json({ error: "참가자를 찾을 수 없습니다." }, { status: 404 });

  await db.prepare("UPDATE participants SET job = ? WHERE id = ?")
    .bind(action === "depart" ? DEPARTED_JOB : "참가자", participantId).run();

  if ((event?.currentStage ?? 1) === 3) {
    const counts = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM participants WHERE is_sample = 0 AND job != ?) AS expected,
        (SELECT COUNT(DISTINCT c.sender_id) FROM choices c JOIN participants p ON p.id = c.sender_id
          WHERE c.stage = 3 AND p.is_sample = 0 AND p.job != ?) AS completed
    `).bind(DEPARTED_JOB, DEPARTED_JOB).first<{ expected: number; completed: number }>();
    if (counts && counts.expected > 0 && counts.completed >= counts.expected) {
      await db.prepare("UPDATE event_state SET current_stage = 4, updated_at = CURRENT_TIMESTAMP WHERE id = 1 AND current_stage = 3").run();
    }
  }

  return Response.redirect(new URL(`/admin?attendance=${action === "depart" ? "departed" : "restored"}`, request.url), 303);
}

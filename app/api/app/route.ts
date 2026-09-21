import { ensureSchema, getD1 } from "../../../db";

type Gender = "male" | "female";
type ParticipantRow = { id: string; nickname: string; gender: Gender; avatar: string; job: string; is_sample: number };

const samples = [
  ["sample-m1", "sample-m1", "서준", "male", "🧑🏻‍💻", "브랜드 마케터"],
  ["sample-m2", "sample-m2", "민재", "male", "👨🏻‍🎨", "건축 디자이너"],
  ["sample-m3", "sample-m3", "도윤", "male", "🧑🏻‍🎬", "콘텐츠 PD"],
  ["sample-m4", "sample-m4", "하준", "male", "👨🏻‍💼", "스타트업 PM"],
  ["sample-f1", "sample-f1", "수아", "female", "👩🏻‍🦰", "플로리스트"],
  ["sample-f2", "sample-f2", "지민", "female", "👩🏻‍💻", "서비스 기획자"],
  ["sample-f3", "sample-f3", "채원", "female", "👩🏻‍🎨", "일러스트레이터"],
  ["sample-f4", "sample-f4", "유진", "female", "👩🏻‍🔬", "연구원"],
] as const;

async function prepare() {
  await ensureSchema();
  const db = getD1();
  await db.batch(samples.map((p) => db.prepare(
    "INSERT OR IGNORE INTO participants (id, session_token, nickname, gender, avatar, job, is_sample) VALUES (?, ?, ?, ?, ?, ?, 1)",
  ).bind(...p)));
  return db;
}

function tokenFrom(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

async function profileForToken(db: D1Database, token: string) {
  if (!token) return null;
  return db.prepare("SELECT id, nickname, gender, avatar, job, is_sample FROM participants WHERE session_token = ? AND is_sample = 0")
    .bind(token).first<ParticipantRow>();
}

async function stateFor(db: D1Database, profile: ParticipantRow) {
  const opponents = await db.prepare(
    "SELECT id, nickname, gender, avatar, job, is_sample FROM participants WHERE gender != ? AND id != ? ORDER BY is_sample DESC, created_at ASC",
  ).bind(profile.gender, profile.id).all<ParticipantRow>();
  const completedRows = await db.prepare("SELECT DISTINCT stage FROM choices WHERE sender_id = ? ORDER BY stage")
    .bind(profile.id).all<{ stage: number }>();
  const actualResults = await db.prepare(`
    SELECT c.stage, c.heart_color AS heartColor, p.nickname, p.avatar
    FROM choices c JOIN participants p ON p.id = c.sender_id
    WHERE c.recipient_id = ? ORDER BY c.stage, c.created_at
  `).bind(profile.id).all<{ stage: number; heartColor: "red" | "yellow"; nickname: string; avatar: string }>();

  const demoResults = profile.gender === "male"
    ? [
        { stage: 1, heartColor: "red", nickname: "수아", avatar: "👩🏻‍🦰" },
        { stage: 1, heartColor: "yellow", nickname: "지민", avatar: "👩🏻‍💻" },
        { stage: 3, heartColor: "red", nickname: "채원", avatar: "👩🏻‍🎨" },
      ]
    : [
        { stage: 2, heartColor: "red", nickname: "민재", avatar: "👨🏻‍🎨" },
        { stage: 2, heartColor: "yellow", nickname: "도윤", avatar: "🧑🏻‍🎬" },
        { stage: 3, heartColor: "red", nickname: "서준", avatar: "🧑🏻‍💻" },
      ];

  return {
    profile,
    opponents: opponents.results,
    completedStages: completedRows.results.map((row) => row.stage),
    results: [...demoResults, ...actualResults.results],
  };
}

export async function GET(request: Request) {
  try {
    const db = await prepare();
    const profile = await profileForToken(db, tokenFrom(request));
    if (!profile) return Response.json({ error: "프로필을 찾을 수 없어요." }, { status: 401 });
    return Response.json(await stateFor(db, profile));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "불러오지 못했어요." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await prepare();
    const payload = await request.json() as {
      action?: "createProfile" | "submitChoice";
      nickname?: string;
      gender?: Gender;
      stage?: number;
      redRecipientId?: string;
      yellowRecipientId?: string;
    };

    if (payload.action === "createProfile") {
      const nickname = payload.nickname?.trim() ?? "";
      if (nickname.length < 2 || nickname.length > 12) return Response.json({ error: "닉네임은 2~12자로 입력해 주세요." }, { status: 400 });
      if (payload.gender !== "male" && payload.gender !== "female") return Response.json({ error: "성별을 선택해 주세요." }, { status: 400 });
      const id = crypto.randomUUID();
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
      try {
        await db.prepare("INSERT INTO participants (id, session_token, nickname, gender, avatar, job, is_sample) VALUES (?, ?, ?, ?, ?, '참가자', 0)")
          .bind(id, token, nickname, payload.gender, payload.gender === "male" ? "🧑🏻" : "👩🏻").run();
      } catch {
        return Response.json({ error: "이미 사용 중인 닉네임이에요." }, { status: 409 });
      }
      const profile = await profileForToken(db, token);
      return Response.json({ token, ...(await stateFor(db, profile!)) }, { status: 201 });
    }

    const profile = await profileForToken(db, tokenFrom(request));
    if (!profile) return Response.json({ error: "다시 입장해 주세요." }, { status: 401 });
    if (payload.action !== "submitChoice") return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
    const stage = payload.stage;
    const allowedStage = (profile.gender === "female" && stage === 1) || (profile.gender === "male" && stage === 2) || stage === 3;
    if (!allowedStage) return Response.json({ error: "현재 참여할 수 없는 선택이에요." }, { status: 403 });
    if (!payload.redRecipientId || (stage !== 3 && !payload.yellowRecipientId)) return Response.json({ error: "보낼 마음을 모두 선택해 주세요." }, { status: 400 });

    const recipientIds = [payload.redRecipientId, payload.yellowRecipientId].filter(Boolean) as string[];
    const placeholders = recipientIds.map(() => "?").join(",");
    const validRecipients = await db.prepare(`SELECT id FROM participants WHERE gender != ? AND id IN (${placeholders})`)
      .bind(profile.gender, ...recipientIds).all<{ id: string }>();
    if (new Set(validRecipients.results.map((row) => row.id)).size !== new Set(recipientIds).size) return Response.json({ error: "선택한 참가자를 확인해 주세요." }, { status: 400 });

    const existing = await db.prepare("SELECT 1 AS found FROM choices WHERE sender_id = ? AND stage = ? LIMIT 1").bind(profile.id, stage).first();
    if (existing) return Response.json({ error: "이미 제출한 선택은 바꿀 수 없어요." }, { status: 409 });
    const inserts = [db.prepare("INSERT INTO choices (sender_id, recipient_id, stage, heart_color) VALUES (?, ?, ?, 'red')").bind(profile.id, payload.redRecipientId, stage)];
    if (stage !== 3) inserts.push(db.prepare("INSERT INTO choices (sender_id, recipient_id, stage, heart_color) VALUES (?, ?, ?, 'yellow')").bind(profile.id, payload.yellowRecipientId, stage));
    await db.batch(inserts);
    return Response.json(await stateFor(db, profile));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "저장하지 못했어요." }, { status: 500 });
  }
}

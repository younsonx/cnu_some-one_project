import { ensureSchema, getD1 } from "../../../db";

type Gender = "male" | "female";
type ParticipantRow = {
  id: string;
  nickname: string;
  gender: Gender;
  avatar: string;
  job: string;
  is_sample: number;
};

// Cloudflare Workers' Web Crypto implementation accepts at most 100,000
// PBKDF2 iterations per deriveBits call.
const PASSWORD_ITERATIONS = 100_000;

async function prepare() {
  await ensureSchema();
  return getD1();
}

function tokenFrom(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function createToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

async function hashPassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function validateCredentials(nickname: string, password: string) {
  if (nickname.length < 2 || nickname.length > 12) return "닉네임은 2~12자로 입력해 주세요.";
  if (password.length < 4 || password.length > 32) return "비밀번호는 4~32자로 입력해 주세요.";
  return null;
}

async function profileForToken(db: D1Database, token: string) {
  if (!token) return null;
  return db.prepare(`
    SELECT p.id, p.nickname, p.gender, p.avatar, p.job, p.is_sample
    FROM participants p
    WHERE p.is_sample = 0 AND (
      p.session_token = ? OR EXISTS (
        SELECT 1 FROM participant_sessions s
        WHERE s.participant_id = p.id AND s.token = ?
      )
    )
    LIMIT 1
  `).bind(token, token).first<ParticipantRow>();
}

async function readCurrentStage(db: D1Database) {
  const row = await db.prepare("SELECT current_stage AS currentStage FROM event_state WHERE id = 1")
    .first<{ currentStage: number }>();
  return row?.currentStage ?? 1;
}

async function stageCounts(db: D1Database) {
  const rows = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM participants WHERE is_sample = 0 AND gender = 'female') AS women,
      (SELECT COUNT(*) FROM participants WHERE is_sample = 0 AND gender = 'male') AS men,
      (SELECT COUNT(*) FROM participants WHERE is_sample = 0) AS total,
      (SELECT COUNT(DISTINCT c.sender_id) FROM choices c JOIN participants p ON p.id = c.sender_id WHERE c.stage = 1 AND p.is_sample = 0 AND p.gender = 'female') AS stage1Done,
      (SELECT COUNT(DISTINCT c.sender_id) FROM choices c JOIN participants p ON p.id = c.sender_id WHERE c.stage = 2 AND p.is_sample = 0 AND p.gender = 'male') AS stage2Done,
      (SELECT COUNT(DISTINCT c.sender_id) FROM choices c JOIN participants p ON p.id = c.sender_id WHERE c.stage = 3 AND p.is_sample = 0) AS stage3Done
  `).first<{ women: number; men: number; total: number; stage1Done: number; stage2Done: number; stage3Done: number }>();
  return rows ?? { women: 0, men: 0, total: 0, stage1Done: 0, stage2Done: 0, stage3Done: 0 };
}

async function refreshCurrentStage(db: D1Database) {
  let currentStage = await readCurrentStage(db);
  const counts = await stageCounts(db);
  if (currentStage === 1 && counts.women > 0 && counts.stage1Done >= counts.women) {
    await db.prepare("UPDATE event_state SET current_stage = 2, updated_at = CURRENT_TIMESTAMP WHERE id = 1 AND current_stage = 1").run();
    currentStage = 2;
  }
  if (currentStage === 2 && counts.men > 0 && counts.stage2Done >= counts.men) {
    await db.prepare("UPDATE event_state SET current_stage = 3, updated_at = CURRENT_TIMESTAMP WHERE id = 1 AND current_stage = 2").run();
    currentStage = 3;
  }
  if (currentStage === 3 && counts.total > 0 && counts.stage3Done >= counts.total) {
    await db.prepare("UPDATE event_state SET current_stage = 4, updated_at = CURRENT_TIMESTAMP WHERE id = 1 AND current_stage = 3").run();
    currentStage = 4;
  }
  return { currentStage, counts };
}

async function stateFor(db: D1Database, profile: ParticipantRow) {
  const { currentStage, counts } = await refreshCurrentStage(db);
  const opponents = await db.prepare(`
    SELECT id, nickname, gender, avatar, job, is_sample
    FROM participants
    WHERE is_sample = 0 AND gender != ? AND id != ?
    ORDER BY created_at ASC
  `).bind(profile.gender, profile.id).all<ParticipantRow>();
  const completedRows = await db.prepare("SELECT DISTINCT stage FROM choices WHERE sender_id = ? ORDER BY stage")
    .bind(profile.id).all<{ stage: number }>();
  const actualResults = await db.prepare(`
    SELECT c.stage, c.heart_color AS heartColor, p.nickname, p.avatar,
      CASE WHEN c.stage = 3 AND EXISTS (
        SELECT 1 FROM choices own
        WHERE own.sender_id = ? AND own.recipient_id = c.sender_id
          AND own.stage = 3 AND own.heart_color = 'red'
      ) THEN 1 ELSE 0 END AS isMutual
    FROM choices c
    JOIN participants p ON p.id = c.sender_id
    WHERE c.recipient_id = ? AND c.stage < ?
    ORDER BY c.stage, c.created_at
  `).bind(profile.id, profile.id, currentStage).all<{
    stage: number;
    heartColor: "red" | "yellow";
    nickname: string;
    avatar: string;
    isMutual: number;
  }>();

  return {
    profile,
    opponents: opponents.results,
    completedStages: completedRows.results.map((row) => row.stage),
    results: actualResults.results.map((result) => ({ ...result, isMutual: Boolean(result.isMutual) })),
    event: {
      currentStage,
      progress: {
        1: { completed: counts.stage1Done, expected: counts.women },
        2: { completed: counts.stage2Done, expected: counts.men },
        3: { completed: counts.stage3Done, expected: counts.total },
      },
    },
  };
}

export async function GET(request: Request) {
  try {
    const db = await prepare();
    const profile = await profileForToken(db, tokenFrom(request));
    if (!profile) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    return Response.json(await stateFor(db, profile));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "불러오지 못했어요." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await prepare();
    const payload = await request.json() as {
      action?: "createProfile" | "login" | "submitChoice";
      nickname?: string;
      password?: string;
      gender?: Gender;
      stage?: number;
      redRecipientId?: string;
      yellowRecipientId?: string;
    };

    if (payload.action === "createProfile") {
      const nickname = payload.nickname?.trim() ?? "";
      const password = payload.password ?? "";
      const credentialError = validateCredentials(nickname, password);
      if (credentialError) return Response.json({ error: credentialError }, { status: 400 });
      if (payload.gender !== "male" && payload.gender !== "female") return Response.json({ error: "성별을 선택해 주세요." }, { status: 400 });
      const firstChoice = await db.prepare("SELECT 1 AS found FROM choices LIMIT 1").first();
      if (await readCurrentStage(db) !== 1 || firstChoice) {
        return Response.json({ error: "첫 선택이 시작되어 참가자 등록이 마감됐어요. 기존 계정으로 로그인해 주세요." }, { status: 403 });
      }

      const id = crypto.randomUUID();
      const token = createToken();
      const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
      const passwordHash = await hashPassword(password, salt);
      try {
        await db.batch([
          db.prepare(`
            INSERT INTO participants (id, session_token, nickname, password_hash, password_salt, gender, avatar, job, is_sample)
            VALUES (?, ?, ?, ?, ?, ?, ?, '참가자', 0)
          `).bind(id, token, nickname, passwordHash, salt, payload.gender, payload.gender === "male" ? "🧑🏻" : "👩🏻"),
          db.prepare("INSERT INTO participant_sessions (token, participant_id) VALUES (?, ?)").bind(token, id),
        ]);
      } catch {
        return Response.json({ error: "이미 사용 중인 닉네임이에요." }, { status: 409 });
      }
      const profile = await profileForToken(db, token);
      return Response.json({ token, ...(await stateFor(db, profile!)) }, { status: 201 });
    }

    if (payload.action === "login") {
      const nickname = payload.nickname?.trim() ?? "";
      const password = payload.password ?? "";
      const credentialError = validateCredentials(nickname, password);
      if (credentialError) return Response.json({ error: credentialError }, { status: 400 });
      const account = await db.prepare(`
        SELECT id, password_hash AS passwordHash, password_salt AS passwordSalt
        FROM participants WHERE nickname = ? AND is_sample = 0 LIMIT 1
      `).bind(nickname).first<{ id: string; passwordHash: string | null; passwordSalt: string | null }>();
      if (!account?.passwordHash || !account.passwordSalt) {
        return Response.json({ error: "닉네임 또는 비밀번호가 올바르지 않아요." }, { status: 401 });
      }
      const candidateHash = await hashPassword(password, account.passwordSalt);
      if (!constantTimeEqual(candidateHash, account.passwordHash)) {
        return Response.json({ error: "닉네임 또는 비밀번호가 올바르지 않아요." }, { status: 401 });
      }
      const token = createToken();
      await db.prepare("INSERT INTO participant_sessions (token, participant_id) VALUES (?, ?)").bind(token, account.id).run();
      const profile = await profileForToken(db, token);
      return Response.json({ token, ...(await stateFor(db, profile!)) });
    }

    const profile = await profileForToken(db, tokenFrom(request));
    if (!profile) return Response.json({ error: "다시 로그인해 주세요." }, { status: 401 });
    if (payload.action !== "submitChoice") return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });

    const stage = payload.stage;
    const { currentStage } = await refreshCurrentStage(db);
    if (stage !== currentStage || stage < 1 || stage > 3) {
      return Response.json({ error: "아직 이 단계의 선택이 열리지 않았어요." }, { status: 403 });
    }
    const allowedStage = (profile.gender === "female" && stage === 1) || (profile.gender === "male" && stage === 2) || stage === 3;
    if (!allowedStage) return Response.json({ error: "현재 참여할 수 없는 선택이에요." }, { status: 403 });
    if (!payload.redRecipientId || (stage !== 3 && !payload.yellowRecipientId)) return Response.json({ error: "보낼 마음을 모두 선택해 주세요." }, { status: 400 });

    const recipientIds = [payload.redRecipientId, payload.yellowRecipientId].filter(Boolean) as string[];
    const placeholders = recipientIds.map(() => "?").join(",");
    const validRecipients = await db.prepare(`SELECT id FROM participants WHERE is_sample = 0 AND gender != ? AND id IN (${placeholders})`)
      .bind(profile.gender, ...recipientIds).all<{ id: string }>();
    if (new Set(validRecipients.results.map((row) => row.id)).size !== new Set(recipientIds).size) return Response.json({ error: "선택한 참가자를 확인해 주세요." }, { status: 400 });

    const existing = await db.prepare("SELECT 1 AS found FROM choices WHERE sender_id = ? AND stage = ? LIMIT 1").bind(profile.id, stage).first();
    if (existing) return Response.json({ error: "이미 제출한 선택은 바꿀 수 없어요." }, { status: 409 });
    const inserts = [db.prepare("INSERT INTO choices (sender_id, recipient_id, stage, heart_color) VALUES (?, ?, ?, 'red')").bind(profile.id, payload.redRecipientId, stage)];
    if (stage !== 3) inserts.push(db.prepare("INSERT INTO choices (sender_id, recipient_id, stage, heart_color) VALUES (?, ?, ?, 'yellow')").bind(profile.id, payload.yellowRecipientId, stage));
    await db.batch(inserts);
    await refreshCurrentStage(db);
    return Response.json(await stateFor(db, profile));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "저장하지 못했어요." }, { status: 500 });
  }
}

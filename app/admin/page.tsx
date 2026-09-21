import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { ensureSchema, getD1 } from "../../db";
import { requireChatGPTUser } from "../chatgpt-auth";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자 결과 — 마음, 한 잔",
  description: "실제 참가자의 단계별 제출과 결과를 확인하는 관리자 화면",
  openGraph: { title: "관리자 결과 — 마음, 한 잔", description: "실제 행사 운영 현황과 결과", images: [] },
  twitter: { title: "관리자 결과 — 마음, 한 잔", description: "실제 행사 운영 현황과 결과", images: [] },
};

type Participant = { id: string; nickname: string; gender: "male" | "female"; avatar: string; created_at: string };
type Choice = { stage: 1 | 2 | 3; heartColor: "red" | "yellow"; senderId: string; fromName: string; fromAvatar: string; recipientId: string; toName: string; toAvatar: string };

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const configuredAdmin = ((env.ADMIN_EMAIL as string | undefined) ?? process.env.ADMIN_EMAIL)?.toLowerCase();
  if (!configuredAdmin || user.email.toLowerCase() !== configuredAdmin) {
    return <main className="admin-denied"><div><span>🔒</span><h1>관리자만 볼 수 있어요</h1><p>이 계정에는 행사 결과를 열람할 권한이 없습니다.</p><a href="/">참가자 화면으로 돌아가기</a></div></main>;
  }

  await ensureSchema();
  const db = getD1();
  const participantRows = await db.prepare("SELECT id, nickname, gender, avatar, created_at FROM participants WHERE is_sample = 0 ORDER BY created_at")
    .all<Participant>();
  const choiceRows = await db.prepare(`
    SELECT c.stage, c.heart_color AS heartColor,
      sender.id AS senderId, sender.nickname AS fromName, sender.avatar AS fromAvatar,
      recipient.id AS recipientId, recipient.nickname AS toName, recipient.avatar AS toAvatar
    FROM choices c
    JOIN participants sender ON sender.id = c.sender_id
    JOIN participants recipient ON recipient.id = c.recipient_id
    WHERE sender.is_sample = 0 AND recipient.is_sample = 0
    ORDER BY c.stage, c.created_at
  `).all<Choice>();
  const participants = participantRows.results;
  const choices = choiceRows.results;
  const women = participants.filter((p) => p.gender === "female");
  const men = participants.filter((p) => p.gender === "male");
  const completed = (stage: number) => new Set(choices.filter((c) => c.stage === stage).map((c) => c.senderId)).size;
  const expected = { 1: women.length, 2: men.length, 3: participants.length };
  const finalPairs = choices.filter((c) => c.stage === 3 && participants.find((p) => p.id === c.senderId)?.gender === "female")
    .filter((c) => choices.some((other) => other.stage === 3 && other.senderId === c.recipientId && other.recipientId === c.senderId));

  return <main className="admin-page">
    <header className="admin-top"><a href="/" className="admin-brand"><span>♥</span> 마음, 한 잔</a><div><span className="live-dot" /> 실제 행사 데이터</div><a href="/signout-with-chatgpt?return_to=/" className="signout">로그아웃</a></header>
    <section className="admin-hero"><div><div className="admin-kicker">ADMIN DASHBOARD</div><h1>{user.fullName ?? "곽윤성"} 관리자님,<br /><em>행사 현황</em>을 확인하세요</h1><p>샘플 참가자는 제외하고 실제 입장한 사용자와 실제 전달된 마음만 집계합니다.</p></div><a href="/admin" className="refresh-button">↻ 새로고침</a></section>

    <div className="admin-content">
      <section className="admin-overview">
        <article><span>👥</span><p><small>실제 참가자</small><strong>{participants.length}<i>명</i></strong></p><em>여 {women.length} · 남 {men.length}</em></article>
        <article><span>♥</span><p><small>전달된 마음</small><strong>{choices.length}<i>개</i></strong></p><em>빨강 {choices.filter((c) => c.heartColor === "red").length} · 노랑 {choices.filter((c) => c.heartColor === "yellow").length}</em></article>
        <article><span>↔</span><p><small>최종 상호 선택</small><strong>{finalPairs.length}<i>쌍</i></strong></p><em>3차 빨간 하트 기준</em></article>
      </section>

      <section className="admin-block"><div className="admin-heading"><div><span>01</span><p><strong>단계별 제출 현황</strong><small>각 단계에서 제출을 마친 실제 참가자 수</small></p></div></div><div className="progress-grid">{([1, 2, 3] as const).map((stage) => { const done = completed(stage); const total = expected[stage]; const percent = total ? Math.min(100, Math.round(done / total * 100)) : 0; return <article key={stage}><header><span>{stage}</span><div><strong>{stage === 1 ? "여성의 첫 번째 선택" : stage === 2 ? "남성의 두 번째 선택" : "모두의 최종 선택"}</strong><small>{done}명 / {total}명 제출</small></div><b>{percent}%</b></header><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><p>{total > 0 && done === total ? "✓ 전원 제출 완료" : total === 0 ? "참가자 입장 대기" : `${total - done}명 미제출`}</p></article>; })}</div></section>

      <section className="admin-block"><div className="admin-heading"><div><span>02</span><p><strong>실제 참가자 명단</strong><small>닉네임과 성별을 등록하고 입장한 사용자</small></p></div><b>{participants.length}명</b></div>{participants.length ? <div className="admin-participants">{participants.map((p) => <article key={p.id}><div>{p.avatar}</div><p><strong>{p.nickname}</strong><small>{p.gender === "female" ? "여성" : "남성"}</small></p><span>입장 완료</span></article>)}</div> : <Empty text="아직 실제로 입장한 참가자가 없습니다." />}</section>

      <section className="admin-block"><div className="admin-heading"><div><span>03</span><p><strong>전체 마음 전달 기록</strong><small>실제 참가자들이 단계별로 보낸 하트</small></p></div><b>{choices.length}개</b></div>{choices.length ? <div className="admin-rounds">{([1, 2, 3] as const).map((stage) => <article key={stage}><header><span>{stage}</span><div><strong>{stage}차 선택</strong><small>{choices.filter((c) => c.stage === stage).length}개 전달</small></div></header><div>{choices.filter((c) => c.stage === stage).map((choice, index) => <p key={index}><span>{choice.fromAvatar}</span><strong>{choice.fromName}</strong><i>→</i><b className={choice.heartColor}>♥</b><strong>{choice.toName}</strong><span>{choice.toAvatar}</span></p>)}</div></article>)}</div> : <Empty text="아직 저장된 선택이 없습니다." />}</section>

      <section className="admin-block"><div className="admin-heading"><div><span>04</span><p><strong>참가자별 받은 마음</strong><small>결과 공개 시 각 참가자에게 보이는 실제 내용</small></p></div></div>{participants.length ? <div className="admin-results">{participants.map((p) => { const received = choices.filter((c) => c.recipientId === p.id); return <article key={p.id}><header><div>{p.avatar}</div><p><strong>{p.nickname}</strong><small>{received.length}개의 마음 도착</small></p><b>{received.length}</b></header>{([1, 2, 3] as const).map((stage) => <div className="admin-result-stage" key={stage}><span>{stage}차</span><div>{received.filter((c) => c.stage === stage).length ? received.filter((c) => c.stage === stage).map((c, index) => <p key={index}><i className={c.heartColor}>♥</i>{c.fromName}</p>) : <small>—</small>}</div></div>)}</article>; })}</div> : <Empty text="참가자가 입장하면 개인별 결과가 이곳에 표시됩니다." />}</section>

      <section className="admin-final"><div className="admin-heading light"><div><span>05</span><p><strong>최종 상호 선택</strong><small>3차에서 서로 빨간 하트를 보낸 참가자</small></p></div><b>{finalPairs.length}쌍</b></div>{finalPairs.length ? <div className="admin-matches">{finalPairs.map((pair) => <article key={`${pair.senderId}-${pair.recipientId}`}><div><span>{pair.fromAvatar}</span><strong>{pair.fromName}</strong></div><p><b>♥</b><small>서로의 최종 선택</small><b>♥</b></p><div><span>{pair.toAvatar}</span><strong>{pair.toName}</strong></div></article>)}</div> : <div className="dark-empty">아직 최종 상호 선택 결과가 없습니다.</div>}</section>
    </div>
  </main>;
}

function Empty({ text }: { text: string }) {
  return <div className="admin-empty"><span>♡</span><p>{text}</p></div>;
}

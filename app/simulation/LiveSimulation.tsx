"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Gender = "여성" | "남성";
type HeartColor = "red" | "yellow";
type Stage = 1 | 2 | 3;
type Phase = "entering" | "stage1" | "reveal1" | "stage2" | "reveal2" | "stage3" | "complete";
type Person = { id: string; name: string; gender: Gender; emoji: string };
type Choice = { stage: Stage; from: string; to: string; color: HeartColor };
type Step = { phase: Phase; participant?: string; choices?: Choice[] };

const women: Person[] = [
  ["w1", "수아", "👩🏻‍🦰"], ["w2", "지민", "👩🏻‍💻"], ["w3", "채원", "👩🏻‍🎨"], ["w4", "유진", "👩🏻‍🔬"], ["w5", "서연", "👩🏻‍🏫"],
  ["w6", "하은", "👩🏻‍🚀"], ["w7", "나연", "👩🏻‍🍳"], ["w8", "예린", "👩🏻‍🎤"], ["w9", "다은", "👩🏻‍⚕️"], ["w10", "소희", "👩🏻‍💼"],
].map(([id, name, emoji]) => ({ id, name, emoji, gender: "여성" as const }));

const men: Person[] = [
  ["m1", "서준", "🧑🏻‍💻"], ["m2", "민재", "👨🏻‍🎨"], ["m3", "도윤", "🧑🏻‍🎬"], ["m4", "하준", "👨🏻‍💼"], ["m5", "지호", "🧑🏻‍🔬"],
  ["m6", "현우", "👨🏻‍🚀"], ["m7", "건우", "🧑🏻‍🍳"], ["m8", "우진", "👨🏻‍🏫"], ["m9", "태윤", "🧑🏻‍🎤"], ["m10", "준호", "👨🏻‍⚕️"],
].map(([id, name, emoji]) => ({ id, name, emoji, gender: "남성" as const }));

const people = [...women, ...men];
const byId = new Map(people.map((person) => [person.id, person]));
const stage1: Step[] = women.map((sender, index) => ({ phase: "stage1", participant: sender.id, choices: [
  { stage: 1, from: sender.id, to: men[index].id, color: "red" },
  { stage: 1, from: sender.id, to: men[(index + 3) % men.length].id, color: "yellow" },
]}));
const stage2RedTargets = [0, 2, 1, 3, 5, 4, 6, 8, 7, 9];
const stage2: Step[] = men.map((sender, index) => ({ phase: "stage2", participant: sender.id, choices: [
  { stage: 2, from: sender.id, to: women[stage2RedTargets[index]].id, color: "red" },
  { stage: 2, from: sender.id, to: women[(index + 4) % women.length].id, color: "yellow" },
]}));
const menFinalTargets = [0, 2, 2, 3, 5, 5, 6, 9, 8, 4];
const stage3: Step[] = [
  ...women.map((sender, index) => ({ phase: "stage3" as const, participant: sender.id, choices: [{ stage: 3 as const, from: sender.id, to: men[index].id, color: "red" as const }] })),
  ...men.map((sender, index) => ({ phase: "stage3" as const, participant: sender.id, choices: [{ stage: 3 as const, from: sender.id, to: women[menFinalTargets[index]].id, color: "red" as const }] })),
];
const timeline: Step[] = [
  ...people.map((person) => ({ phase: "entering" as const, participant: person.id })), ...stage1, { phase: "reveal1" },
  ...stage2, { phase: "reveal2" }, ...stage3, { phase: "complete" },
];
const phaseCopy: Record<Phase, { eyebrow: string; title: string; detail: string }> = {
  entering: { eyebrow: "CHECK-IN", title: "가상 참가자 입장 중", detail: "닉네임·성별 프로필을 등록하고 있어요" },
  stage1: { eyebrow: "ROUND 01", title: "여성 참가자 선택 진행 중", detail: "여성 전원이 제출하면 남성에게 결과가 공개됩니다" },
  reveal1: { eyebrow: "ROUND 01 COMPLETE", title: "1차 결과 공개", detail: "남성 참가자가 자신에게 온 마음을 확인합니다" },
  stage2: { eyebrow: "ROUND 02", title: "남성 참가자 선택 진행 중", detail: "남성 전원이 제출하면 여성에게 결과가 공개됩니다" },
  reveal2: { eyebrow: "ROUND 02 COMPLETE", title: "2차 결과 공개", detail: "여성 참가자가 자신에게 온 마음을 확인합니다" },
  stage3: { eyebrow: "FINAL ROUND", title: "모두의 최종 선택 진행 중", detail: "이번에는 빨간 하트 하나만 보낼 수 있어요" },
  complete: { eyebrow: "SIMULATION COMPLETE", title: "20인 시뮬레이션 완료", detail: "상호 선택과 일방 선택 결과가 모두 집계됐습니다" },
};
const person = (id: string) => byId.get(id)!;

export default function LiveSimulation() {
  const [cursor, setCursor] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(2);
  useEffect(() => {
    if (!running || cursor >= timeline.length) return;
    const step = timeline[cursor];
    const pause = step.phase === "reveal1" || step.phase === "reveal2" ? 1900 : step.phase === "complete" ? 0 : 720 / speed;
    if (!pause) return;
    const timer = window.setTimeout(() => setCursor((value) => Math.min(value + 1, timeline.length)), pause);
    return () => window.clearTimeout(timer);
  }, [cursor, running, speed]);

  const applied = timeline.slice(0, cursor + 1);
  const current = timeline[Math.min(cursor, timeline.length - 1)]?.phase ?? "entering";
  const enteredIds = new Set(applied.filter((step) => step.phase === "entering" && step.participant).map((step) => step.participant!));
  const choices = applied.flatMap((step) => step.choices ?? []);
  const submitted = (stage: Stage) => new Set(applied.filter((step) => step.phase === `stage${stage}` && step.participant).map((step) => step.participant!)).size;
  const stage1Done = submitted(1), stage2Done = submitted(2), stage3Done = submitted(3);
  const visibleStage = current === "entering" ? 0 : current === "stage1" ? 1 : current === "reveal1" || current === "stage2" ? 2 : current === "reveal2" || current === "stage3" ? 3 : 4;
  const matches = useMemo(() => {
    const finals = choices.filter((choice) => choice.stage === 3);
    return finals.filter((choice) => person(choice.from).gender === "여성" && finals.some((reverse) => reverse.from === choice.to && reverse.to === choice.from));
  }, [choices]);
  const recent = [...choices].reverse().slice(0, 10);
  const copy = phaseCopy[current];
  const complete = current === "complete";
  function restart() { setCursor(0); setRunning(true); }

  return <main className="live-sim-page">
    <header className="live-topbar"><Link href="/" className="live-brand"><span>♥</span> 마음, 한 잔</Link><div className="simulation-label"><i /> 실제 데이터와 분리된 가상 시뮬레이션</div><Link href="/admin" className="admin-link">실제 관리자 화면 ↗</Link></header>
    <section className="live-hero"><div><div className="live-eyebrow"><span className={running && !complete ? "pulse" : ""} /> {copy.eyebrow}</div><h1>{copy.title}</h1><p>{copy.detail}</p></div><div className="sim-controls"><button type="button" onClick={() => setRunning((value) => !value)} disabled={complete}>{running && !complete ? "Ⅱ  일시정지" : "▶  계속하기"}</button><label>속도 <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label><button type="button" className="restart" onClick={restart}>↻ 처음부터</button></div></section>
    <div className="live-content">
      <section className="summary-grid">
        <article><span>👥</span><p><small>입장 참가자</small><strong>{enteredIds.size}<i>/ 20명</i></strong></p><em>여 {women.filter((p) => enteredIds.has(p.id)).length} · 남 {men.filter((p) => enteredIds.has(p.id)).length}</em></article>
        <article><span>♥</span><p><small>전달된 마음</small><strong>{choices.length}<i>/ 60개</i></strong></p><em>빨강 {choices.filter((c) => c.color === "red").length} · 노랑 {choices.filter((c) => c.color === "yellow").length}</em></article>
        <article><span>↔</span><p><small>{complete ? "최종 상호 선택" : "현재 진행 단계"}</small><strong>{complete ? matches.length : visibleStage}<i>{complete ? "쌍" : "차"}</i></strong></p><em>{complete ? "3차 빨간 하트 기준" : "전원 제출 시 자동 전환"}</em></article>
      </section>
      <section className="sim-panel progress-panel"><div className="panel-heading"><div><span>01</span><p><strong>단계별 제출 현황</strong><small>가상 참가자의 제출이 실시간으로 반영됩니다</small></p></div><b>{complete ? "완료" : running ? "자동 재생 중" : "일시정지"}</b></div><div className="live-progress-grid"><ProgressCard stage={1} title="여성의 첫 번째 선택" done={stage1Done} total={10} active={current === "stage1"} unlocked={visibleStage >= 1} /><ProgressCard stage={2} title="남성의 두 번째 선택" done={stage2Done} total={10} active={current === "stage2"} unlocked={visibleStage >= 2} /><ProgressCard stage={3} title="모두의 최종 선택" done={stage3Done} total={20} active={current === "stage3"} unlocked={visibleStage >= 3} /></div></section>
      <div className="dashboard-columns">
        <section className="sim-panel"><div className="panel-heading"><div><span>02</span><p><strong>가상 참가자 명단</strong><small>여성 10명 · 남성 10명</small></p></div><b>{enteredIds.size}명</b></div><div className="live-participants">{people.map((item) => <article className={enteredIds.has(item.id) ? "entered" : "waiting"} key={item.id}><div>{item.emoji}</div><p><strong>{item.name}</strong><small>{item.gender}</small></p><i>{enteredIds.has(item.id) ? "입장" : "대기"}</i></article>)}</div></section>
        <section className="sim-panel activity-panel"><div className="panel-heading"><div><span>03</span><p><strong>실시간 마음 전달</strong><small>최근 기록이 위에 표시됩니다</small></p></div><b>{choices.length}개</b></div><div className="activity-feed">{recent.length ? recent.map((choice, index) => <div className={index === 0 ? "newest" : ""} key={`${choice.stage}-${choice.from}-${choice.color}`}><span>{person(choice.from).emoji}</span><p><small>{choice.stage}차 선택</small><strong>{person(choice.from).name} <i>→</i> {person(choice.to).name}</strong></p><b className={choice.color}>♥</b><span>{person(choice.to).emoji}</span></div>) : <div className="feed-empty"><span>♡</span><p>참가자 입장 후 선택이 시작됩니다</p></div>}</div></section>
      </div>
      {visibleStage >= 2 && <RevealSection stage={1} choices={choices} recipients={men} />}
      {visibleStage >= 3 && <RevealSection stage={2} choices={choices} recipients={women} />}
      <section className={`final-live ${complete ? "revealed" : "locked"}`}><div className="panel-heading light"><div><span>04</span><p><strong>최종 상호 선택 결과</strong><small>{complete ? "서로 빨간 하트를 보낸 참가자" : "3차 전원 제출 후 공개됩니다"}</small></p></div><b>{complete ? `${matches.length}쌍` : "잠금"}</b></div>{complete ? <><div className="live-match-grid">{matches.map((match) => <article key={match.from}><div><span>{person(match.from).emoji}</span><strong>{person(match.from).name}</strong></div><p><b>♥</b><small>서로의 최종 선택</small><b>♥</b></p><div><span>{person(match.to).emoji}</span><strong>{person(match.to).name}</strong></div></article>)}</div><div className="final-note"><strong>✓ 시뮬레이션 완료</strong><p>20명이 모두 참여해 총 60개의 마음이 전달됐습니다. 최종 매칭이 되지 않았더라도, 받은 사람은 자신을 선택한 상대를 개인 결과 화면에서 확인할 수 있습니다.</p></div></> : <div className="locked-result"><span>🔒</span><p>최종 선택을 집계하고 있어요</p><div><i style={{ width: `${stage3Done / 20 * 100}%` }} /></div><small>{stage3Done} / 20명 제출</small></div>}</section>
    </div>
  </main>;
}

function ProgressCard({ stage, title, done, total, active, unlocked }: { stage: Stage; title: string; done: number; total: number; active: boolean; unlocked: boolean }) {
  const percent = Math.round(done / total * 100);
  return <article className={active ? "active" : done === total ? "done" : !unlocked ? "disabled" : ""}><header><span>{stage}</span><div><strong>{title}</strong><small>{done}명 / {total}명 제출</small></div><b>{percent}%</b></header><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><p>{done === total ? "✓ 전원 제출 완료" : active ? `${total - done}명 제출 대기` : !unlocked ? "이전 단계 완료 후 활성화" : "선택 준비 중"}</p></article>;
}

function RevealSection({ stage, choices, recipients }: { stage: 1 | 2; choices: Choice[]; recipients: Person[] }) {
  const visibleChoices = choices.filter((choice) => choice.stage === stage);
  return <section className="sim-panel reveal-panel"><div className="panel-heading"><div><span>{stage === 1 ? "R1" : "R2"}</span><p><strong>{stage}차 받은 마음 공개</strong><small>실제 앱에서는 각 참가자가 본인에게 온 마음만 확인합니다</small></p></div><b>공개 완료</b></div><div className="reveal-grid">{recipients.map((recipient) => { const received = visibleChoices.filter((choice) => choice.to === recipient.id); return <article key={recipient.id}><header><span>{recipient.emoji}</span><p><strong>{recipient.name}</strong><small>{received.length}개의 마음 도착</small></p><b>{received.length}</b></header><div>{received.map((choice) => <p key={`${choice.from}-${choice.color}`}><i className={choice.color}>♥</i>{person(choice.from).name}</p>)}</div></article>; })}</div></section>;
}

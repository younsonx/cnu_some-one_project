import type { Metadata } from "next";
import "./simulation.css";

export const metadata: Metadata = {
  title: "8인 행사 시뮬레이션 — 마음, 한 잔",
  description: "여성 4명과 남성 4명이 1·2·3차 선택을 모두 완료한 예시 결과입니다.",
  openGraph: { title: "8인 행사 시뮬레이션 — 마음, 한 잔", description: "8명의 참가자가 세 단계의 마음 전달을 마친 시뮬레이션 결과", images: [] },
  twitter: { title: "8인 행사 시뮬레이션 — 마음, 한 잔", description: "8명의 참가자가 세 단계의 마음 전달을 마친 시뮬레이션 결과", images: [] },
};

type Person = { id: string; name: string; gender: "여성" | "남성"; emoji: string };
type Choice = { stage: 1 | 2 | 3; from: string; to: string; color: "red" | "yellow" };

const people: Person[] = [
  { id: "sua", name: "수아", gender: "여성", emoji: "👩🏻‍🦰" }, { id: "jimin", name: "지민", gender: "여성", emoji: "👩🏻‍💻" },
  { id: "chaewon", name: "채원", gender: "여성", emoji: "👩🏻‍🎨" }, { id: "yujin", name: "유진", gender: "여성", emoji: "👩🏻‍🔬" },
  { id: "seojun", name: "서준", gender: "남성", emoji: "🧑🏻‍💻" }, { id: "minjae", name: "민재", gender: "남성", emoji: "👨🏻‍🎨" },
  { id: "doyun", name: "도윤", gender: "남성", emoji: "🧑🏻‍🎬" }, { id: "hajun", name: "하준", gender: "남성", emoji: "👨🏻‍💼" },
];

const choices: Choice[] = [
  { stage: 1, from: "수아", to: "서준", color: "red" }, { stage: 1, from: "수아", to: "민재", color: "yellow" },
  { stage: 1, from: "지민", to: "민재", color: "red" }, { stage: 1, from: "지민", to: "도윤", color: "yellow" },
  { stage: 1, from: "채원", to: "도윤", color: "red" }, { stage: 1, from: "채원", to: "하준", color: "yellow" },
  { stage: 1, from: "유진", to: "서준", color: "red" }, { stage: 1, from: "유진", to: "하준", color: "yellow" },
  { stage: 2, from: "서준", to: "수아", color: "red" }, { stage: 2, from: "서준", to: "유진", color: "yellow" },
  { stage: 2, from: "민재", to: "지민", color: "red" }, { stage: 2, from: "민재", to: "수아", color: "yellow" },
  { stage: 2, from: "도윤", to: "채원", color: "red" }, { stage: 2, from: "도윤", to: "지민", color: "yellow" },
  { stage: 2, from: "하준", to: "유진", color: "red" }, { stage: 2, from: "하준", to: "채원", color: "yellow" },
  { stage: 3, from: "수아", to: "서준", color: "red" }, { stage: 3, from: "지민", to: "민재", color: "red" },
  { stage: 3, from: "채원", to: "도윤", color: "red" }, { stage: 3, from: "유진", to: "하준", color: "red" },
  { stage: 3, from: "서준", to: "수아", color: "red" }, { stage: 3, from: "민재", to: "지민", color: "red" },
  { stage: 3, from: "도윤", to: "채원", color: "red" }, { stage: 3, from: "하준", to: "유진", color: "red" },
];

const person = (name: string) => people.find((item) => item.name === name)!;
const receivedBy = (name: string) => choices.filter((choice) => choice.to === name);
const stageNames = { 1: "여성의 첫 번째 선택", 2: "남성의 두 번째 선택", 3: "모두의 최종 선택" };
const finalPairs = choices.filter((choice) => choice.stage === 3 && people.find((p) => p.name === choice.from)?.gender === "여성").filter((choice) => choices.some((reverse) => reverse.stage === 3 && reverse.from === choice.to && reverse.to === choice.from));

export default function SimulationPage() {
  return <main className="sim-page">
    <header className="sim-hero"><a href="/" className="sim-brand"><span>♥</span> 마음, 한 잔</a><div className="sim-kicker">8 PEOPLE · 3 ROUNDS · 24 HEARTS</div><h1>8명이 모두 참여한<br /><em>행사 시뮬레이션</em></h1><p>여성 4명과 남성 4명이 입장해 세 번의 선택을 모두 마친 상황입니다. 아래 데이터는 흐름 확인을 위한 예시이며 실제 참가자 데이터와 분리되어 있습니다.</p>
      <div className="sim-stats"><div><strong>8</strong><small>참가자</small></div><div><strong>24</strong><small>전달된 마음</small></div><div><strong>4</strong><small>최종 상호 선택</small></div></div>
    </header>

    <div className="sim-content">
      <section><div className="sim-section-title"><span>01</span><div><h2>참가자 입장 완료</h2><p>닉네임과 성별을 등록한 실제 참가자 8명</p></div></div><div className="participant-grid">{people.map((item) => <article key={item.id}><div>{item.emoji}</div><strong>{item.name}</strong><small>{item.gender}</small><i>입장 완료</i></article>)}</div></section>

      <section><div className="sim-section-title"><span>02</span><div><h2>세 단계 선택 기록</h2><p>각 사용자가 실제로 보낸 하트의 전체 흐름</p></div></div><div className="rounds">{([1, 2, 3] as const).map((stage) => <article className="round-card" key={stage}><header><b>{stage}</b><div><strong>{stageNames[stage]}</strong><small>{stage === 3 ? "빨간 하트만 · 8명 참여" : "빨강 + 노랑 · 4명 참여"}</small></div><span>{choices.filter((choice) => choice.stage === stage).length}개</span></header><div>{choices.filter((choice) => choice.stage === stage).map((choice, index) => <div className="choice-row" key={`${choice.from}-${choice.color}-${index}`}><span className="small-avatar">{person(choice.from).emoji}</span><strong>{choice.from}</strong><i>→</i><span className={`sim-heart ${choice.color}`}>♥</span><strong>{choice.to}</strong><span className="small-avatar">{person(choice.to).emoji}</span></div>)}</div></article>)}</div></section>

      <section><div className="sim-section-title"><span>03</span><div><h2>개인별 받은 마음</h2><p>실제 앱에서는 각 카드의 당사자만 자신의 결과를 확인합니다</p></div></div><div className="result-grid">{people.map((item) => { const received = receivedBy(item.name); return <article className="person-result" key={item.id}><header><div>{item.emoji}</div><p><strong>{item.name}</strong><small>{received.length}개의 마음 도착</small></p><b>{received.length}</b></header>{([1, 2, 3] as const).map((stage) => { const stageReceived = received.filter((choice) => choice.stage === stage); return <div className="received-stage" key={stage}><span>{stage}차</span><div>{stageReceived.length ? stageReceived.map((choice, index) => <p key={index}><i className={choice.color}>♥</i>{choice.from}</p>) : <small>—</small>}</div></div>; })}</article>; })}</div></section>

      <section className="final-section"><div className="sim-section-title light"><span>04</span><div><h2>최종 상호 선택 결과</h2><p>3차에서 서로 빨간 하트를 보낸 네 쌍</p></div></div><div className="match-grid">{finalPairs.map((match) => <article key={match.from}><div><span>{person(match.from).emoji}</span><strong>{match.from}</strong></div><p><b>♥</b><small>서로의 최종 선택</small><b>♥</b></p><div><span>{person(match.to).emoji}</span><strong>{match.to}</strong></div></article>)}</div><div className="scenario-note"><strong>시뮬레이션 결론</strong><p>8명 전원이 단계별 규칙에 맞게 제출했고, 총 24개의 마음이 저장되었습니다. 결과 공개 후 각 참가자는 본인에게 온 마음만 단계별로 확인하며, 운영자 화면에서는 전체 제출 현황과 최종 상호 선택 4쌍을 확인하는 구조입니다.</p></div></section>
    </div>
  </main>;
}

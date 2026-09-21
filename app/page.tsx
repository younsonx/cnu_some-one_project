"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Gender = "male" | "female";
type Heart = "red" | "yellow";
type Person = { id: string; nickname: string; gender: Gender; avatar: string; job: string };
type Result = { stage: number; heartColor: Heart; nickname: string; avatar: string };
type AppState = { profile: Person; opponents: Person[]; completedStages: number[]; results: Result[] };
type View = "onboarding" | "select" | "confirm" | "between" | "results";

const TOKEN_KEY = "maeum-session-token";

export default function Home() {
  const [data, setData] = useState<AppState | null>(null);
  const [view, setView] = useState<View>("onboarding");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [stage, setStage] = useState(1);
  const [redPick, setRedPick] = useState<string | null>(null);
  const [yellowPick, setYellowPick] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    fetch("/api/app", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((state: AppState) => { setData(state); routeFromState(state); })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const routeFromState = (state: AppState) => {
    const firstStage = state.profile.gender === "female" ? 1 : 2;
    if (!state.completedStages.includes(firstStage)) { setStage(firstStage); setView("select"); }
    else if (!state.completedStages.includes(3)) { setStage(3); setView("between"); }
    else setView("results");
  };

  const picked = useMemo(() => ({
    red: data?.opponents.find((p) => p.id === redPick),
    yellow: data?.opponents.find((p) => p.id === yellowPick),
  }), [data, redPick, yellowPick]);

  const createProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!gender) { setError("성별을 선택해 주세요."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createProfile", nickname, gender }) });
    const body = await res.json();
    if (!res.ok) { setError(body.error); setLoading(false); return; }
    localStorage.setItem(TOKEN_KEY, body.token);
    setData(body); setStage(gender === "female" ? 1 : 2); setView("select"); setLoading(false);
  };

  const submitChoice = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setLoading(true); setError("");
    const res = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "submitChoice", stage, redRecipientId: redPick, yellowRecipientId: stage === 3 ? undefined : yellowPick }) });
    const body = await res.json();
    if (!res.ok) { setError(body.error); setLoading(false); return; }
    setData(body); setRedPick(null); setYellowPick(null); setView(stage === 3 ? "results" : "between"); setLoading(false);
  };

  const resetProfile = () => { localStorage.removeItem(TOKEN_KEY); setData(null); setNickname(""); setGender(null); setRedPick(null); setYellowPick(null); setView("onboarding"); };
  const isReady = !!redPick && (stage === 3 || !!yellowPick);
  const stageTitle = stage === 1 ? "여성의 첫 번째 선택" : stage === 2 ? "남성의 두 번째 선택" : "우리 모두의 최종 선택";

  return <main className="page-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <section className="phone-card" aria-live="polite">
      <header className="app-header">
        <button className="brand" onClick={() => data ? undefined : setView("onboarding")}><span className="brand-mark">♥</span><span>마음, 한 잔</span></button>
        {data && <button className="profile-chip profile-button" onClick={resetProfile} title="프로필 초기화"><span>{data.profile.avatar}</span>{data.profile.nickname}</button>}
      </header>

      {loading && <div className="screen centered-screen loading-screen"><div className="loading-heart">♥</div><p>마음을 준비하고 있어요</p></div>}

      {!loading && view === "onboarding" && <form className="screen onboarding-screen" onSubmit={createProfile}>
        <div className="welcome-mark">♥</div><div className="eyebrow"><span /> WELCOME</div>
        <h1>당신을 어떻게<br />기억하면 될까요?</h1><p className="intro">처음 한 번만 입력하면 이 기기에서 기억할게요.<br />닉네임과 성별은 선택 단계에 사용돼요.</p>
        <label className="field-label" htmlFor="nickname">닉네임</label>
        <input id="nickname" className="nickname-input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="2~12자로 입력해 주세요" autoComplete="off" />
        <fieldset className="gender-field"><legend>성별</legend><div>
          <button type="button" className={gender === "female" ? "active" : ""} onClick={() => setGender("female")}><span>👩🏻</span><strong>여성</strong><small>1차 · 3차 선택</small></button>
          <button type="button" className={gender === "male" ? "active" : ""} onClick={() => setGender("male")}><span>🧑🏻</span><strong>남성</strong><small>2차 · 3차 선택</small></button>
        </div></fieldset>
        {error && <p className="error-message">{error}</p>}
        <button className="primary-button onboarding-submit" disabled={nickname.trim().length < 2 || !gender}>내 프로필 만들기 <span>→</span></button>
        <p className="privacy-copy">이 기기에만 로그인 정보가 남고, 받은 마음은 본인만 볼 수 있어요.</p>
      </form>}

      {!loading && data && view === "select" && <div className="screen select-screen">
        <StageRail active={stage} gender={data.profile.gender} />
        <div className="eyebrow"><span /> {stage === 3 ? "FINAL CHOICE" : `STEP 0${stage}`}</div><h1>{stageTitle}</h1>
        <p className="intro">{stage === 3 ? "마지막으로 가장 마음이 가는 한 사람에게 빨간 하트를 보내세요." : "빨간 마음과 노란 마음을 한 명씩 골라 주세요. 같은 사람에게 모두 보내도 괜찮아요."}</p>
        <div className="heart-legend compact">
          <div><span className="legend-heart red">♥</span><p><strong>{stage === 3 ? "최종 마음" : "설레는 마음"}</strong><small>이성적으로 마음이 가요</small></p></div>
          {stage !== 3 && <div><span className="legend-heart yellow">♥</span><p><strong>궁금한 마음</strong><small>더 알아가고 싶어요</small></p></div>}
        </div>
        <div className="section-heading"><h2>{data.profile.gender === "female" ? "남성 참가자" : "여성 참가자"}</h2><span>{data.opponents.length}명</span></div>
        <div className="people-grid">{data.opponents.map((person) => {
          const hasRed = redPick === person.id, hasYellow = yellowPick === person.id;
          return <article className={`person-card ${hasRed || hasYellow ? "selected" : ""}`} key={person.id}>
            <div className="avatar peach"><span>{person.avatar}</span></div><div className="person-copy"><strong>{person.nickname}</strong><small>{person.job}</small></div>
            <div className="heart-actions"><button className={`heart-button red ${hasRed ? "active" : ""}`} onClick={() => setRedPick(hasRed ? null : person.id)} aria-pressed={hasRed}>♥</button>{stage !== 3 && <button className={`heart-button yellow ${hasYellow ? "active" : ""}`} onClick={() => setYellowPick(hasYellow ? null : person.id)} aria-pressed={hasYellow}>♥</button>}</div>
          </article>;
        })}</div>
        <div className="selection-dock"><div className={`dock-summary ${stage === 3 ? "single" : ""}`}><div><span className="mini-heart red">♥</span><p><small>{stage === 3 ? "최종 마음" : "설레는 마음"}</small><strong>{picked.red?.nickname ?? "아직 선택 전"}</strong></p></div>{stage !== 3 && <div><span className="mini-heart yellow">♥</span><p><small>궁금한 마음</small><strong>{picked.yellow?.nickname ?? "아직 선택 전"}</strong></p></div>}</div><button className="primary-button" disabled={!isReady} onClick={() => setView("confirm")}>선택 확인하기 <span>→</span></button></div>
      </div>}

      {!loading && data && view === "confirm" && <div className="screen centered-screen confirm-screen">
        <button className="back-button" onClick={() => setView("select")}>← 다시 선택하기</button><div className="mail-illustration"><span>♥</span></div>
        <div className="eyebrow"><span /> STEP {stage} CHECK</div><h1>{stage}차 마음을<br />전달할까요?</h1><p className="intro">보낸 뒤에는 이번 단계의 선택을 바꿀 수 없어요.</p>
        <div className="confirm-list"><div><span className="confirm-icon red">♥</span><p><small>{stage === 3 ? "최종 마음" : "설레는 마음"}</small><strong>{picked.red?.nickname}</strong></p><span className="check">✓</span></div>{stage !== 3 && <div><span className="confirm-icon yellow">♥</span><p><small>궁금한 마음</small><strong>{picked.yellow?.nickname}</strong></p><span className="check">✓</span></div>}</div>
        {error && <p className="error-message">{error}</p>}<button className="primary-button wide" onClick={submitChoice}>{stage}차 마음 보내기 <span>♥</span></button>
      </div>}

      {!loading && data && view === "between" && <div className="screen centered-screen waiting-screen">
        <StageRail active={data.profile.gender === "female" ? 2 : 3} gender={data.profile.gender} /><div className="sent-visual"><span className="orbit-heart one">♥</span><span className="orbit-heart two">♥</span><div className="envelope">♥</div></div>
        <div className="eyebrow"><span /> SAVED</div><h1>마음이 안전하게<br />저장되었어요</h1>
        <p className="intro">{data.profile.gender === "female" ? "지금은 남성 참가자들의 2차 선택 차례예요. 모두 마치면 최종 선택이 시작돼요." : "이제 남녀 모두가 참여하는 마지막 선택만 남았어요."}</p>
        <div className="waiting-card"><div className="pulse-dot" /><p><strong>{data.profile.gender === "female" ? "2차 선택 진행 중" : "3차 최종 선택 준비"}</strong><small>선택 내용은 다른 사람에게 보이지 않아요</small></p></div>
        <button className="primary-button wide demo-button" onClick={() => { setStage(3); setView("select"); }}>데모: 3차 최종 선택 시작 <span>→</span></button><p className="demo-note">다음 버전에서는 운영자가 전체 단계를 전환해요</p>
      </div>}

      {!loading && data && view === "results" && <Results profile={data.profile} results={data.results} />}
    </section>
  </main>;
}

function StageRail({ active, gender }: { active: number; gender: Gender }) {
  return <div className="stage-rail" aria-label="선택 진행 단계">{[1, 2, 3].map((item) => <div key={item} className={`${item === active ? "active" : ""} ${item < active ? "done" : ""}`}><span>{item < active ? "✓" : item}</span><small>{item === 1 ? "여성" : item === 2 ? "남성" : "최종"}</small>{((gender === "male" && item === 1) || (gender === "female" && item === 2)) && <i>대기</i>}</div>)}</div>;
}

function Results({ profile, results }: { profile: Person; results: Result[] }) {
  return <div className="screen results-screen"><div className="result-hero"><div className="confetti">✦ <span>♥</span> ✦</div><div className="eyebrow light"><span /> YOUR HEARTS</div><h1>{profile.nickname}님에게<br /><em>{results.length}개의 마음</em>이 도착했어요</h1><p>1차부터 최종 선택까지, 받은 마음을 단계별로 모았어요.</p></div>
    <div className="results-content"><div className="result-overview">{[1, 2, 3].map((stage) => <div key={stage}><strong>{results.filter((r) => r.stage === stage).length}</strong><small>{stage}차 마음</small></div>)}</div>
      {[1, 2, 3].map((stage) => { const stageResults = results.filter((r) => r.stage === stage); return <section className="stage-results" key={stage}><div className="result-stage-title"><span>{stage}</span><div><strong>{stage === 1 ? "여성의 첫 번째 선택" : stage === 2 ? "남성의 두 번째 선택" : "모두의 최종 선택"}</strong><small>{stageResults.length ? `${stageResults.length}개의 마음이 도착했어요` : "도착한 마음이 없어요"}</small></div></div>
        {stageResults.length > 0 && <div className="incoming-list">{stageResults.map((person, index) => <article key={`${stage}-${person.nickname}-${index}`}><div className="incoming-avatar">{person.avatar}</div><div><strong>{person.nickname}</strong><small>{person.heartColor === "red" ? (stage === 3 ? "최종 마음을 보냈어요" : "이성적으로 마음이 가요") : "더 알아가고 싶어요"}</small></div><span className={`incoming-heart ${person.heartColor}`}>♥</span></article>)}</div>}
      </section>; })}
      <div className="privacy-note"><span>◌</span><p><strong>이 결과는 {profile.nickname}님에게만 보여요</strong><small>다른 참가자는 내 결과를 확인할 수 없어요.</small></p></div>
    </div></div>;
}

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Gender = "male" | "female";
type Heart = "red" | "yellow";
type Person = { id: string; nickname: string; gender: Gender; avatar: string; job: string };
type Result = { stage: number; heartColor: Heart; nickname: string; avatar: string; isMutual: boolean };
type Progress = Record<1 | 2 | 3, { completed: number; expected: number }>;
type AppState = {
  profile: Person;
  opponents: Person[];
  completedStages: number[];
  results: Result[];
  event: { currentStage: number; progress: Progress };
};
type View = "auth" | "select" | "confirm" | "waiting" | "reveal" | "results";
type AuthMode = "login" | "create";

const TOKEN_KEY = "maeum-session-token";

export default function Home() {
  const [data, setData] = useState<AppState | null>(null);
  const [view, setView] = useState<View>("auth");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [stage, setStage] = useState(1);
  const [redPick, setRedPick] = useState<string | null>(null);
  const [yellowPick, setYellowPick] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const routeFromState = useCallback((state: AppState) => {
    const current = state.event.currentStage;
    if (current >= 4) { setView("results"); return; }
    if (current === 1) {
      if (state.profile.gender === "female" && !state.completedStages.includes(1)) {
        setStage(1); setView("select");
      } else setView("waiting");
      return;
    }
    if (current === 2) {
      if (state.profile.gender === "male" && !state.completedStages.includes(2)) {
        setStage(2); setView("reveal");
      } else setView("waiting");
      return;
    }
    if (!state.completedStages.includes(3)) {
      setStage(3); setView("reveal");
    } else setView("waiting");
  }, []);

  const loadState = useCallback(async (token: string, showLoader: boolean) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch("/api/app", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      const state = await response.json() as AppState;
      setData(state);
      routeFromState(state);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setData(null);
      setView("auth");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [routeFromState]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => void loadState(token, true), 0);
    return () => window.clearTimeout(timer);
  }, [loadState]);

  useEffect(() => {
    if (!data || view !== "waiting") return;
    const timer = window.setInterval(() => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) void loadState(token, false);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [data, loadState, view]);

  const picked = useMemo(() => ({
    red: data?.opponents.find((person) => person.id === redPick),
    yellow: data?.opponents.find((person) => person.id === yellowPick),
  }), [data, redPick, yellowPick]);

  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    if (authMode === "create" && !gender) { setError("성별을 선택해 주세요."); return; }
    setLoading(true); setError("");
    const response = await fetch("/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: authMode === "create" ? "createProfile" : "login", nickname, password, gender }),
    });
    const body = await response.json();
    if (!response.ok) { setError(body.error); setLoading(false); return; }
    localStorage.setItem(TOKEN_KEY, body.token);
    setData(body); setPassword(""); routeFromState(body); setLoading(false);
  };

  const submitChoice = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setLoading(true); setError("");
    const response = await fetch("/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "submitChoice", stage, redRecipientId: redPick, yellowRecipientId: stage === 3 ? undefined : yellowPick }),
    });
    const body = await response.json();
    if (!response.ok) { setError(body.error); setLoading(false); return; }
    setData(body); setRedPick(null); setYellowPick(null); routeFromState(body); setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setData(null); setNickname(""); setPassword(""); setGender(null);
    setRedPick(null); setYellowPick(null); setError(""); setAuthMode("login"); setView("auth");
  };

  const isReady = !!redPick && (stage === 3 || !!yellowPick);
  const stageTitle = stage === 1 ? "여성의 첫 번째 선택" : stage === 2 ? "남성의 두 번째 선택" : "우리 모두의 최종 선택";

  return <main className="page-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <section className="phone-card" aria-live="polite">
      <header className="app-header">
        <button className="brand"><span className="brand-mark">♥</span><span>마음, 한 잔</span></button>
        {data && <button className="profile-chip profile-button" onClick={logout} title="로그아웃"><span>{data.profile.avatar}</span>{data.profile.nickname}<i>로그아웃</i></button>}
      </header>

      {loading && <div className="screen centered-screen loading-screen"><div className="loading-heart">♥</div><p>마음을 준비하고 있어요</p></div>}

      {!loading && view === "auth" && <form className="screen onboarding-screen" onSubmit={authenticate}>
        <div className="welcome-mark">♥</div><div className="eyebrow"><span /> WELCOME</div>
        <h1>{authMode === "login" ? <>다시 만나서<br />반가워요</> : <>당신을 어떻게<br />기억하면 될까요?</>}</h1>
        <p className="intro">{authMode === "login" ? "처음 등록한 닉네임과 비밀번호로 다시 들어오세요." : "닉네임과 비밀번호로 계정을 만들면 다른 기기에서도 이어서 참여할 수 있어요."}</p>
        <div className="auth-tabs"><button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setError(""); }}>로그인</button><button type="button" className={authMode === "create" ? "active" : ""} onClick={() => { setAuthMode("create"); setError(""); }}>처음 참가하기</button></div>
        <label className="field-label" htmlFor="nickname">닉네임</label>
        <input id="nickname" className="nickname-input" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={12} placeholder="2~12자로 입력해 주세요" autoComplete="username" />
        <label className="field-label password-label" htmlFor="password">비밀번호</label>
        <input id="password" className="nickname-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={32} placeholder="4자 이상 입력해 주세요" autoComplete={authMode === "login" ? "current-password" : "new-password"} />
        {authMode === "create" && <fieldset className="gender-field"><legend>성별</legend><div>
          <button type="button" className={gender === "female" ? "active" : ""} onClick={() => setGender("female")}><span>👩🏻</span><strong>여성</strong><small>1차 · 3차 선택</small></button>
          <button type="button" className={gender === "male" ? "active" : ""} onClick={() => setGender("male")}><span>🧑🏻</span><strong>남성</strong><small>2차 · 3차 선택</small></button>
        </div></fieldset>}
        {error && <p className="error-message">{error}</p>}
        <button className="primary-button onboarding-submit" disabled={nickname.trim().length < 2 || password.length < 4 || (authMode === "create" && !gender)}>{authMode === "login" ? "로그인하고 이어하기" : "내 계정 만들기"} <span>→</span></button>
        <p className="privacy-copy">비밀번호는 암호화된 해시로 저장되며, 받은 마음은 본인만 볼 수 있어요.</p>
      </form>}

      {!loading && data && view === "select" && <div className="screen select-screen">
        <StageRail active={stage} />
        <div className="eyebrow"><span /> {stage === 3 ? "FINAL CHOICE" : `STEP 0${stage}`}</div><h1>{stageTitle}</h1>
        <p className="intro">{stage === 3 ? "마지막으로 가장 마음이 가는 한 사람에게 빨간 하트를 보내세요." : "빨간 마음과 노란 마음을 한 명씩 골라 주세요. 같은 사람에게 모두 보내도 괜찮아요."}</p>
        <div className="heart-legend compact"><div><span className="legend-heart red">♥</span><p><strong>{stage === 3 ? "최종 마음" : "설레는 마음"}</strong><small>이성적으로 마음이 가요</small></p></div>{stage !== 3 && <div><span className="legend-heart yellow">♥</span><p><strong>궁금한 마음</strong><small>더 알아가고 싶어요</small></p></div>}</div>
        <div className="section-heading"><h2>{data.profile.gender === "female" ? "남성 참가자" : "여성 참가자"}</h2><span>{data.opponents.length}명</span></div>
        {data.opponents.length ? <div className="people-grid">{data.opponents.map((person) => {
          const hasRed = redPick === person.id, hasYellow = yellowPick === person.id;
          return <article className={`person-card ${hasRed || hasYellow ? "selected" : ""}`} key={person.id}><div className="avatar peach"><span>{person.avatar}</span></div><div className="person-copy"><strong>{person.nickname}</strong><small>{person.job}</small></div><div className="heart-actions"><button className={`heart-button red ${hasRed ? "active" : ""}`} onClick={() => setRedPick(hasRed ? null : person.id)} aria-pressed={hasRed}>♥</button>{stage !== 3 && <button className={`heart-button yellow ${hasYellow ? "active" : ""}`} onClick={() => setYellowPick(hasYellow ? null : person.id)} aria-pressed={hasYellow}>♥</button>}</div></article>;
        })}</div> : <div className="empty-opponents">상대 성별 참가자가 입장하기를 기다리고 있어요.</div>}
        <div className="selection-dock"><div className={`dock-summary ${stage === 3 ? "single" : ""}`}><div><span className="mini-heart red">♥</span><p><small>{stage === 3 ? "최종 마음" : "설레는 마음"}</small><strong>{picked.red?.nickname ?? "아직 선택 전"}</strong></p></div>{stage !== 3 && <div><span className="mini-heart yellow">♥</span><p><small>궁금한 마음</small><strong>{picked.yellow?.nickname ?? "아직 선택 전"}</strong></p></div>}</div><button className="primary-button" disabled={!isReady} onClick={() => setView("confirm")}>선택 확인하기 <span>→</span></button></div>
      </div>}

      {!loading && data && view === "confirm" && <div className="screen centered-screen confirm-screen">
        <button className="back-button" onClick={() => setView("select")}>← 다시 선택하기</button><div className="mail-illustration"><span>♥</span></div>
        <div className="eyebrow"><span /> STEP {stage} CHECK</div><h1>{stage}차 마음을<br />전달할까요?</h1><p className="intro">보낸 뒤에는 이번 단계의 선택을 바꿀 수 없어요.</p>
        <div className="confirm-list"><div><span className="confirm-icon red">♥</span><p><small>{stage === 3 ? "최종 마음" : "설레는 마음"}</small><strong>{picked.red?.nickname}</strong></p><span className="check">✓</span></div>{stage !== 3 && <div><span className="confirm-icon yellow">♥</span><p><small>궁금한 마음</small><strong>{picked.yellow?.nickname}</strong></p><span className="check">✓</span></div>}</div>
        {error && <p className="error-message">{error}</p>}<button className="primary-button wide" onClick={submitChoice}>{stage}차 마음 보내기 <span>♥</span></button>
      </div>}

      {!loading && data && view === "reveal" && <StageReveal data={data} nextStage={stage} onContinue={() => setView("select")} />}
      {!loading && data && view === "waiting" && <Waiting data={data} onRefresh={() => { const token = localStorage.getItem(TOKEN_KEY); if (token) loadState(token, true); }} />}
      {!loading && data && view === "results" && <Results profile={data.profile} results={data.results} />}
    </section>
  </main>;
}

function StageRail({ active }: { active: number }) {
  return <div className="stage-rail" aria-label="선택 진행 단계">{[1, 2, 3].map((item) => <div key={item} className={`${item === active ? "active" : ""} ${item < active ? "done" : ""}`}><span>{item < active ? "✓" : item}</span><small>{item === 1 ? "여성" : item === 2 ? "남성" : "최종"}</small></div>)}</div>;
}

function Waiting({ data, onRefresh }: { data: AppState; onRefresh: () => void }) {
  const current = Math.min(data.event.currentStage, 3) as 1 | 2 | 3;
  const progress = data.event.progress[current];
  const hasSubmitted = data.completedStages.includes(current);
  const isParticipantTurn = (current === 1 && data.profile.gender === "female") || (current === 2 && data.profile.gender === "male") || current === 3;
  return <div className="screen centered-screen waiting-screen"><StageRail active={current} /><div className="sent-visual"><span className="orbit-heart one">♥</span><span className="orbit-heart two">♥</span><div className="envelope">♥</div></div><div className="eyebrow"><span /> LIVE STATUS</div><h1>{hasSubmitted ? "내 선택을 마쳤어요" : isParticipantTurn ? "선택할 차례예요" : `${current}차 선택을 기다려요`}</h1><p className="intro">현재 단계 참여자 전원이 제출하면 다음 단계가 자동으로 열리고, 방금 받은 마음도 공개돼요.</p><div className="waiting-card"><div className="pulse-dot" /><p><strong>{current}차 선택 {progress.completed}명 / {progress.expected}명 완료</strong><small>{Math.max(0, progress.expected - progress.completed)}명의 제출을 기다리는 중 · 3초마다 자동 확인</small></p></div>{isParticipantTurn && !hasSubmitted && <button className="primary-button wide" onClick={onRefresh}>선택 화면 열기 <span>→</span></button>}<button className="secondary-button refresh-state" onClick={onRefresh}>지금 새로고침</button><ReleasedResults results={data.results} maxStage={current - 1} /></div>;
}

function StageReveal({ data, nextStage, onContinue }: { data: AppState; nextStage: number; onContinue: () => void }) {
  const revealStage = nextStage - 1;
  const stageResults = data.results.filter((result) => result.stage === revealStage);
  return <div className="screen reveal-screen"><StageRail active={nextStage} /><div className="eyebrow"><span /> STEP {revealStage} RESULT</div><h1>{revealStage}차에 받은<br />마음이 공개됐어요</h1><p className="intro">이 결과는 나에게만 보여요. 확인한 뒤 다음 선택을 진행해 주세요.</p><ResultList results={stageResults} stage={revealStage} /><button className="primary-button reveal-next" onClick={onContinue}>{nextStage === 3 ? "3차 최종 선택 시작" : "2차 선택 시작"} <span>→</span></button></div>;
}

function ReleasedResults({ results, maxStage }: { results: Result[]; maxStage: number }) {
  if (maxStage < 1) return null;
  return <div className="released-results"><strong>지금까지 받은 마음</strong>{[1, 2].filter((stage) => stage <= maxStage).map((stage) => <div key={stage}><span>{stage}차</span><b>{results.filter((result) => result.stage === stage).length}개</b></div>)}</div>;
}

function ResultList({ results, stage }: { results: Result[]; stage: number }) {
  if (!results.length) return <div className="empty-result"><span>♡</span><strong>이번 단계에 도착한 마음은 없어요</strong><small>아직 마지막 선택이 남아 있어요.</small></div>;
  return <div className="incoming-list">{results.map((person, index) => <article className={person.isMutual ? "mutual" : ""} key={`${stage}-${person.nickname}-${index}`}><div className="incoming-avatar">{person.avatar}</div><div><strong>{person.nickname}</strong><small>{person.isMutual ? "서로를 최종 선택했어요" : person.heartColor === "red" ? (stage === 3 ? "나를 최종 선택했어요" : "이성적으로 마음이 가요") : "더 알아가고 싶어요"}</small></div>{person.isMutual && <em>매칭</em>}<span className={`incoming-heart ${person.heartColor}`}>♥</span></article>)}</div>;
}

function Results({ profile, results }: { profile: Person; results: Result[] }) {
  const matches = results.filter((result) => result.stage === 3 && result.isMutual);
  return <div className="screen results-screen"><div className="result-hero"><div className="confetti">✦ <span>♥</span> ✦</div><div className="eyebrow light"><span /> FINAL RESULT</div><h1>{matches.length ? <>{profile.nickname}님,<br /><em>{matches.length}명과 매칭됐어요</em></> : <>{profile.nickname}님에게<br /><em>{results.length}개의 마음</em>이 도착했어요</>}</h1><p>단계별로 받은 마음과 최종 매칭 결과를 확인하세요.</p></div><div className="results-content"><div className="result-overview">{[1, 2, 3].map((resultStage) => <div key={resultStage}><strong>{results.filter((result) => result.stage === resultStage).length}</strong><small>{resultStage}차 마음</small></div>)}</div>{[1, 2, 3].map((resultStage) => { const stageResults = results.filter((result) => result.stage === resultStage); return <section className="stage-results" key={resultStage}><div className="result-stage-title"><span>{resultStage}</span><div><strong>{resultStage === 1 ? "여성의 첫 번째 선택" : resultStage === 2 ? "남성의 두 번째 선택" : "모두의 최종 선택"}</strong><small>{stageResults.length ? `${stageResults.length}개의 마음이 도착했어요` : "도착한 마음이 없어요"}</small></div></div><ResultList results={stageResults} stage={resultStage} /></section>; })}<div className="privacy-note"><span>◌</span><p><strong>이 결과는 {profile.nickname}님에게만 보여요</strong><small>상대가 나를 선택했지만 매칭되지 않은 경우도 그대로 표시돼요.</small></p></div></div></div>;
}

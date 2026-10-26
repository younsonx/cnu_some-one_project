import type { Metadata } from "next";
import LiveSimulation from "./LiveSimulation";
import "./simulation.css";

export const metadata: Metadata = {
  title: "20인 라이브 시뮬레이션 — 마음, 한 잔",
  description: "여성 10명과 남성 10명이 세 단계의 선택을 진행하는 실시간 데모입니다.",
  openGraph: { title: "20인 라이브 시뮬레이션 — 마음, 한 잔", description: "20명의 가상 참가자가 단계별 선택을 진행하는 운영자용 실시간 시뮬레이션", images: [] },
  twitter: { title: "20인 라이브 시뮬레이션 — 마음, 한 잔", description: "20명의 가상 참가자가 단계별 선택을 진행하는 운영자용 실시간 시뮬레이션", images: [] },
};

export default function SimulationPage() {
  return <LiveSimulation />;
}

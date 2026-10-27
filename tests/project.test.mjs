import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("ships participant, admin, simulation, and API routes", async () => {
  await Promise.all([
    access(new URL("app/page.tsx", root)),
    access(new URL("app/admin/page.tsx", root)),
    access(new URL("app/simulation/page.tsx", root)),
    access(new URL("app/api/app/route.ts", root)),
    access(new URL("app/api/admin/reset/route.ts", root)),
  ]);
});

test("implements password login without storing plaintext passwords", async () => {
  const [api, schema] = await Promise.all([read("app/api/app/route.ts"), read("db/schema.ts")]);
  assert.match(api, /PBKDF2/);
  assert.match(api, /PASSWORD_ITERATIONS = 100_000/);
  assert.match(api, /action === "login"/);
  assert.match(schema, /passwordHash: text\("password_hash"\)/);
  assert.match(schema, /participantSessions/);
  assert.doesNotMatch(schema, /password: text\(/);
});

test("gates stages on all required submissions and reveals completed rounds", async () => {
  const [api, page] = await Promise.all([read("app/api/app/route.ts"), read("app/page.tsx")]);
  assert.match(api, /counts\.stage1Done >= counts\.women/);
  assert.match(api, /counts\.stage2Done >= counts\.men/);
  assert.match(api, /counts\.stage3Done >= counts\.total/);
  assert.match(api, /c\.stage < \?/);
  assert.match(page, /setInterval/);
  assert.match(page, /서로를 최종 선택했어요/);
  assert.match(page, /나를 최종 선택했어요/);
});

test("includes an isolated 20-person live simulation", async () => {
  const simulation = await read("app/simulation/LiveSimulation.tsx");
  assert.match(simulation, /실제 데이터와 분리된 가상 시뮬레이션/);
  assert.match(simulation, /여성 10명 · 남성 10명/);
  assert.match(simulation, /setTimeout/);
  assert.match(simulation, /일시정지/);
  assert.match(simulation, /최종 상호 선택 결과/);
});

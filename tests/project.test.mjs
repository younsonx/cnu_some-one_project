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
  assert.match(api, /PASSWORD_ITERATIONS = 120_000/);
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

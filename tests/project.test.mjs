import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("ships every public route and server endpoint", async () => {
  await Promise.all([
    access(new URL("app/page.tsx", root)),
    access(new URL("app/admin/page.tsx", root)),
    access(new URL("app/simulation/page.tsx", root)),
    access(new URL("app/api/app/route.ts", root)),
    access(new URL("app/api/admin/reset/route.ts", root)),
  ]);
});

test("keeps the three-stage heart rules in the participant app", async () => {
  const [page, schema] = await Promise.all([
    read("app/page.tsx"),
    read("db/schema.ts"),
  ]);

  assert.match(page, /gender === "female" \? 1 : 2/);
  assert.match(page, /stage === 3 \? undefined : yellowPick/);
  assert.match(page, /localStorage\.setItem\(TOKEN_KEY/);
  assert.match(schema, /enum: \["red", "yellow"\]/);
  assert.match(schema, /uniqueIndex\("idx_choices_sender_stage_color"\)/);
});

test("documents participant, admin, database, and security design", async () => {
  const [readme, gitignore] = await Promise.all([
    read("README.md"),
    read(".gitignore"),
  ]);

  for (const path of [
    "docs/ARCHITECTURE.md",
    "docs/PARTICIPANT_APP.md",
    "docs/ADMIN_DASHBOARD.md",
    "docs/DATABASE_AND_API.md",
    "docs/SECURITY_AND_LIMITATIONS.md",
  ]) {
    assert.match(readme, new RegExp(path.replaceAll(".", "\\.")));
    await access(new URL(path, root));
  }

  assert.match(gitignore, /^\.dev\.vars$/m);
});

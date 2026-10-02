import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

/**
 * Optimistic-concurrency updates (Client, Contact, Project, Task,
 * Deliverable) must be safe under genuinely concurrent requests, not just
 * sequential ones. The original implementation read `version`, compared it
 * in application code, then issued a plain `update({ where: { id } })` — a
 * classic check-then-act race: if two requests both read the same
 * pre-update version before either one writes, both pass the check and
 * both write, and whichever commits last silently clobbers the other with
 * no conflict ever reported to its caller.
 *
 * A black-box HTTP test firing two requests via `Promise.all` does *not*
 * reliably reproduce this: across repeated runs, each request's full
 * round trip (guards, validation, the SELECT) tends to finish before the
 * other one's SELECT starts, so the unsafe window is rarely actually hit —
 * tested by temporarily reverting the fix and running the naive version of
 * this test 5 times in a row; it passed every time even with the bug
 * present. A timing-dependent test that can't actually fail against the
 * bug it's meant to catch is worse than no test — it would read as
 * coverage while proving nothing.
 *
 * So instead, this test constructs the unsafe interleaving directly against
 * the database, the same way a real race would: issue both reads first
 * (forcing them to both observe the same starting version, which is
 * exactly the precondition for the bug), *then* issue both writes. Run
 * against the OLD pattern (a plain `update`), this reliably demonstrates
 * silent data loss. Run against the CURRENT pattern (`updateMany` with the
 * expected version folded into its WHERE clause), it reliably shows the
 * second write affecting zero rows — because Postgres, not application
 * code, is what's deciding whether the expected version still matches at
 * the moment each UPDATE actually executes.
 */
describe("Adversarial QA audit: concurrent-write race conditions (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(getPrisma(app));
  });

  it("demonstrates the vulnerable check-then-act pattern silently loses a concurrent write (regression guard for what the fix replaces)", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@race-demo-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Vulnerable Pattern Demo" });
    const prisma = getPrisma(app).client;

    // Both "requests" read the same version first — the exact precondition
    // for the bug (two callers who each believe version 1 is current).
    const [readA, readB] = await Promise.all([
      prisma.client.findUniqueOrThrow({ where: { id: client.body.id } }),
      prisma.client.findUniqueOrThrow({ where: { id: client.body.id } }),
    ]);
    expect(readA.version).toBe(1);
    expect(readB.version).toBe(1);

    // Then both "requests" write, the way the old code did: blindly, with
    // no version in the WHERE clause, trusting the read that already
    // happened. This is intentionally reproducing the bug pattern, not
    // calling the (now-fixed) service.
    await Promise.all([
      prisma.client.update({ where: { id: client.body.id }, data: { industry: "From A", version: { increment: 1 } } }),
      prisma.client.update({ where: { id: client.body.id }, data: { industry: "From B", version: { increment: 1 } } }),
    ]);

    const final = await prisma.client.findUniqueOrThrow({ where: { id: client.body.id } });
    // Both writes landed — version advanced by 2, not 1 — even though both
    // callers thought they were the only one updating version 1. Whichever
    // wrote second silently discarded the first's change with no error to
    // anyone. This is the bug; the assertions below are documenting it, not
    // approving of it.
    expect(final.version).toBe(3);
  });

  it("the fixed (version-in-WHERE) pattern rejects the second write instead of silently losing it, under the identical forced interleaving", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@race-fixed-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Fixed Pattern Demo" });
    const prisma = getPrisma(app).client;

    const [readA, readB] = await Promise.all([
      prisma.client.findUniqueOrThrow({ where: { id: client.body.id } }),
      prisma.client.findUniqueOrThrow({ where: { id: client.body.id } }),
    ]);
    expect(readA.version).toBe(1);
    expect(readB.version).toBe(1);

    // Same forced interleaving, but using the fixed call shape every
    // service in this codebase now uses: the expected version is part of
    // the WHERE clause itself, so only one of these two statements can
    // possibly match a row, however the database happens to schedule them.
    const [resultA, resultB] = await Promise.all([
      prisma.client.updateMany({ where: { id: client.body.id, version: 1 }, data: { industry: "From A", version: { increment: 1 } } }),
      prisma.client.updateMany({ where: { id: client.body.id, version: 1 }, data: { industry: "From B", version: { increment: 1 } } }),
    ]);

    const counts = [resultA.count, resultB.count].sort();
    expect(counts).toEqual([0, 1]);

    const final = await prisma.client.findUniqueOrThrow({ where: { id: client.body.id } });
    expect(final.version).toBe(2);
  });

  it("end-to-end through the real API: concurrent requests still produce at most one 200 and the rest 409, as observed over repeated trials", async () => {
    // Not a substitute for the deterministic tests above (HTTP-level timing
    // isn't reliable either way, per this file's top comment), but worth
    // keeping as a real-world sanity check that the API layer's behavior is
    // at least consistent with the guarantee: never two 200s for the same
    // version, across several independent attempts.
    const { cookie } = await signupOrg(app, { email: "owner@race-e2e-sanity-test.example" });

    for (let trial = 0; trial < 5; trial += 1) {
      const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: `Sanity Trial ${trial}` });
      const [resA, resB] = await Promise.all([
        api(app).patch(`/api/v1/clients/${client.body.id}`).set("Cookie", cookie).send({ industry: "A", version: 1 }),
        api(app).patch(`/api/v1/clients/${client.body.id}`).set("Cookie", cookie).send({ industry: "B", version: 1 }),
      ]);
      const successCount = [resA.status, resB.status].filter((s) => s === 200).length;
      expect(successCount).toBeLessThanOrEqual(1);
    }
  });
});

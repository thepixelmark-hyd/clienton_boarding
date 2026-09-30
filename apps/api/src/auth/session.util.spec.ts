import { generateSessionToken, hashToken } from "./session.util";

describe("session token utilities", () => {
  it("generates a sufficiently long random token each time", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(64); // 32 bytes hex-encoded
  });

  it("hashes the same token deterministically (so it can be looked up by hash)", () => {
    const token = "fixed-token-for-test";
    expect(hashToken(token)).toEqual(hashToken(token));
  });

  it("produces a hash that does not equal the raw token (never stores it in plaintext)", () => {
    const token = generateSessionToken();
    expect(hashToken(token)).not.toEqual(token);
  });

  it("hashes different tokens to different values", () => {
    expect(hashToken("a")).not.toEqual(hashToken("b"));
  });
});

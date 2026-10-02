import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { parseEnv } = await import("@/server/env");

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  S3_ENDPOINT: "http://localhost:9000",
  S3_BUCKET: "photos",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
};

describe("parseEnv", () => {
  it("applique les valeurs par défaut", () => {
    const env = parseEnv(valid);
    expect(env.S3_REGION).toBe("auto");
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it("convertit S3_FORCE_PATH_STYLE en booléen", () => {
    expect(parseEnv({ ...valid, S3_FORCE_PATH_STYLE: "true" }).S3_FORCE_PATH_STYLE).toBe(true);
  });

  it("liste les variables manquantes sans divulguer de valeur", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: undefined, S3_BUCKET: "" })).toThrow(/DATABASE_URL, S3_BUCKET/);
  });
});

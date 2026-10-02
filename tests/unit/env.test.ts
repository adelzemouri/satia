import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { invalidEnvKeys, parseEnv } = await import("@/server/env");

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  S3_ENDPOINT: "http://localhost:9000",
  S3_BUCKET: "photos",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  BETTER_AUTH_SECRET: "x".repeat(32),
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

describe("APP_HOSTS", () => {
  it("découpe la liste de domaines", () => {
    expect(parseEnv({ ...valid, APP_HOSTS: "satia.fr, www.satia.fr" }).APP_HOSTS).toEqual(["satia.fr", "www.satia.fr"]);
  });

  it("exige un secret d'authentification assez long", () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: "court" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});

describe("invalidEnvKeys", () => {
  it("nomme les variables en défaut sans leurs valeurs", () => {
    expect(invalidEnvKeys(valid)).toEqual([]);
    const keys = invalidEnvKeys({ ...valid, BETTER_AUTH_SECRET: undefined, SETUP_TOKEN: "court-123" });
    expect(keys).toEqual(["BETTER_AUTH_SECRET", "SETUP_TOKEN"]);
  });
});

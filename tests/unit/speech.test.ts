import { describe, expect, it } from "vitest";

import { speechErrorKey } from "@/features/ai/use-speech";

describe("speechErrorKey", () => {
  it("ne signale pas une dictée arrêtée volontairement", () => {
    expect(speechErrorKey("aborted")).toBeNull();
  });

  it("explique chaque cause courante", () => {
    expect(speechErrorKey("no-speech")).toBe("speech_silent");
    expect(speechErrorKey("service-not-allowed")).toBe("speech_unavailable");
    expect(speechErrorKey("not-allowed")).toBe("speech_denied");
    expect(speechErrorKey("network")).toBe("speech_network");
    expect(speechErrorKey("audio-capture")).toBe("speech_mic");
    expect(speechErrorKey("autre")).toBe("speech_failed");
  });
});

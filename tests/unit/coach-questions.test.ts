import { describe, expect, it } from "vitest";

import { COACH_QUESTIONS, isCoachQuestion, suggestedQuestions } from "@/domain/coach-questions";

describe("questions suggérées au coach", () => {
  it("commence par la question du moment", () => {
    expect(suggestedQuestions(8, "a")[0]).toBe("breakfastIdea");
    expect(suggestedQuestions(12, "a")[0]).toBe("lunchBox");
    expect(suggestedQuestions(16, "a")[0]).toBe("snackIdea");
    expect(suggestedQuestions(20, "a")[0]).toBe("dinnerIdea");
  });

  it("propose trois questions distinctes, stables pour une même graine", () => {
    const list = suggestedQuestions(20, "user:2026-10-05");
    expect(list).toHaveLength(3);
    expect(new Set(list).size).toBe(3);
    expect(suggestedQuestions(20, "user:2026-10-05")).toEqual(list);
    expect(list.every((question) => COACH_QUESTIONS.includes(question))).toBe(true);
  });

  it("ne reconnaît que les clés connues", () => {
    expect(isCoachQuestion("dinnerIdea")).toBe(true);
    expect(isCoachQuestion("autre chose")).toBe(false);
    expect(isCoachQuestion(undefined)).toBe(false);
  });
});

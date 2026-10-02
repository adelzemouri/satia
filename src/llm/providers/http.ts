import { LlmProviderError } from "../types";

const TIMEOUT_MS = 30_000;

/** POST JSON vers un fournisseur ; le corps de l'erreur est journalisé, jamais la clé. */
export async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new LlmProviderError(error instanceof Error ? error.message : "fetch failed", timeout ? "timeout" : "http");
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    console.warn(`[llm] ${new URL(url).host} a répondu ${response.status} : ${detail}`);
    throw new LlmProviderError(`HTTP ${response.status}`, "http");
  }
  return response.json();
}

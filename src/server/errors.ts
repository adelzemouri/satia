/** Erreur métier dont le `code` est traduit côté interface (messages `errors.*`). */
export class DomainError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

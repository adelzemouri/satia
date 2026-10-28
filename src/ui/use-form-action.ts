"use client";

import { type FormEvent, startTransition, useActionState, useMemo } from "react";

import { withNetworkFallback } from "./network-failure";

/**
 * Comme useActionState, en évitant que React 19 vide le formulaire après une erreur.
 * Une fois hydraté, onSubmit soumet sans réinitialisation ; avant l'hydratation, `action`
 * garde le formulaire fonctionnel (amélioration progressive).
 * Une coupure réseau pendant l'envoi s'affiche comme l'erreur `network` du formulaire.
 */
export function useFormAction<State extends { error?: string } | null>(
  action: (state: Awaited<State>, formData: FormData) => State | Promise<State>,
  initial: Awaited<State>,
) {
  // Même signature que l'action d'origine : seule la coupure réseau change de traitement.
  const safeAction = useMemo(() => withNetworkFallback(action) as typeof action, [action]);
  const [state, dispatch, pending] = useActionState<State, FormData>(safeAction, initial);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return [state, { action: dispatch, onSubmit }, pending] as const;
}

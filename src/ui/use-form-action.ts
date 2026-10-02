"use client";

import { type FormEvent, startTransition, useActionState } from "react";

/**
 * Comme useActionState, en évitant que React 19 vide le formulaire après une erreur.
 * Une fois hydraté, onSubmit soumet sans réinitialisation ; avant l'hydratation, `action`
 * garde le formulaire fonctionnel (amélioration progressive).
 */
export function useFormAction<State>(
  action: (state: Awaited<State>, formData: FormData) => State | Promise<State>,
  initial: Awaited<State>,
) {
  const [state, dispatch, pending] = useActionState<State, FormData>(action, initial);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return [state, { action: dispatch, onSubmit }, pending] as const;
}

/**
 * Identifiant caché à côté d'un champ mot de passe : le gestionnaire de mots de passe sait
 * à quel compte il se rapporte, et Chrome ne signale plus de formulaire sans identifiant.
 */
export function UsernameField({ value }: { value: string }) {
  return <input type="email" name="username" autoComplete="username" value={value} readOnly hidden />;
}

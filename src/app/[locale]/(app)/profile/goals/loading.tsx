/**
 * Réglage plein écran en préparation : un fond uni plutôt que le squelette de Moi. Sur
 * ordinateur, la carte du réglage, à sa place dans la page.
 */
export default function GoalLoading() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-30 bg-surface lg:static lg:z-auto lg:mx-auto lg:mt-4 lg:h-[34rem] lg:w-full lg:max-w-lg lg:rounded-[var(--radius-card)]"
    />
  );
}

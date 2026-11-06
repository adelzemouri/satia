/**
 * iOS 26 (Safari et appli installée) garde parfois, une fois le clavier refermé, la hauteur
 * qu'il avait quand le clavier était ouvert (WebKit bug 297779) : tout ce qui est fixé en bas
 * de l'écran, comme la barre d'onglets, reste alors en l'air au milieu de la page.
 *
 * On reconnaît cet état au visualViewport : décalé vers le bas ou plus court que la fenêtre,
 * alors que personne n'écrit et que la page n'est pas zoomée.
 */
export type ViewportState = {
  offsetTop: number;
  height: number;
  innerHeight: number;
  scale: number;
  typing: boolean;
};

/** Écart (px) toléré entre la fenêtre et le visualViewport : arrondis, barre d'adresse… */
const TOLERANCE = 2;

export function viewportLooksStuck(s: ViewportState): boolean {
  if (s.typing) return false; // clavier ouvert : l'écart est normal
  if (Math.abs(s.scale - 1) > 0.01) return false; // zoom à deux doigts : idem
  return s.offsetTop > TOLERANCE || s.innerHeight - s.height > TOLERANCE;
}

const NO_KEYBOARD_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Vrai quand l'élément qui a le focus ouvre le clavier (ou la roue d'un menu déroulant). */
export function opensKeyboard(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  return !NO_KEYBOARD_INPUTS.has((el.getAttribute("type") ?? "text").toLowerCase());
}

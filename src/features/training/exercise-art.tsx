import type { Ref, SVGProps } from "react";

import { type Role, type Shape, VIEWBOX, exerciseScene } from "@/domain/training/scene";
import type { Muscle } from "@/domain/training/types";

/** Style de chaque rôle : tout passe par currentColor et les tokens, pour les thèmes clair et sombre. */
const STYLE: Record<Role, SVGProps<SVGPathElement>> = {
  ground: { fill: "none", stroke: "var(--color-text-muted)", strokeWidth: 1.5, strokeOpacity: 0.5 },
  mat: { fill: "var(--color-text-muted)", fillOpacity: 0.22, stroke: "none" },
  scenery: {
    fill: "var(--color-text-muted)",
    fillOpacity: 0.16,
    stroke: "var(--color-text-muted)",
    strokeWidth: 2.5,
    strokeOpacity: 0.8,
  },
  equip: { fill: "none", stroke: "var(--color-text)", strokeWidth: 2.4 },
  equipThin: { fill: "none", stroke: "var(--color-text)", strokeWidth: 1.3 },
  plate: { fill: "none", stroke: "var(--color-text)", strokeWidth: 4.5 },
  equipFill: { fill: "var(--color-text)", stroke: "none" },
  hub: { fill: "var(--color-primary-soft)", stroke: "none" },
  band: { fill: "none", stroke: "var(--color-carbs)", strokeWidth: 2 },
  halo: { fill: "none", stroke: "var(--color-primary-soft)", strokeWidth: 9.5 },
  limbFar: { fill: "none", stroke: "currentColor", strokeWidth: 6.5, strokeOpacity: 0.45 },
  limb: { fill: "none", stroke: "currentColor", strokeWidth: 6.5 },
  torso: { fill: "none", stroke: "currentColor", strokeWidth: 11 },
  torsoFront: { fill: "currentColor", stroke: "currentColor", strokeWidth: 6.5 },
  head: { fill: "currentColor", stroke: "none" },
  accent: { fill: "none", stroke: "var(--color-accent)", strokeWidth: 6.5 },
  accentThin: { fill: "none", stroke: "var(--color-accent)", strokeWidth: 4.5 },
  accentFill: { fill: "var(--color-accent)", stroke: "none" },
};

const round = (value: number) => Math.round(value * 10) / 10;

/** Tracé SVG d'une forme ; un cercle devient deux arcs, pour rester interpolable. */
export function shapePath(shape: Shape): string {
  if (shape.r !== undefined) {
    const c = shape.pts[0]!;
    const r = round(shape.r);
    return `M${round(c.x - shape.r)} ${round(c.y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  }
  const [head, ...rest] = shape.pts;
  if (!head) return "";
  return `M${round(head.x)} ${round(head.y)}${rest.map((p) => `L${round(p.x)} ${round(p.y)}`).join("")}${shape.closed ? "Z" : ""}`;
}

/** Aller-retour entre la pose de départ et la pose d'arrivée, avec une courte pause à chaque bout. */
function sequence(count: number): number[] {
  const forward = Array.from({ length: count }, (_, k) => k);
  return [0, ...forward, count - 1, ...forward.slice(0, -1).reverse()];
}

function Layer({ paths, roles, animated }: { paths: string[][]; roles: Role[]; animated: boolean }) {
  const order = sequence(paths.length);
  const key = paths.length - 1;
  return roles.map((role, k) => {
    const frames = paths.map((frame) => frame[k] ?? "");
    const moving = animated && frames.some((d) => d !== frames[0]);
    return (
      <path key={k} d={frames[key]} {...STYLE[role]}>
        {moving && (
          <animate
            attributeName="d"
            values={order.map((index) => frames[index]).join(";")}
            dur="3.2s"
            repeatCount="indefinite"
          />
        )}
      </path>
    );
  });
}

type Props = {
  exerciseId: string;
  muscle: Muscle;
  /** Côté en pixels ; sans taille, l'image suit la largeur de son conteneur. */
  size?: number;
  /** Texte alternatif : sans lui, l'illustration est décorative (masquée aux lecteurs d'écran). */
  label?: string;
  /** Anime le mouvement (sinon, seule la position clé est dessinée). */
  animate?: boolean;
  className?: string;
  ref?: Ref<SVGSVGElement>;
};

/**
 * Illustration originale d'un exercice : silhouette en aplat, matériel et zone travaillée en
 * couleur d'accent. Animée, elle va et vient entre les deux positions du mouvement ; si
 * l'utilisateur préfère réduire les animations, seule la position clé est affichée.
 */
export function ExerciseArt({ exerciseId, muscle, size, label, animate = false, className, ref }: Props) {
  const scene = exerciseScene(exerciseId, muscle);
  const paths = scene.frames.map((shapes) => shapes.map(shapePath));
  const roles = scene.frames[0]!.map((shape) => shape.role);
  const stillPaths = [paths[paths.length - 1]!];
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      width={size}
      height={size}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 rounded-2xl bg-primary-soft text-primary ${className ?? ""}`}
      data-exercise-art={exerciseId}
    >
      {animate ? (
        <>
          <g className="motion-reduce:hidden">
            <Layer paths={paths} roles={roles} animated />
          </g>
          <g className="hidden motion-reduce:inline">
            <Layer paths={stillPaths} roles={roles} animated={false} />
          </g>
        </>
      ) : (
        <Layer paths={stillPaths} roles={roles} animated={false} />
      )}
    </svg>
  );
}

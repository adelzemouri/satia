/**
 * Illustrations d'exercices, partie « mise en scène » (calcul pur) : pose la silhouette au sol
 * ou à la barre, ajoute le matériel et la zone travaillée, puis centre le tout dans un carré
 * de 120 × 120. Chaque image de l'animation a exactement la même liste de formes, dans le
 * même ordre : le rendu peut ainsi interpoler chaque tracé d'une image à l'autre.
 */
import {
  type Frame,
  type JointRef,
  type Motion,
  type P,
  type Pose,
  type Prop,
  type View,
  LIMB_R,
  LEN,
  POSES,
  TORSO_R,
  add,
  angleOf,
  dir,
  frameBetween,
  lerp,
  lowest,
  motionFor,
} from "./poses";
import type { Muscle } from "./types";

export const VIEWBOX = 120;
export const GROUND = 110;
export const BAR_Y = 22;
/** Nombre d'images calculées entre la pose de départ et la pose d'arrivée (incluses). */
export const SAMPLES = 7;
/** Marge autour du dessin et agrandissement maximal de la silhouette. */
const MARGIN = 8;
const MAX_SCALE = 1.25;

export type Role =
  | "ground"
  | "mat"
  | "scenery"
  | "equip"
  | "equipThin"
  | "plate"
  | "equipFill"
  | "hub"
  | "band"
  | "halo"
  | "limbFar"
  | "limb"
  | "torso"
  | "torsoFront"
  | "head"
  | "accent"
  | "accentThin"
  | "accentFill";

/** Une forme : un cercle (un point et un rayon) ou une ligne brisée, éventuellement fermée. */
export type Shape = { role: Role; pts: P[]; closed?: boolean; r?: number };
export type Scene = { view: View; frames: Shape[][] };

type Layers = { back: Shape[]; front: Shape[] };

const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const along = (a: P, b: P, t: number): P => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
function unit(a: P, b: P): P {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
}
const line = (role: Role, ...pts: P[]): Shape => ({ role, pts });
const circle = (role: Role, c: P, r: number): Shape => ({ role, pts: [c], r });
const box = (role: Role, x1: number, y1: number, x2: number, y2: number): Shape => ({
  role,
  pts: [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ],
  closed: true,
});

/** Axe du buste et direction « avant » d'une image. */
function torsoAxes(frame: Frame): { axis: P; front: P } {
  const axis = unit(frame.joints.hip, frame.joints.neck);
  return { axis, front: dir(angleOf(axis) - 90) };
}

/** Point de la colonne, de la hanche (0) à la base du cou (1). */
function spineAt(frame: Frame, t: number): P {
  const last = frame.spine.length - 1;
  const position = Math.max(0, Math.min(last, t * last));
  const index = Math.min(last - 1, Math.floor(position));
  return along(frame.spine[index]!, frame.spine[index + 1]!, position - index);
}

/* ---------------------------------------------------------------- Mise en place des images */

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

function translate(frame: Frame, dx: number, dy: number): Frame {
  const move = (p: P): P => ({ x: p.x + dx, y: p.y + dy });
  const joints = Object.fromEntries(Object.entries(frame.joints).map(([k, p]) => [k, move(p)])) as Frame["joints"];
  return { view: frame.view, spine: frame.spine.map(move), joints };
}

function placed(from: Pose, to: Pose, t: number, pin: JointRef): Frame {
  const frame = frameBetween(from, to, t);
  const raise: Partial<Record<JointRef, number>> = {};
  for (const key of new Set([...Object.keys(from.raise ?? {}), ...Object.keys(to.raise ?? {})]) as Set<JointRef>)
    raise[key] = lerp(from.raise?.[key] ?? 0, to.raise?.[key] ?? 0, t);
  const lift = lerp(from.lift ?? 0, to.lift ?? 0, t);
  const onGround = GROUND - lowest(frame, raise, true) - lift;
  const onBar = BAR_Y - frame.joints.hand0.y;
  const dy = lerp(from.hang ? onBar : onGround, to.hang ? onBar : onGround, t);
  return translate(frame, -frame.joints[pin].x, dy);
}

/* ------------------------------------------------------------------------- Matériel, décor */

function dumbbell(hand: P, elbow: P, axisOverride?: P): Shape[] {
  const u = axisOverride ?? unit(elbow, hand);
  const g = axisOverride ? u : { x: -u.y, y: u.x };
  const across = axisOverride ? { x: -u.y, y: u.x } : u;
  const a = add(hand, g, -4.5);
  const b = add(hand, g, 4.5);
  return [
    line("equip", a, b),
    line("plate", add(a, across, -3), add(a, across, 3)),
    line("plate", add(b, across, -3), add(b, across, 3)),
  ];
}

function kettlebell(c: P): Shape[] {
  return [
    circle("equipFill", add(c, { x: 0, y: 7.5 }), 5.5),
    line(
      "equip",
      add(c, { x: -4, y: 4.5 }),
      add(c, { x: -3, y: -1.5 }),
      add(c, { x: 3, y: -1.5 }),
      add(c, { x: 4, y: 4.5 }),
    ),
  ];
}

function plate(c: P): Shape[] {
  return [circle("equipFill", c, 9), circle("hub", c, 2.2)];
}

function chairAt(x: number, seat: number, backLeft: boolean): Shape[] {
  const backX = backLeft ? x - 8 : x + 8;
  return [
    line("scenery", { x: x - 8, y: seat }, { x: x + 8, y: seat }),
    line("scenery", { x: x - 7, y: seat }, { x: x - 7, y: GROUND }),
    line("scenery", { x: x + 7, y: seat }, { x: x + 7, y: GROUND }),
    line("scenery", { x: backX, y: seat }, { x: backX, y: seat - 22 }),
  ];
}

function benchAt(x1: number, x2: number, top: number): Shape[] {
  return [
    box("scenery", x1, top, x2, top + 3),
    line("scenery", { x: x1 + 3, y: top + 3 }, { x: x1 + 3, y: GROUND }),
    line("scenery", { x: x2 - 3, y: top + 3 }, { x: x2 - 3, y: GROUND }),
  ];
}

function anchor(at: P): Shape[] {
  return [line("scenery", { x: at.x, y: at.y - 6 }, { x: at.x, y: GROUND }), circle("equipFill", at, 2)];
}

function bodyPoints(frames: Frame[]): P[] {
  return frames.flatMap((frame) => [...Object.values(frame.joints), ...frame.spine]);
}

function propShapes(prop: Prop, frames: Frame[], i: number, t: number): Layers {
  const f = frames[i]!;
  const first = frames[0]!;
  const J = f.joints;
  const J0 = first.joints;
  const sideView = f.view === "side";
  const hands = mid(J.hand0, J.hand1);
  const all = bodyPoints(frames);
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const none: Shape[] = [];
  switch (prop) {
    case "dumbbells":
      return sideView
        ? { back: dumbbell(J.hand1, J.elbow1), front: dumbbell(J.hand0, J.elbow0) }
        : { back: none, front: [...dumbbell(J.hand0, J.elbow0), ...dumbbell(J.hand1, J.elbow1)] };
    case "dumbbell":
      return { back: none, front: dumbbell(J.hand0, J.elbow0) };
    case "dumbbellChest":
      return { back: none, front: dumbbell(add(hands, torsoAxes(f).axis, 1), J.elbow0, torsoAxes(f).axis) };
    case "kettlebell":
      return { back: none, front: kettlebell(hands) };
    case "kettlebellHand":
      return { back: none, front: kettlebell(J.hand0) };
    case "barbell":
      return { back: none, front: plate(hands) };
    case "barbellBack": {
      const { front } = torsoAxes(f);
      return { back: none, front: plate(add(spineAt(f, 1), front, -6)) };
    }
    case "bandFeet": {
      const sole = (ankle: P, toe: P) => add(mid(ankle, toe), { x: 0, y: LIMB_R - 0.5 });
      const near = line("band", J.hand0, sole(J.ankle0, J.toe0));
      const far = line("band", J.hand1, sole(J.ankle1, J.toe1));
      return sideView ? { back: [far], front: [near] } : { back: none, front: [near, far] };
    }
    case "bandHigh": {
      const at = { x: J0.hand0.x + 4, y: 6 };
      return { back: [circle("equipFill", at, 2)], front: [line("band", at, hands)] };
    }
    case "bandFront":
    case "bandBack": {
      const x = prop === "bandFront" ? maxX + 12 : minX - 12;
      const at = { x, y: J0.hand0.y };
      return { back: anchor(at), front: [line("band", at, hands)] };
    }
    case "bandSides": {
      const right = { x: maxX + 10, y: J0.hand0.y };
      const left = { x: minX - 10, y: J0.hand1.y };
      return {
        back: [...anchor(right), ...anchor(left)],
        front: [line("band", right, J.hand0), line("band", left, J.hand1)],
      };
    }
    case "bandKnees":
      return sideView
        ? { back: none, front: [circle("band", J.knee0, 4.5)] }
        : {
            back: none,
            front: [
              {
                role: "band",
                pts: [
                  add(J.knee0, { x: 1, y: -2 }),
                  add(J.knee1, { x: -1, y: -2 }),
                  add(J.knee1, { x: -1, y: 2 }),
                  add(J.knee0, { x: 1, y: 2 }),
                ],
                closed: true,
              },
            ],
          };
    case "bandBar":
      return {
        back: none,
        front: [line("band", { x: J0.hand0.x + 3, y: BAR_Y }, J.knee0, { x: J0.hand0.x - 2, y: BAR_Y })],
      };
    case "bar": {
      const x = J0.hand0.x;
      return {
        back: [
          line("equip", { x: x - 24, y: BAR_Y }, { x: x + 24, y: BAR_Y }),
          line("scenery", { x: x - 24, y: BAR_Y }, { x: x - 24, y: BAR_Y - 10 }),
          line("scenery", { x: x + 24, y: BAR_Y }, { x: x + 24, y: BAR_Y - 10 }),
        ],
        front: none,
      };
    }
    case "chair": {
      const seated = frames.reduce((low, frame) => (frame.joints.hip.y > low.joints.hip.y ? frame : low));
      return { back: chairAt(seated.joints.hip.x, seated.joints.hip.y + LIMB_R + 0.5, true), front: none };
    }
    case "chairFoot": {
      const top = Math.max(J0.ankle1.y, J0.toe1.y) + LIMB_R;
      return { back: chairAt(mid(J0.ankle1, J0.toe1).x - 2, top, true), front: none };
    }
    case "chairHands":
      return { back: chairAt(J0.hand0.x - 6, J0.hand0.y + LIMB_R, true), front: none };
    case "benchSupport": {
      const top = Math.max(J0.knee1.y, J0.hand1.y) + LIMB_R;
      return {
        back: benchAt(Math.min(J0.knee1.x, J0.hand1.x) - 6, Math.max(J0.knee1.x, J0.hand1.x) + 6, top),
        front: none,
      };
    }
    case "table": {
      const top = J0.hand0.y + LIMB_R;
      return { back: benchAt(J0.hand0.x - 6, J0.hand0.x + 16, top), front: none };
    }
    case "bench": {
      const top = Math.max(...first.spine.map((p) => p.y)) + TORSO_R;
      const xs = first.spine.map((p) => p.x);
      return { back: benchAt(Math.min(...xs) - 4, Math.max(...xs) + 6, top), front: none };
    }
    case "benchFeet": {
      const top = Math.max(J0.ankle0.y, J0.toe0.y) + LIMB_R;
      return { back: benchAt(J0.ankle0.x - 10, J0.toe0.x + 6, top), front: none };
    }
    case "step": {
      const top = Math.max(J0.ankle0.y, J0.toe0.y) + LIMB_R;
      const x = mid(J0.ankle0, J0.toe0).x;
      return { back: [box("scenery", x - 13, top, x + 13, GROUND)], front: none };
    }
    case "wallFront": {
      const x = Math.max(...frames.flatMap((frame) => [frame.joints.hand0.x, frame.joints.hand1.x])) + LIMB_R + 1.5;
      return { back: [line("scenery", { x, y: 24 }, { x, y: GROUND })], front: none };
    }
    case "wallBack": {
      const x =
        Math.min(
          ...frames.flatMap((frame) => [
            ...frame.spine.map((p) => p.x - TORSO_R),
            frame.joints.head.x - LEN.head,
            frame.joints.elbow0.x - LIMB_R,
            frame.joints.elbow1.x - LIMB_R,
            frame.joints.hand0.x - LIMB_R,
          ]),
        ) - 1.5;
      return { back: [line("scenery", { x, y: 24 }, { x, y: GROUND })], front: none };
    }
    case "mat":
      return { back: [box("mat", minX - 6, GROUND - 2.5, maxX + 6, GROUND)], front: none };
    case "legPress": {
      const { axis, front } = torsoAxes(first);
      const back = { x: -front.x, y: -front.y };
      const seatHip = add(J0.hip, back, 7);
      const legDir = unit(J.hip, J.ankle0);
      const foot = add(mid(J.ankle0, J.toe0), legDir, 3);
      const across = { x: -legDir.y, y: legDir.x };
      return {
        back: [
          line("scenery", add(seatHip, axis, -4), add(add(J0.neck, back, 7), axis, 2)),
          line("scenery", seatHip, { x: seatHip.x, y: GROUND }),
          line("scenery", { x: seatHip.x - 8, y: GROUND }, { x: seatHip.x + 30, y: GROUND }),
        ],
        front: [line("plate", add(foot, across, -10), add(foot, across, 10))],
      };
    }
    case "legCurl": {
      const xs = first.spine.map((p) => p.x);
      const top = Math.max(...first.spine.map((p) => p.y)) + TORSO_R;
      const { front } = torsoAxes(f);
      const pad = add(along(J.knee0, J.ankle0, 0.85), front, -5);
      return {
        back: benchAt(Math.min(J0.knee0.x, J0.knee1.x) - 2, Math.max(...xs) + 4, top),
        front: [line("equip", J.knee0, pad), circle("equipFill", pad, 3.2)],
      };
    }
    case "pulldown": {
      const seat = J0.hip.y + LIMB_R + 0.5;
      const pulley = { x: J0.hand0.x, y: 4 };
      return {
        back: [
          line("scenery", { x: J0.hip.x - 8, y: seat }, { x: J0.hip.x + 8, y: seat }),
          line("scenery", { x: J0.hip.x, y: seat }, { x: J0.hip.x, y: GROUND }),
          line("scenery", add(J0.knee0, { x: -2, y: -6 }), add(J0.knee0, { x: 5, y: -6 })),
          circle("equipFill", pulley, 2.2),
        ],
        front: [
          line("equipThin", pulley, hands),
          line("equip", add(hands, { x: -7, y: 0 }), add(hands, { x: 7, y: 0 })),
        ],
      };
    }
    case "cableRow": {
      const seat = J0.hip.y + LIMB_R + 0.5;
      const pulley = { x: Math.max(J0.toe0.x, J0.toe1.x) + 12, y: J0.hand0.y };
      return {
        back: [
          line("scenery", { x: J0.hip.x - 8, y: seat }, { x: J0.hip.x + 8, y: seat }),
          line("scenery", { x: J0.hip.x, y: seat }, { x: J0.hip.x, y: GROUND }),
          line("scenery", add(J0.toe0, { x: 3, y: -10 }), add(J0.toe0, { x: 3, y: 3 })),
          ...anchor(pulley),
        ],
        front: [line("equipThin", pulley, hands)],
      };
    }
    case "chestPress": {
      const seated = frames.reduce((low, frame) => (frame.joints.hip.y > low.joints.hip.y ? frame : low));
      // Bras de levier venant de derrière le dossier, poignée verticale dans la main.
      const pivot = { x: seated.joints.hip.x - 10, y: J0.neck.y + 4 };
      return {
        back: [
          ...chairAt(seated.joints.hip.x, seated.joints.hip.y + LIMB_R + 0.5, true),
          circle("equipFill", pivot, 2),
          line("equip", pivot, J.hand0),
        ],
        front: [line("equip", add(J.hand0, { x: 0, y: -5 }), add(J.hand0, { x: 0, y: 5 }))],
      };
    }
    case "rope": {
      const top = J.head.y - LEN.head;
      const apex = { x: J.hip.x, y: lerp(GROUND - 0.5, top - 10, t) };
      const control = { x: 2 * apex.x - (J.hand0.x + J.hand1.x) / 2, y: 2 * apex.y - (J.hand0.y + J.hand1.y) / 2 };
      const pts = Array.from({ length: 13 }, (_, k) => {
        const s = k / 12;
        return {
          x: (1 - s) ** 2 * J.hand1.x + 2 * (1 - s) * s * control.x + s * s * J.hand0.x,
          y: (1 - s) ** 2 * J.hand1.y + 2 * (1 - s) * s * control.y + s * s * J.hand0.y,
        };
      });
      return { back: none, front: [{ role: "equipThin", pts }] };
    }
  }
}

/* ------------------------------------------------------------------- Zone travaillée */

function heart(c: P, size: number): Shape {
  const pts = Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * 2 * Math.PI;
    return {
      x: c.x + (size / 16) * 16 * Math.sin(a) ** 3,
      y: c.y - (size / 16) * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)),
    };
  });
  return { role: "accentFill", pts, closed: true };
}

/** Zone travaillée : sur le buste (dessinée sous les membres proches) ou sur les membres. */
function highlight(muscle: Muscle, f: Frame): Layers {
  const J = f.joints;
  const { front } = torsoAxes(f);
  const sideView = f.view === "side";
  const across = (t: number, half: number): Shape => {
    const c = spineAt(f, t);
    return line("accentThin", add(c, front, -half), add(c, front, half));
  };
  const none: Shape[] = [];
  switch (muscle) {
    case "chest":
      return {
        back: sideView
          ? [line("accentThin", add(spineAt(f, 0.6), front, 2.5), add(spineAt(f, 0.92), front, 2.5))]
          : [across(0.8, 4.5)],
        front: none,
      };
    case "back":
      return {
        back: sideView
          ? [line("accentThin", add(spineAt(f, 0.42), front, -2.5), add(spineAt(f, 0.92), front, -2.5))]
          : [across(0.8, 4.5), across(0.6, 3.5)],
        front: none,
      };
    case "core":
      return {
        back: sideView
          ? [line("accentThin", add(spineAt(f, 0.12), front, 1), add(spineAt(f, 0.5), front, 1))]
          : [line("accentThin", spineAt(f, 0.15), spineAt(f, 0.5))],
        front: none,
      };
    case "cardio":
      return { back: [heart(add(spineAt(f, 0.72), front, sideView ? 1 : 0), 3.2)], front: none };
    case "glutes": {
      const glute = (hip: P, knee: P) => line("accent", hip, along(hip, knee, 0.42));
      return {
        back: none,
        front: sideView ? [glute(J.hip0, J.knee0)] : [glute(J.hip0, J.knee0), glute(J.hip1, J.knee1)],
      };
    }
    case "legs": {
      const leg = (hip: P, knee: P, ankle: P) => line("accent", along(hip, knee, 0.2), knee, ankle);
      return {
        back: none,
        front: sideView
          ? [leg(J.hip0, J.knee0, J.ankle0)]
          : [leg(J.hip0, J.knee0, J.ankle0), leg(J.hip1, J.knee1, J.ankle1)],
      };
    }
    case "shoulders": {
      const cap = (s: P, e: P) => line("accent", s, along(s, e, 0.45));
      return {
        back: none,
        front: sideView ? [cap(J.shoulder0, J.elbow0)] : [cap(J.shoulder0, J.elbow0), cap(J.shoulder1, J.elbow1)],
      };
    }
    case "arms": {
      const arm = (s: P, e: P, h: P) => line("accent", along(s, e, 0.25), e, h);
      return {
        back: none,
        front: sideView
          ? [arm(J.shoulder0, J.elbow0, J.hand0)]
          : [arm(J.shoulder0, J.elbow0, J.hand0), arm(J.shoulder1, J.elbow1, J.hand1)],
      };
    }
    default:
      return { back: none, front: none };
  }
}

/* ------------------------------------------------------------------------- Silhouette */

/** Liseré couleur de fond sous un membre proche, pour le détacher du buste ou de l'autre membre. */
function halo(limb: Shape): Shape {
  const [root, joint, ...rest] = limb.pts;
  return line("halo", along(root!, joint!, 0.35), joint!, ...rest);
}

function body(f: Frame): { far: Shape[]; trunk: Shape[]; near: Shape[] } {
  const J = f.joints;
  const leg0 = line("limb", J.hip0, J.knee0, J.ankle0, J.toe0);
  const arm0 = line("limb", J.shoulder0, J.elbow0, J.hand0);
  const arm1 = line("limb", J.shoulder1, J.elbow1, J.hand1);
  const head = circle("head", J.head, LEN.head);
  if (f.view === "side") {
    return {
      far: [line("limbFar", J.hip1, J.knee1, J.ankle1, J.toe1), line("limbFar", J.shoulder1, J.elbow1, J.hand1)],
      trunk: [{ role: "torso", pts: f.spine }, head],
      near: [halo(leg0), leg0, halo(arm0), arm0],
    };
  }
  return {
    far: [leg0, line("limb", J.hip1, J.knee1, J.ankle1, J.toe1)],
    trunk: [{ role: "torsoFront", pts: [J.shoulder0, J.shoulder1, J.hip1, J.hip0], closed: true }, head],
    near: [halo(arm0), arm0, halo(arm1), arm1],
  };
}

function shapePoints(shape: Shape): P[] {
  if (shape.r === undefined) return shape.pts;
  const c = shape.pts[0]!;
  return [
    { x: c.x - shape.r, y: c.y - shape.r },
    { x: c.x + shape.r, y: c.y + shape.r },
  ];
}

/** Toutes les images d'un mouvement, prêtes à dessiner. */
export function buildScene(motion: Motion, muscle: Muscle, samples = SAMPLES): Scene {
  const from = POSES[motion.from];
  const to = POSES[motion.to];
  const pin = motion.pin ?? "ankle0";
  const ts = Array.from({ length: samples }, (_, k) => easeInOut(k / (samples - 1)));
  const frames = ts.map((t) => placed(from, to, t, pin));
  const hanging = Boolean(from.hang || to.hang);
  const scenes = frames.map((frame, i) => {
    const props = (motion.props ?? []).map((prop) => propShapes(prop, frames, i, ts[i]!));
    const mark = highlight(muscle, frame);
    const parts = body(frame);
    return [
      ...props.flatMap((layer) => layer.back),
      ...parts.far,
      ...parts.trunk,
      ...mark.back,
      ...parts.near,
      ...mark.front,
      ...props.flatMap((layer) => layer.front),
    ];
  });
  // Échelle et centrage communs à toutes les images : le mouvement ne « glisse » pas et la
  // silhouette occupe au mieux la vignette (le sol reste à sa place).
  const pts = scenes.flatMap((shapes) => shapes.flatMap(shapePoints));
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const room = VIEWBOX - 2 * MARGIN;
  const scale = Math.min(
    MAX_SCALE,
    room / (maxX - minX),
    hanging ? room / (maxY - minY) : (GROUND - MARGIN) / (GROUND - minY),
  );
  const cx = (minX + maxX) / 2;
  const cy = hanging ? (minY + maxY) / 2 : GROUND;
  const ty = hanging ? VIEWBOX / 2 : GROUND;
  const fit = (p: P): P => ({ x: VIEWBOX / 2 + (p.x - cx) * scale, y: ty + (p.y - cy) * scale });
  const ground: Shape[] = hanging ? [] : [line("ground", { x: 6, y: GROUND }, { x: VIEWBOX - 6, y: GROUND })];
  return {
    view: from.view,
    frames: scenes.map((shapes) => [
      ...ground,
      ...shapes.map((shape) => ({
        ...shape,
        pts: shape.pts.map(fit),
        ...(shape.r === undefined ? {} : { r: shape.r * scale }),
      })),
    ]),
  };
}

export function exerciseScene(exerciseId: string, muscle: Muscle, samples = SAMPLES): Scene {
  return buildScene(motionFor(exerciseId, muscle), muscle, samples);
}

/** Boîte englobante d'une forme (pour les tests et le contrôle visuel). */
export function shapeBounds(shape: Shape): { minX: number; maxX: number; minY: number; maxY: number } {
  const pts = shapePoints(shape);
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

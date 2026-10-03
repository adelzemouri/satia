/**
 * Illustrations d'exercices, partie « squelette » (calcul pur, sans dépendance au rendu).
 *
 * Une silhouette articulée (tête, buste, bras et jambes en deux segments, pieds) est décrite
 * par des angles absolus, en degrés : 0 = vers le bas, 90 = vers l'avant (la droite de
 * l'image), 180 = vers le haut, -90 = vers l'arrière. En vue de face, 90 désigne la droite
 * de l'image. Un bras peut aussi « attraper » un point (une articulation, le sol) : l'angle
 * du coude est alors calculé (cinématique inverse à deux segments).
 */

import type { Muscle } from "./types";

export type P = { x: number; y: number };
export type View = "side" | "front";

export type JointRef =
  | "head"
  | "neck"
  | "hip"
  | "hip0"
  | "hip1"
  | "shoulder0"
  | "shoulder1"
  | "elbow0"
  | "elbow1"
  | "hand0"
  | "hand1"
  | "knee0"
  | "knee1"
  | "ankle0"
  | "ankle1"
  | "toe0"
  | "toe1";

/** Main posée sur une articulation : décalage le long du buste (vers la tête) et vers l'avant. */
export type ReachJoint = {
  readonly to: JointRef;
  readonly along?: number;
  readonly out?: number;
  readonly bend?: 1 | -1;
};
/** Main posée au sol, décalée horizontalement depuis l'épaule (et éventuellement surélevée). */
export type ReachFloor = { readonly floor: number; readonly up?: number; readonly bend?: 1 | -1 };
/** Bras : [haut du bras, avant-bras] en angles absolus, ou une prise. */
export type Arm = readonly [number, number] | ReachJoint | ReachFloor;
/** Jambe : [cuisse, tibia, pied] ; le pied pointe vers l'avant par défaut. */
export type Leg = readonly [number, number] | readonly [number, number, number];

export type Pose = {
  readonly view: View;
  /** Direction de la hanche vers les épaules. */
  readonly torso: number;
  /** Dos arrondi (> 0) ou creusé (< 0). */
  readonly curve?: number;
  /** Direction du cou vers la tête (par défaut, celle du buste). */
  readonly head?: number;
  /** Indice 0 : bras/jambe proche (profil) ou à droite de l'image (face). */
  readonly arms: readonly [Arm, Arm];
  readonly legs: readonly [Leg, Leg];
  /** Suspendu par les mains à la barre au lieu d'être posé au sol. */
  readonly hang?: boolean;
  /** Saut : hauteur au-dessus du sol. */
  readonly lift?: number;
  /** Articulations posées sur un support (chaise, marche) : hauteur du support. */
  readonly raise?: Partial<Record<JointRef, number>>;
};

export type Frame = { view: View; spine: P[]; joints: Record<JointRef, P> };

export const LEN = { torso: 26, upper: 13, fore: 12, thigh: 19, shin: 18, head: 6.5 } as const;
/** Demi-épaisseur des membres (pour poser la silhouette au sol). */
export const LIMB_R = 3.25;
/** Demi-épaisseur du buste vu de profil. */
export const TORSO_R = 5.5;
const NECK = { side: 13, front: 11 } as const;
const HALF = { side: { shoulder: 0, hip: 0 }, front: { shoulder: 7, hip: 4.5 } } as const;
const FOOT = { side: 6, front: 4 } as const;

const RAD = Math.PI / 180;
export function dir(angle: number): P {
  return { x: Math.sin(angle * RAD), y: Math.cos(angle * RAD) };
}
export function add(a: P, b: P, k = 1): P {
  return { x: a.x + b.x * k, y: a.y + b.y * k };
}
export function angleOf(v: P): number {
  return Math.atan2(v.x, v.y) / RAD;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function isAngles(arm: Arm): arm is readonly [number, number] {
  return Array.isArray(arm);
}

/** Point le plus bas de la silhouette (hors bras), en tenant compte des supports. */
export function lowest(frame: Frame, raise: Partial<Record<JointRef, number>>, withArms: boolean): number {
  const skip = withArms ? [] : ["elbow0", "elbow1", "hand0", "hand1"];
  let bottom = -Infinity;
  for (const [name, point] of Object.entries(frame.joints) as [JointRef, P][]) {
    if (skip.includes(name) || name === "neck") continue;
    const radius = name === "head" ? LEN.head : LIMB_R;
    bottom = Math.max(bottom, point.y + radius + (raise[name] ?? 0));
  }
  const radius = frame.view === "side" ? TORSO_R : LIMB_R;
  for (const point of frame.spine) bottom = Math.max(bottom, point.y + radius);
  return bottom;
}

type Resolved = {
  view: View;
  torso: number;
  curve: number;
  head: number;
  arms: [Arm, Arm];
  legs: [[number, number, number], [number, number, number]];
  raise: Partial<Record<JointRef, number>>;
};

function footOf(view: View, leg: Leg, index: number): number {
  if (leg.length === 3) return leg[2];
  return view === "side" ? 90 : index === 0 ? 90 : -90;
}

function resolve(pose: Pose): Resolved {
  return {
    view: pose.view,
    torso: pose.torso,
    curve: pose.curve ?? 0,
    head: pose.head ?? pose.torso,
    arms: [pose.arms[0], pose.arms[1]],
    legs: [
      [pose.legs[0][0], pose.legs[0][1], footOf(pose.view, pose.legs[0], 0)],
      [pose.legs[1][0], pose.legs[1][1], footOf(pose.view, pose.legs[1], 1)],
    ],
    raise: pose.raise ?? {},
  };
}

/** Coude par cinématique inverse : épaule s, cible t, flexion du côté `bend`. */
function reachArm(s: P, target: P, bend: 1 | -1): [P, P] {
  const v = { x: target.x - s.x, y: target.y - s.y };
  const span = Math.hypot(v.x, v.y);
  const a = LEN.upper;
  const b = LEN.fore;
  const d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, span));
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const opening = Math.acos(Math.max(-1, Math.min(1, cos))) / RAD;
  const elbow = add(s, dir(angleOf(v) + bend * opening), a);
  const toTarget = { x: target.x - elbow.x, y: target.y - elbow.y };
  const length = Math.hypot(toTarget.x, toTarget.y) || 1;
  const hand = add(elbow, { x: toTarget.x / length, y: toTarget.y / length }, b);
  return [elbow, hand];
}

/** Position des articulations, hanche à l'origine. */
function build(r: Resolved): Frame {
  const hip: P = { x: 0, y: 0 };
  const axis = dir(r.torso);
  const front = dir(r.torso - 90);
  const neck = add(hip, axis, LEN.torso);
  const control = add(add(hip, axis, LEN.torso / 2), front, -2 * r.curve);
  const spine = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    x: (1 - t) ** 2 * hip.x + 2 * (1 - t) * t * control.x + t * t * neck.x,
    y: (1 - t) ** 2 * hip.y + 2 * (1 - t) * t * control.y + t * t * neck.y,
  }));
  const half = HALF[r.view];
  const head = add(neck, dir(r.head), NECK[r.view]);
  const shoulders = [add(neck, front, half.shoulder), add(neck, front, -half.shoulder)] as const;
  const hips = [add(hip, front, half.hip), add(hip, front, -half.hip)] as const;
  const legs = r.legs.map(([thigh, shin, foot], i) => {
    const knee = add(hips[i]!, dir(thigh), LEN.thigh);
    const ankle = add(knee, dir(shin), LEN.shin);
    return { knee, ankle, toe: add(ankle, dir(foot), FOOT[r.view]) };
  });
  const joints: Record<JointRef, P> = {
    head,
    neck,
    hip,
    hip0: hips[0],
    hip1: hips[1],
    shoulder0: shoulders[0],
    shoulder1: shoulders[1],
    elbow0: neck,
    elbow1: neck,
    hand0: neck,
    hand1: neck,
    knee0: legs[0]!.knee,
    knee1: legs[1]!.knee,
    ankle0: legs[0]!.ankle,
    ankle1: legs[1]!.ankle,
    toe0: legs[0]!.toe,
    toe1: legs[1]!.toe,
  };
  const partial: Frame = { view: r.view, spine, joints };
  const floor = lowest(partial, r.raise, false);
  r.arms.forEach((arm, i) => {
    const s = shoulders[i]!;
    const elbowKey = i === 0 ? "elbow0" : "elbow1";
    const handKey = i === 0 ? "hand0" : "hand1";
    if (isAngles(arm)) {
      joints[elbowKey] = add(s, dir(arm[0]), LEN.upper);
      joints[handKey] = add(joints[elbowKey], dir(arm[1]), LEN.fore);
      return;
    }
    let target: P;
    if ("floor" in arm) {
      target = { x: s.x + arm.floor, y: floor - LIMB_R - (r.raise[handKey] ?? 0) - (arm.up ?? 0) };
    } else {
      target = add(add(joints[arm.to], axis, arm.along ?? 0), front, arm.out ?? 0);
    }
    const [elbow, hand] = reachArm(s, target, arm.bend ?? -1);
    joints[elbowKey] = elbow;
    joints[handKey] = hand;
  });
  return partial;
}

/** Angle b ramené au plus près de a (pour interpoler sans faire un tour complet). */
function near(a: number, b: number): number {
  let value = b;
  while (value - a > 180) value -= 360;
  while (value - a < -180) value += 360;
  return value;
}

function sameReach(a: Arm, b: Arm): boolean {
  if (isAngles(a) || isAngles(b)) return false;
  if ("floor" in a) return "floor" in b;
  return !("floor" in b) && a.to === b.to;
}

function armAngles(frame: Frame, i: 0 | 1): [number, number] {
  const s = frame.joints[i === 0 ? "shoulder0" : "shoulder1"];
  const e = frame.joints[i === 0 ? "elbow0" : "elbow1"];
  const h = frame.joints[i === 0 ? "hand0" : "hand1"];
  return [angleOf({ x: e.x - s.x, y: e.y - s.y }), angleOf({ x: h.x - e.x, y: h.y - e.y })];
}

function lerpArm(a: Arm, b: Arm, t: number, fa: Frame, fb: Frame, i: 0 | 1): Arm {
  if (isAngles(a) && isAngles(b)) return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  if (!isAngles(a) && !isAngles(b) && sameReach(a, b)) {
    const bend = t < 0.5 ? a.bend : b.bend;
    if ("floor" in a && "floor" in b)
      return { floor: lerp(a.floor, b.floor, t), up: lerp(a.up ?? 0, b.up ?? 0, t), bend };
    if ("to" in a && "to" in b)
      return { to: a.to, along: lerp(a.along ?? 0, b.along ?? 0, t), out: lerp(a.out ?? 0, b.out ?? 0, t), bend };
  }
  const [a0, a1] = isAngles(a) ? a : armAngles(fa, i);
  const [b0, b1] = isAngles(b) ? b : armAngles(fb, i);
  return [lerp(a0, near(a0, b0), t), lerp(a1, near(a1, b1), t)];
}

/** Silhouette intermédiaire entre deux poses (t de 0 à 1), hanche à l'origine. */
export function frameBetween(from: Pose, to: Pose, t: number): Frame {
  const a = resolve(from);
  const b = resolve(to);
  if (t <= 0) return build(a);
  if (t >= 1) return build(b);
  const fa = build(a);
  const fb = build(b);
  const raise: Partial<Record<JointRef, number>> = {};
  for (const key of new Set([...Object.keys(a.raise), ...Object.keys(b.raise)]) as Set<JointRef>)
    raise[key] = lerp(a.raise[key] ?? 0, b.raise[key] ?? 0, t);
  const leg = (i: 0 | 1): [number, number, number] => [
    lerp(a.legs[i][0], b.legs[i][0], t),
    lerp(a.legs[i][1], b.legs[i][1], t),
    lerp(a.legs[i][2], b.legs[i][2], t),
  ];
  return build({
    view: a.view,
    torso: lerp(a.torso, b.torso, t),
    curve: lerp(a.curve, b.curve, t),
    head: lerp(a.head, b.head, t),
    arms: [lerpArm(a.arms[0], b.arms[0], t, fa, fb, 0), lerpArm(a.arms[1], b.arms[1], t, fa, fb, 1)],
    legs: [leg(0), leg(1)],
    raise,
  });
}

export function poseFrame(pose: Pose): Frame {
  return build(resolve(pose));
}

/* ------------------------------------------------------------------------------------------ */
/* Bibliothèque de poses                                                                       */
/* ------------------------------------------------------------------------------------------ */

type Draft = Omit<Pose, "view" | "arms" | "legs"> & Partial<Pick<Pose, "arms" | "legs">>;
const ARMS_DOWN: Pose["arms"] = [
  [6, 10],
  [-6, 2],
];
const LEGS_STAND: Pose["legs"] = [
  [3, 0],
  [-3, 0],
];
const FRONT_ARMS: Pose["arms"] = [
  [10, 4],
  [-10, -4],
];
const FRONT_LEGS: Pose["legs"] = [
  [3, 0],
  [-3, 0],
];
function side(draft: Draft): Pose {
  return { view: "side", arms: ARMS_DOWN, legs: LEGS_STAND, ...draft };
}
function front(draft: Draft): Pose {
  return { view: "front", arms: FRONT_ARMS, legs: FRONT_LEGS, ...draft };
}

const hipsHold = (bend: 1 | -1 = -1): ReachJoint => ({ to: "hip", along: 3, out: 3, bend });
const chestHold: Pose["arms"] = [
  [18, 165],
  [12, 165],
];
const shoulderHold: Pose["arms"] = [
  [22, 172],
  [16, 172],
];
const armsUp: Pose["arms"] = [
  [174, 178],
  [168, 174],
];
const armsForward: Pose["arms"] = [
  [92, 92],
  [86, 88],
];
const onFloor: Pose["arms"] = [{ floor: 0 }, { floor: 0 }];
/* Allongé sur le dos, tête à gauche, genoux pliés et pieds au sol. */
const KNEES_BENT: Pose["legs"] = [
  [140, 30],
  [134, 30],
];
const ALONG_BODY: Pose["arms"] = [
  [90, 90],
  [92, 92],
];
/* Quatre pattes : genoux au sol sous les hanches, mains sous les épaules. */
const QUAD_LEGS: Pose["legs"] = [
  [0, -90, -90],
  [3, -90, -90],
];
const SEATED_LEGS: Pose["legs"] = [
  [88, 2],
  [85, 2],
];
const plankLegs = (torso: number): Pose["legs"] => [
  [torso - 180, torso - 180, 18],
  [torso - 182, torso - 182, 18],
];

export const POSES = {
  // Debout, de profil
  stand: side({ torso: 180 }),
  standArmsForward: side({ torso: 180, arms: armsForward }),
  standArmsUp: side({ torso: 180, arms: armsUp }),
  standHandsHips: side({ torso: 180, arms: [hipsHold(), hipsHold()] }),
  standChest: side({ torso: 180, arms: chestHold }),
  standShoulders: side({ torso: 180, arms: shoulderHold }),
  standArmsStraight: side({
    torso: 180,
    arms: [
      [2, 0],
      [-2, 0],
    ],
  }),
  standCurl: side({
    torso: 180,
    arms: [
      [4, 160],
      [-2, 156],
    ],
  }),
  standFacePull: side({
    torso: 180,
    arms: [
      [-95, 160],
      [-88, 160],
    ],
  }),
  standPushdownUp: side({
    torso: 180,
    arms: [
      [8, 115],
      [2, 115],
    ],
  }),
  standPushdownDown: side({
    torso: 180,
    arms: [
      [8, 8],
      [2, 2],
    ],
  }),
  standPressOut: side({
    torso: 180,
    arms: [
      [88, 90],
      [86, 90],
    ],
  }),
  standOpenArms: side({
    torso: 180,
    arms: [
      [60, 75],
      [-60, -75],
    ],
  }),
  standRack: side({
    torso: 180,
    arms: [
      [14, 168],
      [-4, 4],
    ],
  }),
  standChestStretch: side({
    torso: 180,
    arms: [
      [-82, 172],
      [6, 4],
    ],
  }),
  standChestStretchDeep: side({
    torso: 175,
    arms: [
      [-98, 182],
      [8, 6],
    ],
  }),
  calfDown: side({
    torso: 180,
    arms: [
      { to: "neck", along: -3, out: 20 },
      { to: "neck", along: -3, out: 19 },
    ],
  }),
  calfUp: side({
    torso: 180,
    arms: [
      { to: "neck", along: -3, out: 20 },
      { to: "neck", along: -3, out: 19 },
    ],
    legs: [
      [3, 0, 28],
      [-3, 0, 28],
    ],
  }),
  calfStretch: side({
    torso: 165,
    arms: [
      { to: "neck", along: -2, out: 21 },
      { to: "neck", along: -2, out: 20 },
    ],
    legs: [
      [30, -6],
      [-26, -26],
    ],
  }),
  calfStretchDeep: side({
    torso: 158,
    arms: [
      { to: "neck", along: -2, out: 16 },
      { to: "neck", along: -2, out: 15 },
    ],
    legs: [
      [38, -10],
      [-30, -30],
    ],
  }),
  quadStretchStart: side({
    torso: 180,
    arms: [
      { to: "ankle0", bend: 1 },
      { to: "neck", along: -3, out: 20 },
    ],
    legs: [
      [4, -120, -60],
      [0, 0],
    ],
  }),
  quadStretch: side({
    torso: 180,
    arms: [
      { to: "ankle0", bend: 1 },
      { to: "neck", along: -3, out: 20 },
    ],
    legs: [
      [0, -168, -110],
      [0, 0],
    ],
  }),
  ankleA: side({
    torso: 180,
    arms: [
      [40, 120],
      [34, 120],
    ],
    legs: [
      [28, 10, 40],
      [0, 0],
    ],
  }),
  ankleB: side({
    torso: 180,
    arms: [
      [40, 140],
      [34, 140],
    ],
    legs: [
      [28, 10, 140],
      [0, 0],
    ],
  }),
  legSwingFront: side({
    torso: 180,
    arms: [
      [60, 75],
      [-40, -30],
    ],
    legs: [
      [50, 50, 120],
      [0, 0],
    ],
  }),
  legSwingBack: side({
    torso: 182,
    arms: [
      [60, 75],
      [-40, -30],
    ],
    legs: [
      [-30, -30, 60],
      [0, 0],
    ],
  }),
  // Marche, course, montées de genoux
  marchA: side({
    torso: 180,
    arms: [
      [-30, 10],
      [35, 80],
    ],
    legs: [
      [80, 0],
      [-3, 0],
    ],
  }),
  marchB: side({
    torso: 180,
    arms: [
      [35, 80],
      [-30, 10],
    ],
    legs: [
      [-3, 0],
      [80, 0],
    ],
  }),
  kneesA: side({
    torso: 178,
    lift: 4,
    arms: [
      [-40, 50],
      [45, 150],
    ],
    legs: [
      [96, 4, 110],
      [-4, -2, 40],
    ],
  }),
  kneesB: side({
    torso: 178,
    lift: 4,
    arms: [
      [45, 150],
      [-40, 50],
    ],
    legs: [
      [-4, -2, 40],
      [96, 4, 110],
    ],
  }),
  heelsA: side({
    torso: 176,
    lift: 3,
    arms: [
      [-25, 70],
      [25, 125],
    ],
    legs: [
      [-6, -145, -70],
      [3, 0, 40],
    ],
  }),
  heelsB: side({
    torso: 176,
    lift: 3,
    arms: [
      [25, 125],
      [-25, 70],
    ],
    legs: [
      [3, 0, 40],
      [-6, -145, -70],
    ],
  }),
  walkA: side({
    torso: 178,
    arms: [
      [-22, 20],
      [24, 70],
    ],
    legs: [
      [22, 10, 110],
      [-20, -24, 50],
    ],
  }),
  walkB: side({
    torso: 178,
    arms: [
      [24, 70],
      [-22, 20],
    ],
    legs: [
      [-20, -24, 50],
      [22, 10, 110],
    ],
  }),
  runA: side({
    torso: 168,
    lift: 6,
    arms: [
      [-40, 50],
      [40, 135],
    ],
    legs: [
      [50, -6, 100],
      [-28, -95, -30],
    ],
  }),
  runB: side({
    torso: 168,
    lift: 6,
    arms: [
      [40, 135],
      [-40, 50],
    ],
    legs: [
      [-28, -95, -30],
      [50, -6, 100],
    ],
  }),
  guard: side({
    torso: 176,
    arms: [
      [28, 158],
      [18, 162],
    ],
    legs: [
      [16, 2],
      [-14, -6, 70],
    ],
  }),
  punch: side({
    torso: 172,
    arms: [
      [94, 92],
      [18, 162],
    ],
    legs: [
      [16, 2],
      [-14, -6, 70],
    ],
  }),
  // Squats
  squatHalf: side({
    torso: 160,
    arms: armsForward,
    legs: [
      [55, -22],
      [52, -22],
    ],
  }),
  squatDeep: side({
    torso: 142,
    arms: [
      [100, 100],
      [95, 96],
    ],
    legs: [
      [88, -24],
      [85, -24],
    ],
  }),
  squatDeepArmsBack: side({
    torso: 140,
    arms: [
      [-35, -25],
      [-30, -20],
    ],
    legs: [
      [88, -24],
      [85, -24],
    ],
  }),
  squatChest: side({
    torso: 145,
    arms: [
      { to: "neck", along: -7, out: 10, bend: 1 },
      { to: "neck", along: -7, out: 9, bend: 1 },
    ],
    legs: [
      [88, -24],
      [85, -24],
    ],
  }),
  standChestHold: side({
    torso: 180,
    arms: [
      { to: "neck", along: -7, out: 10, bend: 1 },
      { to: "neck", along: -7, out: 9, bend: 1 },
    ],
  }),
  squatShoulders: side({
    torso: 145,
    arms: [
      [40, 170],
      [34, 170],
    ],
    legs: [
      [88, -24],
      [85, -24],
    ],
  }),
  standBarBack: side({
    torso: 180,
    arms: [
      { to: "neck", along: -1, out: -6 },
      { to: "neck", along: -1, out: -6 },
    ],
  }),
  squatBarBack: side({
    torso: 140,
    arms: [
      { to: "neck", along: -1, out: -6 },
      { to: "neck", along: -1, out: -6 },
    ],
    legs: [
      [88, -24],
      [85, -24],
    ],
  }),
  jumpArmsUp: side({
    torso: 178,
    lift: 8,
    arms: [
      [150, 162],
      [140, 155],
    ],
    legs: [
      [6, -4, 30],
      [0, -6, 30],
    ],
  }),
  sitChair: side({
    torso: 174,
    arms: [
      [30, 80],
      [25, 80],
    ],
    legs: SEATED_LEGS,
  }),
  sitStandUp: side({
    torso: 180,
    arms: [
      [30, 80],
      [25, 80],
    ],
  }),
  wallSitHigh: side({
    torso: 180,
    arms: [
      [12, 115],
      [6, 115],
    ],
    legs: [
      [45, 17],
      [42, 19],
    ],
  }),
  wallSit: side({
    torso: 180,
    arms: [
      [12, 115],
      [6, 115],
    ],
    legs: [
      [90, 0],
      [87, 0],
    ],
  }),
  // Fentes (jambe proche devant)
  lungeHands: side({
    torso: 180,
    arms: [hipsHold(), hipsHold()],
    legs: [
      [86, -4],
      [-12, -98, 12],
    ],
  }),
  lungeArmsDown: side({
    torso: 180,
    arms: [
      [2, 0],
      [-2, 0],
    ],
    legs: [
      [86, -4],
      [-12, -98, 12],
    ],
  }),
  lungeArmsForward: side({
    torso: 180,
    arms: armsForward,
    legs: [
      [86, -4],
      [-12, -98, 12],
    ],
  }),
  lungeTwist: side({
    torso: 180,
    arms: [
      [60, 50],
      [120, 135],
    ],
    legs: [
      [86, -4],
      [-12, -98, 12],
    ],
  }),
  lungeJump: side({
    torso: 178,
    lift: 12,
    arms: [
      [-35, 40],
      [35, 125],
    ],
    legs: [
      [55, -12, 80],
      [-22, -80, -10],
    ],
  }),
  halfKneel: side({
    torso: 180,
    arms: [
      { to: "knee0", along: 4, out: -1 },
      { to: "knee0", along: 4, out: -2 },
    ],
    legs: [
      [88, -6],
      [-10, -92, -90],
    ],
  }),
  halfKneelForward: side({
    torso: 182,
    arms: [
      { to: "knee0", along: 4, out: -1 },
      { to: "knee0", along: 4, out: -2 },
    ],
    legs: [
      [100, -16],
      [-24, -96, -90],
    ],
  }),
  stepUpStart: side({
    torso: 172,
    raise: { ankle0: 16, toe0: 16 },
    arms: [
      [-20, 30],
      [25, 75],
    ],
    legs: [
      [80, 0],
      [-4, -2],
    ],
  }),
  stepUpTop: side({
    torso: 180,
    raise: { ankle0: 16, toe0: 16 },
    arms: [
      [25, 75],
      [-20, 30],
    ],
    legs: [
      [0, 0],
      [70, 0],
    ],
  }),
  splitSquatTop: side({
    torso: 176,
    raise: { ankle1: 24, toe1: 24 },
    arms: [hipsHold(), hipsHold()],
    legs: [
      [16, -4],
      [-50, -95, -70],
    ],
  }),
  splitSquatBottom: side({
    torso: 166,
    raise: { ankle1: 24, toe1: 24 },
    arms: [hipsHold(), hipsHold()],
    legs: [
      [76, -10],
      [-24, -140, -70],
    ],
  }),
  // Charnière de hanche
  hinge: side({
    torso: 100,
    arms: [
      [2, 0],
      [-2, 0],
    ],
    legs: [
      [22, 0],
      [20, 0],
    ],
  }),
  swingLow: side({
    torso: 112,
    arms: [
      [-24, -24],
      [-20, -20],
    ],
    legs: [
      [32, -6],
      [30, -6],
    ],
  }),
  rowBent: side({
    torso: 130,
    arms: [
      [0, 0],
      [-3, 0],
    ],
    legs: [
      [26, -6],
      [24, -6],
    ],
  }),
  rowBentUp: side({
    torso: 130,
    arms: [
      [-62, 6],
      [-58, 6],
    ],
    legs: [
      [26, -6],
      [24, -6],
    ],
  }),
  rowBench: side({
    torso: 95,
    raise: { knee1: 18, ankle1: 18, toe1: 18, hand1: 18 },
    arms: [[0, 0], { floor: 0 }],
    legs: [
      [-6, 0],
      [0, -90, -90],
    ],
  }),
  rowBenchUp: side({
    torso: 95,
    raise: { knee1: 18, ankle1: 18, toe1: 18, hand1: 18 },
    arms: [[-62, 6], { floor: 0 }],
    legs: [
      [-6, 0],
      [0, -90, -90],
    ],
  }),
  deadliftLow: side({
    torso: 112,
    arms: [
      { floor: -6, up: 5 },
      { floor: -6, up: 5 },
    ],
    legs: [
      [68, -16],
      [66, -16],
    ],
  }),
  foldHands: side({
    torso: 45,
    head: 32,
    arms: [{ floor: 5 }, { floor: 5 }],
    legs: [
      [-4, 0],
      [-6, 0],
    ],
  }),
  kbRowLunge: side({
    torso: 128,
    arms: [[2, 0], { to: "knee0", along: 0, out: 2, bend: 1 }],
    legs: [
      [70, -6],
      [-30, -40, 60],
    ],
  }),
  kbRowLungeUp: side({
    torso: 128,
    arms: [[-60, 8], { to: "knee0", along: 0, out: 2, bend: 1 }],
    legs: [
      [70, -6],
      [-30, -40, 60],
    ],
  }),
  // Planches et pompes
  plankHigh: side({ torso: 107, arms: onFloor, legs: plankLegs(107) }),
  pushDown: side({ torso: 97, arms: onFloor, legs: plankLegs(97) }),
  plankForearm: side({
    torso: 97,
    arms: [
      [0, 90],
      [2, 90],
    ],
    legs: plankLegs(97),
  }),
  plankForearmLow: side({
    torso: 95,
    arms: [
      [0, 90],
      [2, 90],
    ],
    legs: plankLegs(95),
  }),
  plankShoulderTouch: side({
    torso: 107,
    arms: [{ to: "neck", along: -3, out: 1, bend: 1 }, { floor: 0 }],
    legs: plankLegs(107),
  }),
  plankKnee: side({
    torso: 106,
    arms: [
      [0, 90],
      [2, 90],
    ],
    legs: [
      [-74, -96, -90],
      [-76, -96, -90],
    ],
  }),
  climberKnee: side({
    torso: 110,
    arms: onFloor,
    legs: [
      [52, -60, 10],
      [-70, -70, 18],
    ],
  }),
  pushKneesUp: side({
    torso: 122,
    arms: onFloor,
    legs: [
      [-58, -96, -90],
      [-60, -96, -90],
    ],
  }),
  pushKneesDown: side({
    torso: 103,
    arms: onFloor,
    legs: [
      [-77, -96, -90],
      [-79, -96, -90],
    ],
  }),
  pushWallUp: side({
    torso: 166,
    arms: [
      { to: "neck", along: -3, out: 22 },
      { to: "neck", along: -3, out: 21 },
    ],
    legs: [
      [-14, -14, 90],
      [-14, -14, 90],
    ],
  }),
  pushWallDown: side({
    torso: 150,
    arms: [
      { to: "neck", along: -3, out: 9 },
      { to: "neck", along: -3, out: 8 },
    ],
    legs: [
      [-30, -30, 70],
      [-30, -30, 70],
    ],
  }),
  pushInclineUp: side({
    torso: 135,
    raise: { hand0: 26, hand1: 26 },
    arms: onFloor,
    legs: [
      [-45, -45, 40],
      [-46, -46, 40],
    ],
  }),
  pushInclineDown: side({
    torso: 120,
    raise: { hand0: 26, hand1: 26 },
    arms: onFloor,
    legs: [
      [-60, -60, 30],
      [-61, -61, 30],
    ],
  }),
  pushDeclineUp: side({
    torso: 86,
    raise: { ankle0: 24, ankle1: 24, toe0: 24, toe1: 24 },
    arms: onFloor,
    legs: plankLegs(86),
  }),
  pushDeclineDown: side({
    torso: 78,
    raise: { ankle0: 24, ankle1: 24, toe0: 24, toe1: 24 },
    arms: onFloor,
    legs: plankLegs(78),
  }),
  pike: side({
    torso: 50,
    head: 30,
    arms: [{ floor: 18 }, { floor: 18 }],
    legs: [
      [-43, -43, 20],
      [-44, -44, 20],
    ],
  }),
  pikeDown: side({
    torso: 36,
    head: 15,
    arms: [
      { floor: 25, bend: 1 },
      { floor: 25, bend: 1 },
    ],
    legs: [
      [-40, -40, 20],
      [-41, -41, 20],
    ],
  }),
  bearA: side({
    torso: 102,
    arms: onFloor,
    legs: [
      [16, -70, -30],
      [18, -70, -30],
    ],
  }),
  bearB: side({
    torso: 104,
    arms: [{ floor: 8 }, { floor: -4 }],
    legs: [
      [6, -80, -30],
      [36, -58, -30],
    ],
  }),
  dipsUp: side({
    torso: 178,
    arms: [
      { to: "hip", along: 2, out: -9 },
      { to: "hip", along: 2, out: -9 },
    ],
    legs: [
      [80, 6],
      [78, 6],
    ],
  }),
  dipsDown: side({
    torso: 176,
    arms: [
      { to: "hip", along: 13, out: -9 },
      { to: "hip", along: 13, out: -9 },
    ],
    legs: [
      [62, -18],
      [60, -18],
    ],
  }),
  // Quatre pattes et à genoux
  quad: side({ torso: 103, arms: onFloor, legs: QUAD_LEGS }),
  cat: side({ torso: 103, curve: 5, head: 50, arms: onFloor, legs: QUAD_LEGS }),
  cow: side({ torso: 103, curve: -4, head: 125, arms: onFloor, legs: QUAD_LEGS }),
  birdDog: side({
    torso: 101,
    arms: [[95, 95], { floor: 0 }],
    legs: [
      [0, -90, -90],
      [-92, -92, -60],
    ],
  }),
  donkey: side({
    torso: 103,
    arms: onFloor,
    legs: [
      [-92, 178, -90],
      [3, -90, -90],
    ],
  }),
  kneelTall: side({
    torso: 180,
    arms: armsUp,
    legs: [
      [0, -90, -90],
      [2, -90, -90],
    ],
  }),
  kneelPullDown: side({
    torso: 180,
    arms: shoulderHold,
    legs: [
      [0, -90, -90],
      [2, -90, -90],
    ],
  }),
  childPose: side({
    torso: 80,
    head: 70,
    arms: [{ floor: 22 }, { floor: 21 }],
    legs: [
      [72, -90, -90],
      [70, -90, -90],
    ],
  }),
  // Allongé sur le dos (tête à gauche)
  lying: side({ torso: -90, arms: ALONG_BODY, legs: KNEES_BENT }),
  lyingBreath: side({
    torso: -90,
    arms: [{ to: "hip", along: 9, out: 7, bend: 1 }, ALONG_BODY[1]],
    legs: KNEES_BENT,
  }),
  lyingBreathIn: side({
    torso: -90,
    curve: -2.5,
    arms: [{ to: "hip", along: 9, out: 9, bend: 1 }, ALONG_BODY[1]],
    legs: KNEES_BENT,
  }),
  bridgeUp: side({
    torso: -66,
    head: -92,
    arms: [
      [96, 96],
      [98, 98],
    ],
    legs: [
      [102, 16],
      [99, 16],
    ],
  }),
  bridgeOneDown: side({
    torso: -90,
    arms: ALONG_BODY,
    legs: [
      [100, 100, 180],
      [134, 30],
    ],
  }),
  bridgeOneUp: side({
    torso: -66,
    head: -92,
    arms: [
      [96, 96],
      [98, 98],
    ],
    legs: [
      [104, 104, 180],
      [99, 16],
    ],
  }),
  lyingArmsUp: side({
    torso: -90,
    arms: [
      [180, 180],
      [178, 178],
    ],
    legs: KNEES_BENT,
  }),
  lyingArmOpen: side({
    torso: -90,
    arms: [
      [-100, -100],
      [178, 178],
    ],
    legs: KNEES_BENT,
  }),
  floorPressDown: side({
    torso: -90,
    arms: [
      [92, 180],
      [94, 180],
    ],
    legs: KNEES_BENT,
  }),
  floorFlyOpen: side({
    torso: -90,
    arms: [
      [130, 145],
      [230, 215],
    ],
    legs: KNEES_BENT,
  }),
  benchDown: side({
    torso: -90,
    arms: [
      [8, 178],
      [4, 178],
    ],
    legs: [
      [62, 0],
      [60, 0],
    ],
  }),
  benchUp: side({
    torso: -90,
    arms: [
      [180, 180],
      [178, 178],
    ],
    legs: [
      [62, 0],
      [60, 0],
    ],
  }),
  crunchDown: side({
    torso: -90,
    arms: [
      { to: "head", along: 0, out: 2, bend: 1 },
      { to: "head", along: 0, out: 1, bend: 1 },
    ],
    legs: KNEES_BENT,
  }),
  crunchUp: side({
    torso: -122,
    head: -128,
    arms: [
      { to: "head", along: 0, out: 2, bend: 1 },
      { to: "head", along: 0, out: 1, bend: 1 },
    ],
    legs: KNEES_BENT,
  }),
  legsLow: side({
    torso: -90,
    arms: ALONG_BODY,
    legs: [
      [96, 96, 180],
      [98, 98, 180],
    ],
  }),
  legsUp: side({
    torso: -90,
    arms: ALONG_BODY,
    legs: [
      [176, 176, 90],
      [174, 174, 90],
    ],
  }),
  scissorsA: side({
    torso: -90,
    arms: ALONG_BODY,
    legs: [
      [142, 142, 135],
      [124, 124, 115],
    ],
  }),
  scissorsB: side({
    torso: -90,
    arms: ALONG_BODY,
    legs: [
      [124, 124, 115],
      [142, 142, 135],
    ],
  }),
  lyingFlatArmsBack: side({
    torso: -90,
    arms: [
      [-92, -92],
      [-90, -90],
    ],
    legs: [
      [92, 92, 180],
      [93, 93, 180],
    ],
  }),
  hollow: side({
    torso: -112,
    head: -118,
    arms: [
      [-100, -100],
      [-98, -98],
    ],
    legs: [
      [108, 108, 180],
      [110, 110, 180],
    ],
  }),
  deadBugA: side({
    torso: -90,
    arms: [
      [180, 180],
      [176, 176],
    ],
    legs: [
      [180, 90, 180],
      [176, 90, 180],
    ],
  }),
  deadBugB: side({
    torso: -90,
    arms: [
      [-98, -98],
      [176, 176],
    ],
    legs: [
      [180, 90, 180],
      [102, 102, 180],
    ],
  }),
  figureFour: side({
    torso: -90,
    arms: [
      { to: "knee1", bend: 1 },
      { to: "knee1", bend: 1 },
    ],
    legs: [
      [165, 57, 140],
      [130, 30],
    ],
  }),
  figureFourPull: side({
    torso: -90,
    arms: [
      { to: "knee1", bend: 1 },
      { to: "knee1", bend: 1 },
    ],
    legs: [
      [200, 80, 160],
      [170, 100, 190],
    ],
  }),
  seatedLegsOut: side({
    torso: 170,
    arms: armsForward,
    legs: [
      [88, 88, 175],
      [90, 90, 175],
    ],
  }),
  seatedRowBack: side({
    torso: 182,
    arms: [
      [-30, 88],
      [-26, 88],
    ],
    legs: [
      [88, 88, 175],
      [90, 90, 175],
    ],
  }),
  seatedTwistA: side({
    torso: -152,
    arms: [
      [100, 60],
      [96, 60],
    ],
    legs: [
      [130, 22],
      [126, 22],
    ],
  }),
  seatedTwistB: side({
    torso: -152,
    arms: [
      [150, 120],
      [146, 120],
    ],
    legs: [
      [130, 22],
      [126, 22],
    ],
  }),
  // Allongé sur le ventre (tête à droite)
  prone: side({
    torso: 90,
    head: 92,
    arms: [
      [92, 92],
      [90, 90],
    ],
    legs: [
      [-90, -90, -88],
      [-90, -90, -88],
    ],
  }),
  proneLift: side({
    torso: 98,
    head: 104,
    arms: [
      [106, 106],
      [104, 104],
    ],
    legs: [
      [-82, -82, -88],
      [-83, -83, -88],
    ],
  }),
  proneArmsLift: side({
    torso: 94,
    head: 98,
    arms: [
      [116, 116],
      [114, 114],
    ],
    legs: [
      [-90, -90, -88],
      [-90, -90, -88],
    ],
  }),
  proneCurl: side({
    torso: 90,
    head: 92,
    arms: [
      [60, 100],
      [58, 100],
    ],
    legs: [
      [-90, -90, -88],
      [-90, -90, -88],
    ],
  }),
  proneCurlUp: side({
    torso: 90,
    head: 92,
    arms: [
      [60, 100],
      [58, 100],
    ],
    legs: [
      [-90, -178, -100],
      [-90, -176, -100],
    ],
  }),
  // Assis sur une chaise ou un banc
  seatPress: side({ torso: 180, arms: shoulderHold, legs: SEATED_LEGS }),
  seatPressUp: side({ torso: 180, arms: armsUp, legs: SEATED_LEGS }),
  seatTricepsDown: side({
    torso: 180,
    arms: [
      [172, -12],
      [168, -12],
    ],
    legs: SEATED_LEGS,
  }),
  seatTricepsUp: side({
    torso: 180,
    arms: [
      [174, 178],
      [170, 176],
    ],
    legs: SEATED_LEGS,
  }),
  seatArmsUp: side({ torso: 180, arms: armsUp, legs: SEATED_LEGS }),
  seatPullDown: side({ torso: 176, arms: shoulderHold, legs: SEATED_LEGS }),
  seatReach: side({ torso: 174, arms: armsForward, legs: SEATED_LEGS }),
  seatRowBack: side({
    torso: 180,
    arms: [
      [-30, 88],
      [-26, 88],
    ],
    legs: SEATED_LEGS,
  }),
  seatChestIn: side({
    torso: 180,
    arms: [
      [-70, 88],
      [-66, 88],
    ],
    legs: SEATED_LEGS,
  }),
  seatChestOut: side({ torso: 180, arms: armsForward, legs: SEATED_LEGS }),
  hamstringSeat: side({
    torso: 178,
    arms: [
      { to: "knee0", along: 3, out: 0, bend: 1 },
      { to: "knee0", along: 3, out: 0, bend: 1 },
    ],
    legs: [
      [52, 52, 165],
      [85, 2],
    ],
  }),
  hamstringSeatLean: side({
    torso: 140,
    arms: [
      { to: "knee0", along: 0, out: 2, bend: 1 },
      { to: "knee0", along: 0, out: 2, bend: 1 },
    ],
    legs: [
      [52, 52, 165],
      [85, 2],
    ],
  }),
  legPressIn: side({
    torso: -140,
    arms: [
      [40, 70],
      [36, 70],
    ],
    legs: [
      [148, 78, 168],
      [145, 78, 168],
    ],
  }),
  legPressOut: side({
    torso: -140,
    arms: [
      [40, 70],
      [36, 70],
    ],
    legs: [
      [118, 118, 205],
      [116, 116, 205],
    ],
  }),
  // Suspendu à la barre
  hang: side({
    torso: 180,
    hang: true,
    arms: [
      [180, 180],
      [178, 180],
    ],
    legs: [
      [4, -6, 40],
      [0, -8, 40],
    ],
  }),
  hangActive: side({
    torso: 178,
    hang: true,
    arms: [
      [176, 180],
      [174, 180],
    ],
    legs: [
      [8, -4, 30],
      [4, -6, 30],
    ],
  }),
  hangTop: side({
    torso: 178,
    hang: true,
    arms: [
      [26, 172],
      [20, 172],
    ],
    legs: [
      [10, -20, 40],
      [6, -24, 40],
    ],
  }),
  hangKnees: side({
    torso: 176,
    hang: true,
    arms: [
      [180, 180],
      [178, 180],
    ],
    legs: [
      [98, 4, 70],
      [95, 4, 70],
    ],
  }),
  // Vue de face
  frontStand: front({ torso: 180 }),
  frontArmsSide: front({
    torso: 180,
    arms: [
      [90, 90],
      [-90, -90],
    ],
  }),
  frontArmsHigh: front({
    torso: 180,
    arms: [
      [135, 150],
      [-135, -150],
    ],
  }),
  frontArmsCross: front({
    torso: 180,
    arms: [
      [-62, -92],
      [62, 92],
    ],
  }),
  frontRaiseUp: front({
    torso: 180,
    arms: [
      [86, 92],
      [-86, -92],
    ],
  }),
  frontHipsL: front({
    torso: 186,
    arms: [
      { to: "hip0", along: 8, out: 3, bend: 1 },
      { to: "hip1", along: 8, out: -3, bend: -1 },
    ],
    legs: [
      [8, 2],
      [3, -4],
    ],
  }),
  frontHipsR: front({
    torso: 174,
    arms: [
      { to: "hip0", along: 8, out: 3, bend: 1 },
      { to: "hip1", along: 8, out: -3, bend: -1 },
    ],
    legs: [
      [-3, 4],
      [-8, -2],
    ],
  }),
  frontTwistL: front({
    torso: 180,
    head: 176,
    arms: [
      [-70, -95],
      [-95, -95],
    ],
  }),
  frontTwistR: front({
    torso: 180,
    head: 184,
    arms: [
      [95, 95],
      [70, 95],
    ],
  }),
  frontStepOut: front({
    torso: 180,
    arms: [
      [120, 135],
      [-120, -135],
    ],
    legs: [
      [26, 26],
      [-3, 0],
    ],
  }),
  frontJackOut: front({
    torso: 180,
    lift: 6,
    arms: [
      [145, 165],
      [-145, -165],
    ],
    legs: [
      [22, 22],
      [-22, -22],
    ],
  }),
  frontShoulderStretch: front({
    torso: 180,
    arms: [[-70, -80], { to: "elbow0", along: 0, out: 1, bend: 1 }],
  }),
  frontShoulderStretchDeep: front({
    torso: 180,
    arms: [[-92, -92], { to: "elbow0", along: -1, out: 2, bend: 1 }],
  }),
  frontSideLunge: front({
    torso: 176,
    arms: [
      [-20, -70],
      [20, 70],
    ],
    legs: [
      [62, -6],
      [-38, -38],
    ],
  }),
  frontSumo: front({
    torso: 180,
    arms: [
      [-14, -40],
      [14, 40],
    ],
    legs: [
      [20, 14],
      [-20, -14],
    ],
  }),
  frontSumoDown: front({
    torso: 180,
    arms: [
      [-14, -40],
      [14, 40],
    ],
    legs: [
      [64, -16],
      [-64, 16],
    ],
  }),
  frontHalfSquat: front({
    torso: 180,
    arms: [
      [-10, -50],
      [10, 50],
    ],
    legs: [
      [32, -14],
      [-32, 14],
    ],
  }),
  frontHalfSquatWide: front({
    torso: 180,
    arms: [
      [-10, -50],
      [10, 50],
    ],
    legs: [
      [42, -4],
      [-30, 14],
    ],
  }),
  frontSkaterA: front({
    torso: 172,
    arms: [
      [-25, -55],
      [-60, -75],
    ],
    legs: [
      [24, -8],
      [55, 80, 90],
    ],
  }),
  frontSkaterB: front({
    torso: 188,
    arms: [
      [60, 75],
      [25, 55],
    ],
    legs: [
      [-55, -80, -90],
      [-24, 8],
    ],
  }),
  frontShuffleWide: front({
    torso: 180,
    arms: [
      [30, 80],
      [-30, -80],
    ],
    legs: [
      [26, 6],
      [-26, -6],
    ],
  }),
  frontShuffleNarrow: front({
    torso: 180,
    lift: 4,
    arms: [
      [20, 60],
      [-20, -60],
    ],
    legs: [
      [6, 0],
      [-6, 0],
    ],
  }),
  frontRopeLow: front({
    torso: 180,
    arms: [
      [22, 60],
      [-22, -60],
    ],
  }),
  frontRopeHigh: front({
    torso: 180,
    lift: 8,
    arms: [
      [22, 60],
      [-22, -60],
    ],
    legs: [
      [3, 0, 160],
      [-3, 0, -160],
    ],
  }),
  frontChestOpen: front({
    torso: 180,
    arms: [
      [80, 88],
      [-80, -88],
    ],
  }),
  frontPressIn: front({
    torso: 180,
    arms: [
      [-40, -95],
      [40, 95],
    ],
  }),
  // Allongé sur le côté, vu de face (tête à gauche, bras du dessous sous la tête)
  sideLying: front({
    torso: -90,
    arms: [
      [94, 94],
      [-90, -90],
    ],
    legs: [
      [90, 90, 180],
      [90, 90, 180],
    ],
  }),
  sideLyingLegUp: front({
    torso: -90,
    arms: [
      [94, 94],
      [-90, -90],
    ],
    legs: [
      [118, 118, 180],
      [90, 90, 180],
    ],
  }),
  sidePlankLow: front({
    torso: -100,
    arms: [{ to: "hip0", along: 3, out: 2, bend: 1 }, [0, -90]],
    legs: [
      [80, 80, 180],
      [80, 80, 180],
    ],
  }),
  sidePlank: front({
    torso: -112,
    arms: [
      [175, 180],
      [-4, -90],
    ],
    legs: [
      [68, 68, 160],
      [68, 68, 160],
    ],
  }),
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;
export const POSE_NAMES = Object.keys(POSES) as PoseName[];

/* ------------------------------------------------------------------------------------------ */
/* Mouvement de chaque exercice                                                                */
/* ------------------------------------------------------------------------------------------ */

/** Matériel et décor, dessinés simplement autour de la silhouette. */
export const PROPS = [
  "dumbbells",
  "dumbbell",
  "dumbbellChest",
  "kettlebell",
  "kettlebellHand",
  "barbell",
  "barbellBack",
  "bandFeet",
  "bandHigh",
  "bandFront",
  "bandBack",
  "bandSides",
  "bandKnees",
  "bandBar",
  "bar",
  "chair",
  "chairFoot",
  "chairHands",
  "benchSupport",
  "table",
  "bench",
  "benchFeet",
  "step",
  "wallFront",
  "wallBack",
  "mat",
  "legPress",
  "legCurl",
  "pulldown",
  "cableRow",
  "chestPress",
  "rope",
] as const;
export type Prop = (typeof PROPS)[number];

export type Motion = {
  readonly from: PoseName;
  readonly to: PoseName;
  readonly props?: readonly Prop[];
  /** Articulation qui reste fixe pendant le mouvement (par défaut, la cheville proche). */
  readonly pin?: JointRef;
};

const m = (from: PoseName, to: PoseName, props: readonly Prop[] = [], pin?: JointRef): Motion => ({
  from,
  to,
  props,
  pin,
});

export const EXERCISE_MOTION: Record<string, Motion> = {
  // Échauffement
  "marche-sur-place": m("marchA", "marchB", [], "hip"),
  "cercles-bras": m("frontArmsSide", "frontArmsHigh"),
  "rotations-bassin": m("frontHipsL", "frontHipsR", [], "hip"),
  "talons-fesses-legers": m("heelsA", "heelsB", [], "hip"),
  "rotations-buste": m("frontTwistL", "frontTwistR"),
  "pas-chasses-ecartes": m("frontStand", "frontStepOut", [], "ankle1"),
  "balanciers-jambes": m("legSwingBack", "legSwingFront", [], "ankle1"),
  "ouvertures-poitrine": m("frontArmsCross", "frontArmsSide"),
  "squat-eveil": m("standArmsForward", "squatHalf"),
  "cercles-chevilles-poignets": m("ankleA", "ankleB", [], "ankle1"),
  // Retour au calme
  "etirement-cuisse-avant": m("quadStretchStart", "quadStretch", ["wallFront"], "ankle1"),
  "etirement-cuisse-arriere": m("hamstringSeat", "hamstringSeatLean", ["chair"], "hip"),
  "etirement-mollets": m("calfStretch", "calfStretchDeep", ["wallFront"], "ankle1"),
  "etirement-poitrine-mur": m("standChestStretch", "standChestStretchDeep", ["wallBack"]),
  "repos-a-genoux": m("kneelTall", "childPose", ["mat"], "ankle0"),
  "dos-rond-dos-creux": m("cow", "cat", ["mat"], "knee0"),
  "rotation-haut-dos": m("lyingArmsUp", "lyingArmOpen", ["mat"], "hip"),
  "etirement-fessiers": m("figureFour", "figureFourPull", ["mat"], "hip"),
  "etirement-epaule-bras-croise": m("frontShoulderStretch", "frontShoulderStretchDeep"),
  "respiration-lente": m("lyingBreath", "lyingBreathIn", ["mat"], "hip"),
  "fente-basse-etirement": m("halfKneel", "halfKneelForward", ["mat"], "ankle0"),
  // Jambes et fessiers
  squat: m("standArmsForward", "squatDeep"),
  "assis-debout-chaise": m("sitChair", "sitStandUp", ["chair"]),
  "chaise-murale": m("wallSitHigh", "wallSit", ["wallBack"]),
  "fente-arriere": m("standHandsHips", "lungeHands"),
  "fente-avant-alternee": m("standHandsHips", "lungeHands", [], "ankle1"),
  "fente-laterale": m("frontStand", "frontSideLunge", [], "ankle1"),
  "squat-sumo": m("frontSumo", "frontSumoDown", [], "hip"),
  "pont-fessier": m("lying", "bridgeUp", ["mat"], "ankle0"),
  "pont-une-jambe": m("bridgeOneDown", "bridgeOneUp", ["mat"], "ankle1"),
  "montees-pointes": m("calfDown", "calfUp", ["wallFront"]),
  "montees-sur-marche": m("stepUpStart", "stepUpTop", ["step"]),
  "squat-bulgare": m("splitSquatTop", "splitSquatBottom", ["chairFoot"]),
  "ruade-quatre-pattes": m("quad", "donkey", ["mat"], "knee1"),
  "ecarte-jambe-allonge": m("sideLying", "sideLyingLegUp", ["mat"], "hip"),
  "squat-saute": m("squatDeepArmsBack", "jumpArmsUp"),
  "fente-sautee": m("lungeHands", "lungeJump", [], "hip"),
  "squat-goblet-haltere": m("standChestHold", "squatChest", ["dumbbellChest"]),
  "souleve-roumain-halteres": m("standArmsStraight", "hinge", ["dumbbells"]),
  "fente-halteres": m("standArmsStraight", "lungeArmsDown", ["dumbbells"]),
  "pont-elastique": m("lying", "bridgeUp", ["mat", "bandKnees"], "ankle0"),
  "pas-lateraux-elastique": m("frontHalfSquat", "frontHalfSquatWide", ["bandKnees"], "ankle1"),
  "swing-kettlebell": m("swingLow", "standArmsForward", ["kettlebell"]),
  "squat-goblet-kettlebell": m("standChestHold", "squatChest", ["kettlebell"]),
  "squat-barre": m("standBarBack", "squatBarBack", ["barbellBack"]),
  "presse-cuisses": m("legPressIn", "legPressOut", ["legPress"], "hip"),
  "flexion-jambes-machine": m("proneCurl", "proneCurlUp", ["legCurl"], "hip"),
  "souleve-terre-barre": m("deadliftLow", "standArmsStraight", ["barbell"]),
  // Poitrine
  pompes: m("plankHigh", "pushDown", ["mat"], "toe0"),
  "pompes-genoux": m("pushKneesUp", "pushKneesDown", ["mat"], "knee0"),
  "pompes-mur": m("pushWallUp", "pushWallDown", ["wallFront"], "toe0"),
  "pompes-inclinees": m("pushInclineUp", "pushInclineDown", ["table"], "toe0"),
  "pompes-pieds-sureleves": m("pushDeclineUp", "pushDeclineDown", ["benchFeet"], "toe0"),
  "developpe-sol-halteres": m("floorPressDown", "lyingArmsUp", ["mat", "dumbbells"], "hip"),
  "ecarte-sol-halteres": m("lyingArmsUp", "floorFlyOpen", ["mat", "dumbbells"], "hip"),
  "developpe-couche-banc-halteres": m("benchDown", "benchUp", ["bench", "dumbbells"]),
  "developpe-couche-barre": m("benchDown", "benchUp", ["bench", "barbell"]),
  "presse-pectorale-machine": m("seatChestIn", "seatChestOut", ["chestPress"], "hip"),
  "ecarte-elastique": m("frontChestOpen", "frontPressIn", ["bandSides"]),
  // Dos
  "rowing-haltere": m("rowBench", "rowBenchUp", ["dumbbell", "benchSupport"]),
  "rowing-elastique": m("seatedLegsOut", "seatedRowBack", ["mat", "bandFeet"], "hip"),
  "tirage-haut-elastique": m("kneelTall", "kneelPullDown", ["mat", "bandHigh"], "knee0"),
  traction: m("hang", "hangTop", ["bar"]),
  "traction-assistee": m("hang", "hangTop", ["bar", "bandBar"]),
  "suspension-barre": m("hang", "hangActive", ["bar"]),
  superman: m("prone", "proneLift", ["mat"], "hip"),
  "y-t-au-sol": m("prone", "proneArmsLift", ["mat"], "hip"),
  "tirage-poulie-haute": m("seatArmsUp", "seatPullDown", ["pulldown"], "hip"),
  "tirage-horizontal-poulie": m("seatReach", "seatRowBack", ["cableRow"], "hip"),
  "rowing-barre": m("rowBent", "rowBentUp", ["barbell"]),
  "rowing-kettlebell": m("kbRowLunge", "kbRowLungeUp", ["kettlebellHand"]),
  // Épaules
  "developpe-epaules-halteres": m("seatPress", "seatPressUp", ["chair", "dumbbells"], "hip"),
  "elevations-laterales": m("frontStand", "frontRaiseUp", ["dumbbells"]),
  "elevations-laterales-elastique": m("frontStand", "frontRaiseUp", ["bandFeet"]),
  "tirage-visage-elastique": m("standPressOut", "standFacePull", ["bandFront"]),
  "pompes-pike": m("pike", "pikeDown", ["mat"], "toe0"),
  "planche-touchers-epaules": m("plankHigh", "plankShoulderTouch", ["mat"], "toe0"),
  // Bras
  "curl-halteres": m("standArmsStraight", "standCurl", ["dumbbells"]),
  "curl-marteau": m("standArmsStraight", "standCurl", ["dumbbells"]),
  "curl-elastique": m("standArmsStraight", "standCurl", ["bandFeet"]),
  "extension-triceps-haltere": m("seatTricepsDown", "seatTricepsUp", ["chair", "dumbbellChest"], "hip"),
  "extension-triceps-elastique": m("standPushdownUp", "standPushdownDown", ["bandHigh"]),
  "dips-chaise": m("dipsUp", "dipsDown", ["chairHands"]),
  "pompes-serrees": m("plankHigh", "pushDown", ["mat"], "toe0"),
  // Gainage
  planche: m("plankForearmLow", "plankForearm", ["mat"], "toe0"),
  "planche-genoux": m("plankKnee", "plankKnee", ["mat"], "knee0"),
  "planche-laterale": m("sidePlankLow", "sidePlank", ["mat"], "toe1"),
  "insecte-sur-le-dos": m("deadBugA", "deadBugB", ["mat"], "hip"),
  "bras-jambe-opposes": m("quad", "birdDog", ["mat"], "knee0"),
  crunch: m("crunchDown", "crunchUp", ["mat"], "ankle0"),
  "releves-jambes": m("legsLow", "legsUp", ["mat"], "hip"),
  grimpeur: m("plankHigh", "climberKnee", ["mat"], "toe1"),
  coque: m("lyingFlatArmsBack", "hollow", ["mat"], "hip"),
  "rotations-assises": m("seatedTwistA", "seatedTwistB", ["mat"], "hip"),
  "planche-montante": m("plankForearm", "plankHigh", ["mat"], "toe0"),
  ciseaux: m("scissorsA", "scissorsB", ["mat"], "hip"),
  "anti-rotation-elastique": m("standChest", "standPressOut", ["bandBack"]),
  "releve-genoux-barre": m("hang", "hangKnees", ["bar"]),
  // Cardio
  "sauts-ecartes": m("frontStand", "frontJackOut", [], "hip"),
  burpee: m("plankHigh", "jumpArmsUp", [], "toe0"),
  "burpee-sans-saut": m("plankHigh", "squatDeep", [], "toe0"),
  "montees-genoux-rapides": m("kneesA", "kneesB", [], "hip"),
  patineur: m("frontSkaterA", "frontSkaterB", [], "hip"),
  "corde-a-sauter": m("frontRopeLow", "frontRopeHigh", ["rope"], "hip"),
  "boxe-dans-le-vide": m("guard", "punch"),
  "marche-rapide": m("walkA", "walkB", [], "hip"),
  "course-moderee": m("runA", "runB", [], "hip"),
  "pas-chasses-rythmes": m("frontShuffleWide", "frontShuffleNarrow", [], "hip"),
  // Corps entier
  "squat-developpe-halteres": m("squatShoulders", "standArmsUp", ["dumbbells"]),
  "marche-ours": m("bearA", "bearB", [], "hip"),
  chenille: m("foldHands", "plankHigh", ["mat"], "toe0"),
  "fente-rotation": m("lungeArmsForward", "lungeTwist", [], "ankle0"),
  "epaule-jete-kettlebell": m("hinge", "standRack", ["kettlebellHand"]),
};

/** Mouvement par défaut d'un exercice personnel, selon son groupe musculaire. */
export const DEFAULT_MOTION: Record<Muscle, Motion> = {
  legs: m("standArmsForward", "squatDeep"),
  glutes: m("lying", "bridgeUp", ["mat"], "ankle0"),
  chest: m("plankHigh", "pushDown", ["mat"], "toe0"),
  back: m("prone", "proneLift", ["mat"], "hip"),
  shoulders: m("frontStand", "frontRaiseUp"),
  arms: m("standArmsStraight", "standCurl"),
  core: m("plankForearmLow", "plankForearm", ["mat"], "toe0"),
  full_body: m("squatDeepArmsBack", "jumpArmsUp"),
  cardio: m("frontStand", "frontJackOut", [], "hip"),
  mobility: m("cow", "cat", ["mat"], "knee0"),
};

export function motionFor(exerciseId: string, muscle: Muscle): Motion {
  return EXERCISE_MOTION[exerciseId] ?? DEFAULT_MOTION[muscle];
}

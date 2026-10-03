import { describe, expect, it } from "vitest";

import { EXERCISES } from "@/domain/training/exercises";
import {
  DEFAULT_MOTION,
  EXERCISE_MOTION,
  POSES,
  POSE_NAMES,
  PROPS,
  frameBetween,
  motionFor,
  poseFrame,
} from "@/domain/training/poses";
import { GROUND, VIEWBOX, buildScene, exerciseScene, shapeBounds } from "@/domain/training/scene";
import { MUSCLES } from "@/domain/training/types";

describe("illustrations des exercices : mouvements", () => {
  it("chaque exercice de la bibliothèque a un mouvement, et aucun mouvement n'est orphelin", () => {
    for (const exercise of EXERCISES) expect(EXERCISE_MOTION[exercise.id], exercise.id).toBeDefined();
    const ids = new Set(EXERCISES.map((exercise) => exercise.id));
    for (const id of Object.keys(EXERCISE_MOTION)) expect(ids.has(id), id).toBe(true);
  });

  it("chaque mouvement cite des poses existantes, de même vue, et du matériel connu", () => {
    const motions = [...Object.values(EXERCISE_MOTION), ...Object.values(DEFAULT_MOTION)];
    for (const motion of motions) {
      expect(POSES[motion.from], motion.from).toBeDefined();
      expect(POSES[motion.to], motion.to).toBeDefined();
      expect(POSES[motion.from].view).toBe(POSES[motion.to].view);
      for (const prop of motion.props ?? []) expect(PROPS).toContain(prop);
    }
  });

  it("un exercice personnel reçoit une pose type selon son groupe musculaire", () => {
    for (const muscle of MUSCLES) expect(motionFor("perso-inconnu", muscle)).toBe(DEFAULT_MOTION[muscle]);
    expect(motionFor("squat", "core")).toBe(EXERCISE_MOTION.squat);
  });
});

describe("illustrations des exercices : géométrie", () => {
  it("chaque pose donne des articulations finies, aux longueurs de segments respectées", () => {
    for (const name of POSE_NAMES) {
      const frame = poseFrame(POSES[name]);
      for (const [joint, point] of Object.entries(frame.joints)) {
        expect(Number.isFinite(point.x) && Number.isFinite(point.y), `${name}.${joint}`).toBe(true);
      }
      const { shoulder0, elbow0, hand0 } = frame.joints;
      expect(Math.hypot(elbow0.x - shoulder0.x, elbow0.y - shoulder0.y), name).toBeCloseTo(13, 1);
      expect(Math.hypot(hand0.x - elbow0.x, hand0.y - elbow0.y), name).toBeCloseTo(12, 1);
    }
  });

  it("l'interpolation part de la pose de départ et arrive à la pose d'arrivée", () => {
    const start = frameBetween(POSES.standArmsForward, POSES.squatDeep, 0);
    const end = frameBetween(POSES.standArmsForward, POSES.squatDeep, 1);
    expect(start).toEqual(poseFrame(POSES.standArmsForward));
    expect(end).toEqual(poseFrame(POSES.squatDeep));
  });

  it("toutes les images de tous les exercices restent dans la vignette, sans valeur invalide", () => {
    const scenes = [
      ...EXERCISES.map((exercise) => ({ id: exercise.id, scene: exerciseScene(exercise.id, exercise.muscle) })),
      ...MUSCLES.map((muscle) => ({ id: `défaut ${muscle}`, scene: buildScene(DEFAULT_MOTION[muscle], muscle) })),
    ];
    for (const { id, scene } of scenes) {
      const count = scene.frames[0]!.length;
      for (const shapes of scene.frames) {
        // Même liste de formes d'une image à l'autre : le rendu peut interpoler chaque tracé.
        expect(
          shapes.map((shape) => shape.role),
          id,
        ).toEqual(scene.frames[0]!.map((shape) => shape.role));
        expect(shapes.length).toBe(count);
        for (const shape of shapes) {
          const box = shapeBounds(shape);
          for (const value of Object.values(box)) expect(Number.isFinite(value), id).toBe(true);
          expect(box.minX, `${id} ${shape.role}`).toBeGreaterThanOrEqual(0);
          expect(box.minY, `${id} ${shape.role}`).toBeGreaterThanOrEqual(0);
          expect(box.maxX, `${id} ${shape.role}`).toBeLessThanOrEqual(VIEWBOX);
          expect(box.maxY, `${id} ${shape.role}`).toBeLessThanOrEqual(VIEWBOX);
        }
      }
    }
  });

  it("la silhouette touche le sol sans s'y enfoncer (hors sauts et suspensions)", () => {
    for (const exercise of EXERCISES) {
      const motion = EXERCISE_MOTION[exercise.id]!;
      const from = POSES[motion.from];
      if (from.hang || from.lift) continue;
      const scene = exerciseScene(exercise.id, exercise.muscle);
      const body = scene.frames[0]!.filter((shape) =>
        ["limb", "limbFar", "torso", "torsoFront", "head"].includes(shape.role),
      );
      const lowest = Math.max(...body.map((shape) => shapeBounds(shape).maxY));
      expect(lowest, exercise.id).toBeLessThanOrEqual(GROUND + 0.01);
    }
  });
});

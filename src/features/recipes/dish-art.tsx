import type { ReactNode } from "react";

import {
  ART_HEIGHT,
  ART_WIDTH,
  CENTER,
  type DishArtSpec,
  innerRadius,
  layoutDish,
  type Piece,
  type Vessel,
} from "@/domain/recipes/dish-art";

const OUTLINE = "rgba(60, 45, 30, 0.18)";

/** Récipient vu de dessus, sous les ingrédients. */
function VesselBase({ vessel }: { vessel: Vessel }) {
  const { x, y } = CENTER;
  switch (vessel) {
    case "plate":
      return (
        <>
          <ellipse cx={x + 3} cy={y + 5} rx={52} ry={50} fill="rgba(0,0,0,0.08)" />
          <circle cx={x} cy={y} r={51} fill="#fbfaf7" stroke={OUTLINE} />
          <circle cx={x} cy={y} r={41} fill="#f3f0ea" />
        </>
      );
    case "bowl":
      return (
        <>
          <ellipse cx={x + 3} cy={y + 5} rx={47} ry={45} fill="rgba(0,0,0,0.1)" />
          <circle cx={x} cy={y} r={46} fill="#f7f2ea" stroke={OUTLINE} />
          <circle cx={x} cy={y} r={37} fill="#e9e2d6" />
        </>
      );
    case "mug":
      return (
        <>
          <ellipse cx={x + 3} cy={y + 5} rx={42} ry={40} fill="rgba(0,0,0,0.1)" />
          <rect x={x + 34} y={y - 9} width={22} height={18} rx={9} fill="none" stroke="#f7f2ea" strokeWidth={6} />
          <circle cx={x} cy={y} r={41} fill="#f7f2ea" stroke={OUTLINE} />
          <circle cx={x} cy={y} r={35} fill="#e9e2d6" />
        </>
      );
    case "jar":
      return (
        <>
          <ellipse cx={x + 3} cy={y + 5} rx={42} ry={40} fill="rgba(0,0,0,0.1)" />
          <circle cx={x} cy={y} r={41} fill="#dfe9ec" stroke={OUTLINE} />
          <circle cx={x} cy={y} r={37} fill="none" stroke="#c4d4d9" strokeWidth={3} />
        </>
      );
    case "pan":
      return (
        <>
          <rect x={x + 40} y={y - 6} width={44} height={12} rx={6} fill="#3b3a38" />
          <ellipse cx={x + 3} cy={y + 5} rx={47} ry={45} fill="rgba(0,0,0,0.12)" />
          <circle cx={x} cy={y} r={46} fill="#3b3a38" />
          <circle cx={x} cy={y} r={39} fill="#4b4a47" />
        </>
      );
    case "board":
      return (
        <>
          <rect x={x - 66} y={y - 43} width={136} height={92} rx={14} fill="rgba(0,0,0,0.1)" />
          <rect x={x - 68} y={y - 46} width={136} height={92} rx={14} fill="#d8b48a" stroke={OUTLINE} />
          <path
            d={`M${x - 58} ${y - 30}h60M${x - 40} ${y - 12}h90M${x - 56} ${y + 8}h70M${x - 30} ${y + 28}h80`}
            stroke="#c99f72"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      );
    case "dish":
      return (
        <>
          <rect x={x - 61} y={y - 39} width={126} height={86} rx={20} fill="rgba(0,0,0,0.1)" />
          <rect x={x - 63} y={y - 42} width={126} height={84} rx={20} fill="#f7f2ea" stroke={OUTLINE} />
          <rect x={x - 54} y={y - 33} width={108} height={66} rx={14} fill="#e9e2d6" />
        </>
      );
  }
}

/** Forme d'un ingrédient, dessinée autour de l'origine et de taille `s`. */
function PieceShape({ piece }: { piece: Piece }): ReactNode {
  const s = piece.size;
  const h = s / 2;
  const accent = piece.accent ?? "rgba(255,255,255,0.55)";
  switch (piece.shape) {
    case "dot":
      return <circle r={h} fill={piece.color} />;
    case "seed":
      return <ellipse rx={h * 0.45} ry={h * 0.28} fill={piece.color} />;
    case "grain":
      return <ellipse rx={h} ry={h * 0.45} fill={piece.color} stroke={OUTLINE} strokeWidth={0.4} />;
    case "berry":
      return (
        <>
          <circle r={h} fill={piece.color} />
          <circle cx={-h * 0.35} cy={-h * 0.35} r={h * 0.28} fill="rgba(255,255,255,0.45)" />
        </>
      );
    case "nut":
      return (
        <>
          <ellipse rx={h} ry={h * 0.72} fill={piece.color} />
          <path d={`M${-h * 0.6} 0Q0 ${-h * 0.5} ${h * 0.6} 0`} stroke={accent} strokeWidth={0.8} fill="none" />
        </>
      );
    case "leaf":
      return (
        <>
          <path d={`M${-h} 0Q0 ${-h * 0.95} ${h} 0Q0 ${h * 0.95} ${-h} 0Z`} fill={piece.color} />
          <path d={`M${-h * 0.8} 0H${h * 0.8}`} stroke={accent} strokeWidth={0.7} />
        </>
      );
    case "herb":
      return <path d={`M${-h} 0Q0 ${-h * 0.8} ${h} 0Q0 ${h * 0.8} ${-h} 0Z`} fill={piece.color} />;
    case "slice":
      return (
        <>
          <circle r={h} fill={piece.color} stroke={OUTLINE} strokeWidth={0.5} />
          <circle r={h * 0.62} fill={accent} />
        </>
      );
    case "half":
      return (
        <>
          <path d={`M${-h} 0A${h} ${h} 0 0 1 ${h} 0Z`} fill={piece.color} />
          <path d={`M${-h * 0.75} -1A${h * 0.75} ${h * 0.75} 0 0 1 ${h * 0.75} -1Z`} fill={accent} />
        </>
      );
    case "ring":
      return <circle r={h * 0.8} fill="none" stroke={piece.color} strokeWidth={Math.max(1.2, h * 0.3)} />;
    case "cube":
      return (
        <>
          <rect x={-h} y={-h} width={s} height={s} rx={s * 0.22} fill={piece.color} />
          <rect x={-h} y={-h} width={s} height={s * 0.35} rx={s * 0.18} fill="rgba(255,255,255,0.18)" />
        </>
      );
    case "crumb":
      return (
        <path
          d={`M${-h} ${-h * 0.2}L${-h * 0.3} ${-h}L${h * 0.7} ${-h * 0.6}L${h} ${h * 0.3}L${0} ${h}L${-h * 0.8} ${h * 0.6}Z`}
          fill={piece.color}
          strokeLinejoin="round"
          stroke={piece.color}
          strokeWidth={1}
        />
      );
    case "strip":
      return <rect x={-h} y={-s * 0.14} width={s} height={s * 0.28} rx={s * 0.14} fill={piece.color} />;
    case "pasta":
      return (
        <>
          <rect x={-h} y={-s * 0.2} width={s} height={s * 0.4} rx={s * 0.08} fill={piece.color} />
          <path
            d={`M${-h * 0.5} ${-s * 0.2}v${s * 0.4}M0 ${-s * 0.2}v${s * 0.4}M${h * 0.5} ${-s * 0.2}v${s * 0.4}`}
            stroke={accent}
            strokeWidth={0.6}
          />
        </>
      );
    case "noodle":
      return (
        <path
          d={`M${-h} 0q${s / 8} ${-h * 0.6} ${s / 4} 0t${s / 4} 0t${s / 4} 0t${s / 4} 0`}
          fill="none"
          stroke={piece.color}
          strokeWidth={Math.max(1.6, s * 0.12)}
          strokeLinecap="round"
        />
      );
    case "bean":
      return (
        <path
          d={`M${-h} 0C${-h} ${-h * 0.7} ${-h * 0.2} ${-h * 0.6} 0 ${-h * 0.25}C${h * 0.2} ${-h * 0.6} ${h} ${-h * 0.7} ${h} 0C${h} ${h * 0.6} ${-h} ${h * 0.6} ${-h} 0Z`}
          fill={piece.color}
        />
      );
    case "shrimp":
      return (
        <>
          <path
            d={`M${h} ${-h * 0.2}A${h} ${h} 0 1 1 ${-h * 0.2} ${-h}`}
            fill="none"
            stroke={piece.color}
            strokeWidth={s * 0.3}
            strokeLinecap="round"
          />
          <path
            d={`M${-h * 0.2} ${-h}l${-h * 0.4} ${-h * 0.3}`}
            stroke={accent}
            strokeWidth={1}
            strokeLinecap="round"
          />
        </>
      );
    case "wedge":
      return (
        <path
          d={`M${-h} ${h * 0.6}Q0 ${-h * 1.4} ${h} ${h * 0.6}Z`}
          fill={piece.color}
          stroke={accent}
          strokeWidth={0.8}
        />
      );
    case "floret":
      return (
        <>
          <rect x={-s * 0.08} y={0} width={s * 0.16} height={h} rx={s * 0.08} fill={accent} />
          <circle cx={-h * 0.4} cy={-h * 0.1} r={h * 0.42} fill={piece.color} />
          <circle cx={h * 0.4} cy={-h * 0.1} r={h * 0.42} fill={piece.color} />
          <circle cx={0} cy={-h * 0.5} r={h * 0.45} fill={piece.color} />
        </>
      );
    case "fillet":
      return (
        <>
          <path
            d={`M${-h} ${-h * 0.15}C${-h} ${-h * 0.75} ${h * 0.6} ${-h * 0.75} ${h} ${-h * 0.2}C${h * 1.1} ${h * 0.5} ${-h * 0.6} ${h * 0.7} ${-h} ${-h * 0.15}Z`}
            fill={piece.color}
          />
          <path
            d={`M${-h * 0.4} ${-h * 0.45}l${h * 0.25} ${h * 0.7}M${0} ${-h * 0.5}l${h * 0.25} ${h * 0.75}M${h * 0.4} ${-h * 0.45}l${h * 0.2} ${h * 0.6}`}
            stroke={accent}
            strokeWidth={1}
            strokeLinecap="round"
          />
        </>
      );
    case "egg":
      return (
        <>
          <path
            d={`M${-h} 0C${-h} ${-h * 0.9} ${h * 0.2} ${-h} ${h * 0.8} ${-h * 0.5}C${h * 1.1} ${h * 0.3} ${h * 0.2} ${h} ${-h * 0.4} ${h * 0.8}C${-h * 0.9} ${h * 0.7} ${-h} ${h * 0.4} ${-h} 0Z`}
            fill="#fffdf6"
            stroke={OUTLINE}
            strokeWidth={0.5}
          />
          <circle r={h * 0.38} fill={piece.color} />
        </>
      );
    case "bread":
      return (
        <>
          <path
            d={`M${-h} ${h}V${-h * 0.3}C${-h} ${-h * 1.1} ${-h * 0.3} ${-h * 1.1} 0 ${-h * 0.75}C${h * 0.3} ${-h * 1.1} ${h} ${-h * 1.1} ${h} ${-h * 0.3}V${h}Z`}
            fill={piece.accent ?? "#c98c4f"}
          />
          <path
            d={`M${-h * 0.8} ${h * 0.82}V${-h * 0.25}C${-h * 0.8} ${-h * 0.85} ${-h * 0.25} ${-h * 0.85} 0 ${-h * 0.55}C${h * 0.25} ${-h * 0.85} ${h * 0.8} ${-h * 0.85} ${h * 0.8} ${-h * 0.25}V${h * 0.82}Z`}
            fill={piece.color}
          />
        </>
      );
  }
}

/**
 * Illustration d'un plat (dessinée pour l'app, sans photo). Décorative quand `label` est
 * absent ; sinon exposée comme image avec ce nom.
 */
export function DishArt({
  spec,
  seed,
  label,
  className = "",
}: {
  spec: DishArtSpec;
  seed: string;
  label?: string;
  className?: string;
}) {
  const layers = layoutDish(spec, seed);
  const clipId = `dish-${seed.replace(/[^a-z0-9]/gi, "")}`;
  const radius = innerRadius(spec.vessel);
  const rectangular = spec.vessel === "board" || spec.vessel === "dish";
  return (
    <svg
      viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}
      className={`block h-auto w-full ${className}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <rect width={ART_WIDTH} height={ART_HEIGHT} fill={spec.backdrop} />
      <circle cx={18} cy={14} r={30} fill="rgba(255,255,255,0.22)" />
      <circle cx={146} cy={110} r={26} fill="rgba(255,255,255,0.16)" />
      <VesselBase vessel={spec.vessel} />
      <defs>
        <filter id={`${clipId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0.6" dy="1.2" stdDeviation="0.7" floodColor="#3c2d1e" floodOpacity="0.28" />
        </filter>
        <clipPath id={clipId}>
          {rectangular ? (
            <rect x={CENTER.x - 54} y={CENTER.y - 36} width={108} height={72} rx={14} />
          ) : (
            <circle cx={CENTER.x} cy={CENTER.y} r={radius + 2} />
          )}
        </clipPath>
      </defs>
      <g clipPath={spec.vessel === "board" ? undefined : `url(#${clipId})`}>
        {layers.map((layer, index) => {
          if (layer.kind === "fill") {
            return (
              <g key={index}>
                {rectangular ? (
                  <rect x={CENTER.x - 54} y={CENTER.y - 33} width={108} height={66} rx={14} fill={layer.color} />
                ) : (
                  <circle cx={CENTER.x} cy={CENTER.y} r={layer.radius} fill={layer.color} />
                )}
                {layer.specks.map((speck, i) => (
                  <circle
                    key={i}
                    cx={rectangular ? CENTER.x + (speck.x - CENTER.x) * 1.35 : speck.x}
                    cy={speck.y}
                    r={layer.texture === "crust" ? 3.2 : 1.1}
                    fill={layer.texture === "crust" ? "rgba(120,60,10,0.28)" : "rgba(255,255,255,0.35)"}
                  />
                ))}
              </g>
            );
          }
          if (layer.kind === "drizzle") {
            return (
              <path
                key={index}
                d={layer.path}
                fill="none"
                stroke={layer.color}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            );
          }
          return (
            <g key={index} filter={`url(#${clipId}-shadow)`}>
              {layer.pieces.map((piece, i) => (
                <g
                  key={i}
                  transform={`translate(${rectangular ? round1(CENTER.x + (piece.x - CENTER.x) * 1.35) : piece.x} ${piece.y}) rotate(${piece.rotation})`}
                >
                  <PieceShape piece={piece} />
                </g>
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

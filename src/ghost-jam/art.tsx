import { useId, type ReactNode } from "react";
import { paint, type Light } from "./palette";

/**
 * The drawings: the stage ghosts, the DJ booth, the fans and the bat. Parts
 * that move have their own class, so _ghost-jam.scss can animate each.
 */

/**
 * Ids for an SVG's gradients, unique per drawing, so copies don't clash. They
 * are used in url(#id) references, so anything but letters, digits, _ and -
 * is stripped. React 19.2's ids (like _r_1_) pass through unchanged; older
 * versions wrapped theirs in punctuation.
 */
const useSvgId = () => useId().replace(/[^\w-]/g, "");

export type Costume = "bow" | "headphones" | "hat";

/** A sheet ghost with a wavy hem, in costume. */
export function Ghost({ costume }: { costume: Costume }) {
  const id = useSvgId();
  const sheet = `gj-sheet-${id}`;
  const shine = `gj-shine-${id}`;
  return (
    <svg className="ghost-jam__ghost" viewBox="0 -24 120 174">
      <defs>
        <linearGradient id={sheet} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfbff" />
          <stop offset="0.7" stopColor="#dfe4fb" />
          <stop offset="1" stopColor="#b9c2ea" />
        </linearGradient>
        <radialGradient id={shine} cx="0.35" cy="0.25" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="ghost-jam__body">
        <path
          fill={`url(#${sheet})`}
          d="M14 72 Q14 14 60 14 Q106 14 106 72 L106 132 Q97 144 88 132 Q79 120 70 132 Q61 144 52 132 Q43 120 34 132 Q25 144 14 132 Z"
        />
        <ellipse cx="46" cy="40" rx="20" ry="14" fill={`url(#${shine})`} />
        <g className="ghost-jam__eyes">
          <ellipse cx="45" cy="64" rx="7.5" ry="10.5" fill="#1a1020" />
          <ellipse cx="75" cy="64" rx="7.5" ry="10.5" fill="#1a1020" />
          <circle cx="47.5" cy="60" r="2.6" fill="#fff" />
          <circle cx="77.5" cy="60" r="2.6" fill="#fff" />
        </g>
        <ellipse className="ghost-jam__mouth" cx="60" cy="90" rx="6.5" ry="8.5" fill="#1a1020" />
        <ellipse cx="33" cy="81" rx="6.5" ry="3.2" fill="#ff8a8a" opacity="0.5" />
        <ellipse cx="87" cy="81" rx="6.5" ry="3.2" fill="#ff8a8a" opacity="0.5" />
        <g className="ghost-jam__costume">{COSTUMES[costume]}</g>
      </g>
      {/* Arms over the sheet, so a raised arm shows against the body. */}
      <ellipse className="ghost-jam__arm ghost-jam__arm--l" cx="12" cy="84" rx="14" ry="8" fill="#eef1fd" stroke="#a9b3e0" strokeWidth="2" />
      <ellipse className="ghost-jam__arm ghost-jam__arm--r" cx="108" cy="84" rx="14" ry="8" fill="#eef1fd" stroke="#a9b3e0" strokeWidth="2" />
    </svg>
  );
}

const COSTUMES: Record<Costume, ReactNode> = {
  bow: (
    <>
      <path d="M36 22 L18 10 L20 34 Z" style={{ fill: paint("pumpkin") }} />
      <path d="M36 22 L54 12 L50 36 Z" style={{ fill: paint("pumpkin") }} />
      <path d="M36 22 L20 34 L24 26 Z M36 22 L50 36 L46 28 Z" fill="#c4520a" />
      <circle cx="36" cy="23" r="5.5" style={{ fill: paint("ember") }} />
    </>
  ),
  headphones: (
    <>
      <path d="M18 62 Q18 6 60 6 Q102 6 102 62" fill="none" stroke="#2a1d36" strokeWidth="7" strokeLinecap="round" />
      <rect x="5" y="50" width="20" height="30" rx="9" style={{ fill: paint("pumpkin") }} />
      <rect x="95" y="50" width="20" height="30" rx="9" style={{ fill: paint("pumpkin") }} />
      <rect className="ghost-jam__led" x="9" y="58" width="5" height="14" rx="2.5" style={{ fill: paint("candle") }} />
      <rect className="ghost-jam__led" x="106" y="58" width="5" height="14" rx="2.5" style={{ fill: paint("candle") }} />
    </>
  ),
  hat: (
    <>
      <path d="M40 24 Q58 -2 64 -22 Q70 -10 84 -6 Q74 0 78 24 Z" fill="#6b3fa0" stroke="#b48cff" strokeWidth="1.5" />
      <path d="M44 16 Q60 12 78 16 L78 22 Q60 18 44 22 Z" style={{ fill: paint("slime") }} />
      <ellipse cx="60" cy="24" rx="36" ry="7" fill="#7d4cba" stroke="#b48cff" strokeWidth="1.5" />
    </>
  ),
};

const CHASE: Light[] = ["pumpkin", "candle", "slime", "moon"];

/** The DJ's booth: two decks and a row of lights that chase while playing. */
export function Booth() {
  const panel = `gj-booth-${useSvgId()}`;
  return (
    <svg className="ghost-jam__booth" viewBox="0 0 240 78">
      <defs>
        <linearGradient id={panel} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1a26" />
          <stop offset="1" stopColor="#120a10" />
        </linearGradient>
      </defs>
      {/* Decks on top, seen at an angle */}
      <rect x="6" y="6" width="228" height="18" rx="5" fill="#3a2531" />
      <ellipse cx="62" cy="15" rx="34" ry="6" fill="#0d0709" />
      <ellipse className="ghost-jam__record" cx="62" cy="15" rx="12" ry="2.5" style={{ fill: paint("pumpkin") }} />
      <ellipse cx="178" cy="15" rx="34" ry="6" fill="#0d0709" />
      <ellipse className="ghost-jam__record" cx="178" cy="15" rx="12" ry="2.5" style={{ fill: paint("moon") }} />
      {/* The front panel */}
      <path d="M0 24 H240 L228 78 H12 Z" fill={`url(#${panel})`} />
      <path d="M0 24 H240" strokeWidth="2" opacity="0.8" style={{ stroke: paint("pumpkin") }} />
      <g className="ghost-jam__chase">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={36 + i * 14} y="40" width="8" height="8" rx="2" style={{ fill: paint(CHASE[i % CHASE.length]) }} />
        ))}
      </g>
      <text x="120" y="68" textAnchor="middle" fontSize="10" fontWeight="800" letterSpacing="4" opacity="0.8" style={{ fill: paint("candle") }}>
        GHOST FM
      </text>
    </svg>
  );
}

/**
 * A fan in the crowd, from behind: a sheet, maybe both arms up, or one arm
 * raised holding a glow stick. Some hold it in the left hand.
 */
export function Fan({ arms, glow, left }: { arms: boolean; glow: Light | null; left: boolean }) {
  return (
    <svg className="ghost-jam__fan-art" viewBox="-22 -34 104 110">
      {glow ? (
        // Mirrored across the body's centre for a left-handed fan.
        <g transform={left ? "translate(60 0) scale(-1 1)" : undefined}>
          <g className="ghost-jam__hand" style={{ color: paint(glow) }}>
            <g transform="rotate(20 56 28)">
              {/* The stick pivots at the hand, so it trails the arm's swing;
                  its halo trails a little further, smearing the light. */}
              <g className="ghost-jam__stick">
                <rect className="ghost-jam__trail" x="49" y="-44" width="20" height="42" rx="10" fill="currentColor" opacity="0.22" />
                <rect x="55" y="-38" width="8" height="32" rx="4" fill="currentColor" />
                <rect x="57" y="-35" width="2.5" height="24" rx="1.25" fill="#fff" opacity="0.65" />
              </g>
              {/* The arm, reaching up to the stick */}
              <ellipse cx="59" cy="11" rx="6" ry="17" />
            </g>
          </g>
        </g>
      ) : arms ? (
        <g className="ghost-jam__fan-arms">
          <ellipse cx="2" cy="20" rx="6" ry="13" transform="rotate(-28 2 20)" />
          <ellipse cx="58" cy="20" rx="6" ry="13" transform="rotate(28 58 20)" />
        </g>
      ) : null}
      {/* The sheet, with the same wavy hem as the ghosts on stage */}
      <path d="M0 40 Q0 0 30 0 Q60 0 60 40 L60 64 Q55 72 50 64 Q45 56 40 64 Q35 72 30 64 Q25 56 20 64 Q15 72 10 64 Q5 56 0 64 Z" />
      {/* Moonlight catching the top of the head */}
      <path d="M4 34 Q6 3 30 3 Q54 3 56 34" fill="none" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: paint("moon") }} />
    </svg>
  );
}

/** A bat, wings beating. */
export function Bat() {
  return (
    <svg className="ghost-jam__bat" viewBox="0 0 64 30">
      <path className="ghost-jam__wing ghost-jam__wing--l" d="M27 13 Q16 2 2 8 Q8 11 7 16 Q12 13 15 18 Q19 14 23 19 Q25 15 28 17 Z" />
      <path className="ghost-jam__wing ghost-jam__wing--r" d="M37 13 Q48 2 62 8 Q56 11 57 16 Q52 13 49 18 Q45 14 41 19 Q39 15 36 17 Z" />
      <path d="M28 9 L29.5 4 L31 8.5 H33 L34.5 4 L36 9 Q38 13 36 18 Q32 23 28 18 Q26 13 28 9 Z" />
      <circle cx="30.4" cy="11.5" r="0.9" style={{ fill: paint("candle") }} />
      <circle cx="33.6" cy="11.5" r="0.9" style={{ fill: paint("candle") }} />
    </svg>
  );
}

/** One item at random. */
export const pick = <T,>(items: readonly T[], rand: () => number = Math.random): T =>
  items[Math.floor(rand() * items.length)];

/**
 * A seeded random generator (Park–Miller), so a "random" layout comes out the
 * same every time, and the server and the browser draw the same one.
 */
export function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

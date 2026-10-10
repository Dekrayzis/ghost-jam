/**
 * True when anything should hold still: the visitor's system setting, or a
 * page-wide pause switch, data-motion="paused" on <html>, which a host site
 * can set from its own control. On its own page the switch is simply never
 * set. The stylesheet's `less-motion` mixin honours the same two signals.
 */
export function lessMotion(): boolean {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.getAttribute("data-motion") === "paused"
  );
}

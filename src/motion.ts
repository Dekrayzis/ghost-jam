/**
 * True when the visitor has asked for less motion in their system settings.
 * Ghost Jam checks it before lighting the wall; the CSS side is the
 * `less-motion` mixin in _tokens.scss.
 */
export function lessMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

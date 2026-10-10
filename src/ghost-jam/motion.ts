// The one file that differs from the portfolio's copy of this folder: there,
// "less motion" is the site's switch (the system setting or its pause
// button). Here it is the visitor's system setting.
export function lessMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

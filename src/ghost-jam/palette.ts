/**
 * The "pumpkin night" palette, by name. The colours themselves live once, in
 * _ghost-jam.scss, which sets each as a custom property (--gj-pumpkin and so
 * on); the drawings and the wall refer to them by name.
 */
export const LIGHTS = ["pumpkin", "ember", "candle", "slime", "moon"] as const;
export type Light = (typeof LIGHTS)[number];

/** A palette colour as a CSS value, for an SVG fill or stroke. */
export const paint = (light: Light) => `var(--gj-${light})`;

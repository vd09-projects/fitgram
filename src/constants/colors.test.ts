import { AllColorSchemas } from "./colors";

/** WCAG 2.x relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// WCAG 1.4.11: a control's boundary needs 3:1 against what it sits next to.
// An input is a raised fill on a surface card, so its edge meets both.
describe.each(Object.entries(AllColorSchemas))("%s", (_name, schema) => {
  const { fieldEdge, raised, surface } = schema.role;

  it("fieldEdge is a 3:1 boundary against raised and surface", () => {
    expect(contrast(fieldEdge, raised)).toBeGreaterThanOrEqual(3);
    expect(contrast(fieldEdge, surface)).toBeGreaterThanOrEqual(3);
  });

  // The set card's ghost placeholder, at 30px. Cleared only at the 3:1
  // large-text threshold (3.43 / 3.46 today), the least headroom in the palette:
  // dim it and the ghost becomes unreadable while every screen test stays green.
  it("textGhost is legible on raised at large-text contrast", () => {
    expect(contrast(schema.role.textGhost, raised)).toBeGreaterThanOrEqual(3);
  });

  // TICKET-019's Today list: deltas and the footer at 12px on surface, so both
  // need 4.5:1. Improved (signal) is the lighter of the pair, but only by
  // 1.34 / 1.27 today — lightness alone does not carry the distinction; the
  // caret and the +/− sign do. This pins the direction so it cannot invert.
  it("signal and textSecondary are legible on surface, signal the lighter", () => {
    expect(contrast(schema.role.signal, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(schema.role.textSecondary, surface)).toBeGreaterThanOrEqual(4.5);
    expect(luminance(schema.role.signal)).toBeGreaterThan(luminance(schema.role.textSecondary));
  });
});

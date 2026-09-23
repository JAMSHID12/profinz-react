/**
 * Turns the configured primary colour (project.branding.primary-color) into the brand
 * palette used by Tailwind (brand-50 ... brand-900), so each client's app looks like theirs.
 */
const SHADES: [number, number][] = [
  // [shade, mix]: negative mixes with white, positive with black, 0 is the colour itself.
  [50, -0.93],
  [100, -0.84],
  [200, -0.68],
  [300, -0.5],
  [400, -0.28],
  [500, -0.1],
  [600, 0],
  [700, 0.18],
  [800, 0.34],
  [900, 0.5],
];

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let value = match[1];
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const number = parseInt(value, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function mix([r, g, b]: [number, number, number], amount: number): [number, number, number] {
  const target = amount < 0 ? 255 : 0;
  const weight = Math.abs(amount);
  return [r, g, b].map((channel) => Math.round(channel + (target - channel) * weight)) as [number, number, number];
}

export function applyBrandColor(hex?: string) {
  const base = hex ? parseHex(hex) : null;
  if (!base) return;
  const root = document.documentElement;
  for (const [shade, amount] of SHADES) {
    const [r, g, b] = mix(base, amount);
    root.style.setProperty(`--brand-${shade}`, `${r} ${g} ${b}`);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', hex ?? '');
}

export function applyFavicon(href?: string) {
  if (!href) return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

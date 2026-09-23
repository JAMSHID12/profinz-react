/** @type {import('tailwindcss').Config} */
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // The brand palette is set at runtime from the client's configured primary colour.
        brand: Object.fromEntries(shades.map((shade) => [shade, `rgb(var(--brand-${shade}) / <alpha-value>)`])),
      },
    },
  },
  plugins: [],
};

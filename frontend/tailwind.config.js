/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sys: {
          blue: '#0071e3',            // Primary Action
          blueHover: '#0066cc',        // Hover State
          blueLight: '#2997ff',       // Light Contrast Variant
          black: '#000000',
          white: '#ffffff',
          lightBg: '#f2f2f7',         // System Gray Background Surface
          darkBg: '#1c1c1e',          // Elevated Dark Background Surface
          ink: '#1d1d1f',            // Primary Dark Ink Typography
          gray: '#6e6e73',            // Secondary Neutral Muted Typography
          borderLight: '#d2d2d7',
          borderDark: '#3a3a3c',
          cardDark: '#272729',       // Graphite Card Background
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        full: '9999px',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary Blue (Tambaram Theme)
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#003B95', // Main Hospital Blue
          700: '#002660',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          DEFAULT: '#F57C00',
          hover: '#E65100',
        },
        // Near-black for headings
        ink: {
          DEFAULT: '#0f1721',
          soft:    '#1e293b',
          muted:   '#475569',
          subtle:  '#94a3b8',
        },
        // Surface colours
        surface: {
          DEFAULT: '#ffffff',
          subtle:  '#f8fafc',
          raised:  '#f1f5f9',
          border:  '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)',
        'card-md': '0 4px 12px 0 rgba(0,0,0,.07), 0 1px 3px -1px rgba(0,0,0,.05)',
        'card-lg': '0 8px 24px 0 rgba(0,0,0,.09), 0 2px 6px -1px rgba(0,0,0,.06)',
      },
    },
  },
  plugins: [],
}

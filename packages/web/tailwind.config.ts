import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0D1B2A',
          mid: '#162436',
          light: '#1E3045',
        },
        brand: {
          DEFAULT: '#F4631E',
          hover: '#E0551A',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        heading: ['Syne', 'sans-serif'],
      },
      borderRadius: {
        input: '8px',
        card: '12px',
        modal: '16px',
      },
    },
  },
  plugins: [],
} satisfies Config

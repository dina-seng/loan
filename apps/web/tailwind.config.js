/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        km: ['"Noto Sans Khmer"', 'Khmer OS', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef7fb',
          100: '#d6ebf5',
          200: '#aed6ea',
          300: '#78b9d8',
          400: '#4197c2',
          500: '#257ba6',
          600: '#1a6188',
          700: '#164d6d',
          800: '#143f59',
          900: '#12354a',
          950: '#0b2333',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 42, 61, 0.08), 0 6px 20px rgba(15, 42, 61, 0.05)',
      },
    },
  },
  plugins: [],
};

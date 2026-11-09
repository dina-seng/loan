export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Khmer"', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef4fb',
          100: '#d4e4f5',
          200: '#a9c9eb',
          300: '#7eade1',
          400: '#5392d7',
          500: '#2d6cb5',
          600: '#1e3a5f',
          700: '#162d4a',
          800: '#0f2035',
          900: '#071320',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
    },
  },
  plugins: [],
};

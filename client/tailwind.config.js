/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Paleta ecologica (verde bosque)
        brand: {
          50: '#f0faf2',
          100: '#dcf3e1',
          200: '#bbe6c6',
          300: '#8ed2a2',
          400: '#58b677',
          500: '#33995a',
          600: '#237c47',
          700: '#1d623a',
          800: '#1a4e31',
          900: '#17402a',
          950: '#082316',
        },
        // Tono tierra/hoja para acentos calidos
        earth: {
          100: '#f7f3e8',
          300: '#dcc9a0',
          500: '#b08a4f',
          700: '#7c5d2f',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(8,35,22,0.1), 0 1px 2px rgba(8,35,22,0.06)',
        soft: '0 18px 40px -16px rgba(8,35,22,0.35)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};

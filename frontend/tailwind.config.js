/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#020617',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569'
        }
      },
      animation: {
        shake: 'shake 0.45s ease-in-out'
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%':      { transform: 'translateX(-10px)' },
          '30%':      { transform: 'translateX(9px)' },
          '45%':      { transform: 'translateX(-7px)' },
          '60%':      { transform: 'translateX(6px)' },
          '75%':      { transform: 'translateX(-4px)' },
          '90%':      { transform: 'translateX(2px)' }
        }
      }
    }
  },
  plugins: []
}

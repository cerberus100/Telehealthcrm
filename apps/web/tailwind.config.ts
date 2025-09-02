import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0F8FC',
          100: '#D9EFF9',
          200: '#B3DEF3',
          300: '#80C7EA',
          400: '#4DAFE0',
          500: '#1B98D6',
          600: '#007DB8',
          700: '#00679A',
          800: '#00547F',
          900: '#003A57'
        }
      }
    }
  },
  plugins: []
} satisfies Config

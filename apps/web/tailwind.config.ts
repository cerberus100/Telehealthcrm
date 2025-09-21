import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Eudaura Brand Colors (Slate/Green with Amber Accents)
        brand: {
          50: '#F8FAFC',   // Light slate
          100: '#F1F5F9',  // Lighter slate
          200: '#E2E8F0',  // Light gray
          300: '#CBD5E1',  // Medium gray
          400: '#94A3B8',  // Medium slate
          500: '#64748B',  // Base slate
          600: '#475569',  // Primary brand color (slate-600)
          700: '#334155',  // Darker slate
          800: '#1E293B',  // Dark slate
          900: '#0F172A'   // Darkest slate
        },
        // Amber accent colors for focus states and highlights
        accent: {
          50: '#FFFBEB',   // Light amber
          100: '#FEF3C7',  // Lighter amber
          200: '#FDE68A',  // Light amber
          300: '#FCD34D',  // Medium amber
          400: '#FBBF24',  // Amber-400
          500: '#F59E0B',  // Primary accent (amber-500)
          600: '#D97706',  // Darker amber
          700: '#B45309',  // Dark amber
          800: '#92400E',  // Darkest amber
          900: '#78350F'   // Deep amber
        }
      }
    }
  },
  plugins: []
} satisfies Config

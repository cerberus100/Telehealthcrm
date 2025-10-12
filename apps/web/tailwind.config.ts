import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Eudaura Brand Colors - Official Logo Palette Only
        primary: '#556B4F',     // Sage - primary surfaces, buttons
        secondary: '#2E3B2D',   // Olive ink - headings, text, foreground  
        accent: '#B8964A',      // Gold (WCAG AA compliant) - accents, glow, CTA hover
        background: '#F7F5EF',  // Offwhite neutral - backgrounds, panels
        foreground: '#2E3B2D',  // Ink text - main text (same as olive)
        
        // Direct color aliases (no grays allowed)
        sage: '#556B4F',
        olive: '#2E3B2D', 
        gold: '#B8964A',        // Updated for WCAG AA compliance (4.5:1 contrast)
        goldOriginal: '#C7A867', // Original gold (decorative use only, not for text)
        offwhite: '#F7F5EF',
        ink: '#2E3B2D',
      }
    }
  },
  plugins: []
} satisfies Config

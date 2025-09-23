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
        accent: '#C7A867',      // Gold - accents, glow, CTA hover
        background: '#F7F5EF',  // Offwhite neutral - backgrounds, panels
        foreground: '#2E3B2D',  // Ink text - main text (same as olive)
        
        // Direct color aliases (no grays allowed)
        sage: '#556B4F',
        olive: '#2E3B2D', 
        gold: '#C7A867',
        offwhite: '#F7F5EF',
        ink: '#2E3B2D',
      }
    }
  },
  plugins: []
} satisfies Config

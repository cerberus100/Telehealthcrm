/**
 * Eudaura Brand Theme - Single Source of Truth
 * Based on official logo colors
 */

export const EudauraTheme = {
  // Primary brand colors from logo
  colors: {
    primary: '#556B4F',     // Sage - background base, primary surfaces
    secondary: '#2E3B2D',   // Olive - deep ink, headings, foreground text  
    accent: '#C7A867',      // Gold - accent, buttons, aura glow
    background: '#F7F5EF',  // Offwhite - backgrounds, panels, neutral surfaces
    foreground: '#2E3B2D',  // Ink - main text (same as olive for consistency)
  },
  
  // Semantic color mappings
  semantic: {
    button: {
      primary: '#556B4F',     // Sage for primary buttons
      secondary: '#C7A867',   // Gold for accent buttons
      text: '#F7F5EF',        // Offwhite text on buttons
    },
    text: {
      primary: '#2E3B2D',     // Olive for headings and important text
      secondary: '#556B4F',   // Sage for secondary text
      muted: '#A69B7F',       // Medium sage for muted text
      inverse: '#F7F5EF',     // Offwhite for text on dark backgrounds
    },
    background: {
      primary: '#F7F5EF',     // Offwhite for main backgrounds
      secondary: '#F0EDE5',   // Lighter offwhite for cards/panels
      accent: '#556B4F',      // Sage for accent backgrounds
      dark: '#2E3B2D',        // Olive for dark sections
    },
    border: {
      light: '#E8E3D7',       // Light neutral for subtle borders
      medium: '#D4CDB8',      // Medium neutral for visible borders
      accent: '#C7A867',      // Gold for accent borders
    }
  }
} as const

// CSS Custom Properties for global usage
export const cssVariables = `
  :root {
    --color-primary: #556B4F;
    --color-secondary: #2E3B2D;
    --color-accent: #C7A867;
    --color-background: #F7F5EF;
    --color-foreground: #2E3B2D;
    
    --color-button-primary: #556B4F;
    --color-button-secondary: #C7A867;
    --color-button-text: #F7F5EF;
    
    --color-text-primary: #2E3B2D;
    --color-text-secondary: #556B4F;
    --color-text-muted: #A69B7F;
    --color-text-inverse: #F7F5EF;
    
    --color-bg-primary: #F7F5EF;
    --color-bg-secondary: #F0EDE5;
    --color-bg-accent: #556B4F;
    --color-bg-dark: #2E3B2D;
    
    --color-border-light: #E8E3D7;
    --color-border-medium: #D4CDB8;
    --color-border-accent: #C7A867;
  }
`

export type EudauraColors = typeof EudauraTheme.colors
export type EudauraSemantic = typeof EudauraTheme.semantic

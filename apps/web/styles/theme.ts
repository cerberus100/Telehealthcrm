/**
 * Eudaura Brand Theme - Single Source of Truth
 * Exact colors from official logo
 */

export const colors = {
  sage: "#556B4F",      // Primary surfaces, buttons
  olive: "#2E3B2D",     // Headings, text, foreground  
  gold: "#C7A867",      // Accents, glow, CTA hover
  offwhite: "#F7F5EF",  // Backgrounds, panels
  ink: "#2E3B2D",       // Main text (same as olive)
} as const

// Semantic color mappings for consistent usage
export const theme = {
  colors: {
    primary: colors.sage,
    secondary: colors.olive,
    accent: colors.gold,
    background: colors.offwhite,
    foreground: colors.ink,
  },
  
  // Component-specific mappings
  button: {
    primary: {
      bg: colors.sage,
      text: colors.offwhite,
      hover: colors.olive,
      focus: colors.gold,
    },
    secondary: {
      bg: 'transparent',
      text: colors.olive,
      border: colors.olive,
      hover: colors.sage,
      focus: colors.gold,
    }
  },
  
  text: {
    primary: colors.ink,
    secondary: colors.sage,
    muted: '#A69B7F',
    inverse: colors.offwhite,
  },
  
  background: {
    primary: colors.offwhite,
    secondary: '#F0EDE5',
    accent: colors.sage,
    dark: colors.olive,
  },
  
  border: {
    light: '#E8E3D7',
    medium: '#D4CDB8', 
    accent: colors.gold,
  }
} as const

// CSS Custom Properties string for global usage
export const cssVariables = `
:root {
  --eudaura-sage: ${colors.sage};
  --eudaura-olive: ${colors.olive};
  --eudaura-gold: ${colors.gold};
  --eudaura-offwhite: ${colors.offwhite};
  --eudaura-ink: ${colors.ink};
  
  --color-primary: ${colors.sage};
  --color-secondary: ${colors.olive};
  --color-accent: ${colors.gold};
  --color-background: ${colors.offwhite};
  --color-foreground: ${colors.ink};
}
`

export type EudauraColors = typeof colors
export type EudauraTheme = typeof theme

// Eudaura Design System - Healthcare Branding
// Ensures consistent styling across all user-facing components

export const DESIGN_TOKENS = {
  // Eudaura Brand Color Palette (Slate/Green with Amber Accents)
  colors: {
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
    },
    success: {
      50: '#F0FDF4',
      500: '#22C55E',  // Emerald-500
      600: '#16A34A',  // Emerald-600
      700: '#15803D'   // Emerald-700
    },
    warning: {
      50: '#FFFBEB',
      500: '#F59E0B',  // Amber-500
      600: '#D97706',  // Amber-600
      700: '#B45309'   // Amber-700
    },
    error: {
      50: '#FEF2F2',
      500: '#EF4444',  // Red-500
      600: '#DC2626',  // Red-600
      700: '#B91C1C'   // Red-700
    },
    info: {
      50: '#EFF6FF',
      500: '#3B82F6',  // Blue-500
      600: '#2563EB',  // Blue-600
      700: '#1D4ED8'   // Blue-700
    },
    neutral: {
      0: '#FFFFFF',
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      900: '#0F172A'
    }
  },
  
  // Spacing (8pt system)
  spacing: {
    xs: '0.5rem',    // 8px
    sm: '0.75rem',   // 12px  
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem'    // 48px
  },
  
  // Typography
  typography: {
    h1: 'text-2xl font-bold text-slate-900',
    h2: 'text-xl font-semibold text-slate-900', 
    h3: 'text-lg font-medium text-slate-900',
    body: 'text-sm text-slate-700',
    caption: 'text-xs text-slate-500'
  },
  
  // Component Styles
  components: {
    // Primary button (slate-600 with amber accent)
    buttonPrimary: 'bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed',

    // Secondary button (outline)
    buttonSecondary: 'bg-white border border-brand-300 text-brand-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500',

    // Success button (emerald)
    buttonSuccess: 'bg-success-500 hover:bg-success-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-success-500 disabled:opacity-50',

    // Danger button (red)
    buttonDanger: 'bg-error-500 hover:bg-error-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-500',

    // Warning button (amber)
    buttonWarning: 'bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500',

    // Input field
    input: 'block w-full border border-brand-300 rounded-md shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-brand-50 disabled:text-brand-500',

    // Card container
    card: 'bg-white rounded-lg shadow border border-brand-200 p-6',

    // Page container
    pageContainer: 'max-w-7xl mx-auto px-4 py-6 space-y-6',

    // Page header
    pageHeader: 'flex items-center justify-between mb-6',
    pageTitle: 'text-2xl font-bold text-brand-900',
    pageSubtitle: 'text-sm text-brand-500 mt-1',

    // Status pills with Eudaura colors
    statusPending: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-100 text-accent-800',
    statusApproved: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800',
    statusDeclined: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-error-100 text-error-800',
    statusInfo: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-info-100 text-info-800',

    // Alert messages
    alertSuccess: 'p-3 bg-success-50 border border-success-200 text-success-800 rounded-md text-sm',
    alertWarning: 'p-3 bg-accent-50 border border-accent-200 text-accent-800 rounded-md text-sm',
    alertError: 'p-3 bg-error-50 border border-error-200 text-error-800 rounded-md text-sm',
    alertInfo: 'p-3 bg-info-50 border border-info-200 text-info-800 rounded-md text-sm',

    // Navigation with brand colors
    navLink: 'text-brand-600 hover:text-brand-900 px-3 py-2 rounded-md text-sm font-medium transition-colors',
    navLinkActive: 'text-brand-700 bg-brand-50 px-3 py-2 rounded-md text-sm font-medium',

    // Tables
    tableHeader: 'bg-brand-50 text-left text-xs font-medium text-brand-500 uppercase tracking-wider px-6 py-3',
    tableCell: 'px-6 py-4 whitespace-nowrap text-sm text-brand-900',
    tableRow: 'hover:bg-brand-50 cursor-pointer transition-colors'
  }
}

// Utility functions for consistent styling
export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ')
}

export const getStatusStyle = (status: string) => {
  const statusMap: Record<string, string> = {
    'PENDING': DESIGN_TOKENS.components.statusPending,
    'APPROVED': DESIGN_TOKENS.components.statusApproved,
    'DECLINED': DESIGN_TOKENS.components.statusDeclined,
    'PASSED': DESIGN_TOKENS.components.statusApproved,
    'FAILED': DESIGN_TOKENS.components.statusDeclined,
    'ACTIVE': DESIGN_TOKENS.components.statusInfo,
    'INACTIVE': DESIGN_TOKENS.components.statusDeclined
  }
  
  return statusMap[status.toUpperCase()] || DESIGN_TOKENS.components.statusInfo
}

export const getAlertStyle = (type: 'success' | 'warning' | 'error' | 'info') => {
  const alertMap = {
    success: DESIGN_TOKENS.components.alertSuccess,
    warning: DESIGN_TOKENS.components.alertWarning,
    error: DESIGN_TOKENS.components.alertError,
    info: DESIGN_TOKENS.components.alertInfo
  }
  
  return alertMap[type]
}

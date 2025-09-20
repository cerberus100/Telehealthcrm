// Teleplatform Design System - McKesson Blue
// Ensures consistent styling across all user-facing components

export const DESIGN_TOKENS = {
  // McKesson Blue Color Palette
  colors: {
    brand: {
      50: '#F0F8FC',
      100: '#D9EFF9', 
      200: '#B3DEF3',
      300: '#80C7EA',
      400: '#4DAFE0',
      500: '#1B98D6',
      600: '#007DB8', // Primary brand color
      700: '#00679A',
      800: '#00547F',
      900: '#003A57'
    },
    semantic: {
      success: '#16A34A',
      warning: '#F59E0B', 
      error: '#DC2626',
      info: '#2563EB'
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
    // Primary button (brand-600)
    buttonPrimary: 'bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed',
    
    // Secondary button (outline)
    buttonSecondary: 'bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500',
    
    // Success button (green)
    buttonSuccess: 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50',
    
    // Danger button (red)
    buttonDanger: 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500',
    
    // Input field
    input: 'block w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-500',
    
    // Card container
    card: 'bg-white rounded-lg shadow border border-slate-200 p-6',
    
    // Page container
    pageContainer: 'max-w-7xl mx-auto px-4 py-6 space-y-6',
    
    // Page header
    pageHeader: 'flex items-center justify-between mb-6',
    pageTitle: 'text-2xl font-bold text-slate-900',
    pageSubtitle: 'text-sm text-slate-500 mt-1',
    
    // Status pills
    statusPending: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800',
    statusApproved: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800',
    statusDeclined: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800',
    statusInfo: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
    
    // Alert messages
    alertSuccess: 'p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm',
    alertWarning: 'p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-sm',
    alertError: 'p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm',
    alertInfo: 'p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-sm',
    
    // Navigation
    navLink: 'text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md text-sm font-medium transition-colors',
    navLinkActive: 'text-brand-700 bg-brand-50 px-3 py-2 rounded-md text-sm font-medium',
    
    // Tables
    tableHeader: 'bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3',
    tableCell: 'px-6 py-4 whitespace-nowrap text-sm text-slate-900',
    tableRow: 'hover:bg-slate-50 cursor-pointer transition-colors'
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

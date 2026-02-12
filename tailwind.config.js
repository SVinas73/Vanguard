/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Paleta profesional personalizada
      colors: {
        // Fondo principal - gris muy oscuro pero no negro puro
        background: {
          DEFAULT: '#0f1117',
          secondary: '#161921',
          tertiary: '#1c1f26',
        },
        // Superficies (cards, modals, etc)
        surface: {
          DEFAULT: '#1c1f26',
          hover: '#242830',
          active: '#2a2e38',
          border: '#2e323d',
        },
        // Color de acento principal - Azul profesional
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Texto
        content: {
          DEFAULT: '#f8fafc',
          secondary: '#94a3b8',
          tertiary: '#64748b',
          muted: '#475569',
        },
        // Estados
        success: {
          DEFAULT: '#22c55e',
          muted: '#22c55e20',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: '#f59e0b20',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: '#ef444420',
        },
        info: {
          DEFAULT: '#3b82f6',
          muted: '#3b82f620',
        },
      },
      // Sombras sutiles
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.3)',
        'medium': '0 4px 16px -4px rgba(0, 0, 0, 0.4)',
        'large': '0 8px 32px -8px rgba(0, 0, 0, 0.5)',
        'inner-soft': 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
      },
      // Border radius consistente
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      // Tipografía
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      // Animaciones suaves
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
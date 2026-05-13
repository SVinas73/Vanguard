/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ============================================
      // PROFESSIONAL / EXECUTIVE COLOR PALETTE
      // Muted, sophisticated tones — no neon
      // ============================================
      colors: {
        // Backgrounds — warm dark grays instead of pure black
        background: {
          DEFAULT: '#111318',
          secondary: '#171a21',
          tertiary: '#1d2028',
        },
        // Surfaces — subtle warm undertone
        surface: {
          DEFAULT: '#1d2028',
          hover: '#252830',
          active: '#2c2f38',
          border: '#323640',
        },
        // Accent — refined steel blue (less saturated than default blue)
        accent: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#1a2e44',
          950: '#102a43',
        },
        // Text — neutral grays
        content: {
          DEFAULT: '#e8ecf1',
          secondary: '#8b95a5',
          tertiary: '#636d7e',
          muted: '#4a5468',
        },
        // Status colors — muted professional versions
        success: {
          DEFAULT: '#3d9a5f',
          muted: 'rgba(61, 154, 95, 0.12)',
        },
        warning: {
          DEFAULT: '#c8872e',
          muted: 'rgba(200, 135, 46, 0.12)',
        },
        danger: {
          DEFAULT: '#c94444',
          muted: 'rgba(201, 68, 68, 0.12)',
        },
        info: {
          DEFAULT: '#4a7fb5',
          muted: 'rgba(74, 127, 181, 0.12)',
        },

        // ============================================
        // Override Tailwind default colors to be MORE MUTED
        // This transforms all existing component usage automatically
        // ============================================
        slate: {
          50: '#f5f7fa',
          100: '#e8ecf1',
          200: '#d1d8e2',
          300: '#b0bac8',
          400: '#8b95a5',
          500: '#636d7e',
          600: '#4a5468',
          700: '#353d4d',
          800: '#232833',
          900: '#181c25',
          950: '#111318',
        },
        blue: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#6b8baa',
          500: '#4a7fb5',
          600: '#3b6a99',
          700: '#2d5480',
          800: '#243b53',
          900: '#1a2e44',
          950: '#102a43',
        },
        emerald: {
          50: '#f0f9f4',
          100: '#d1f0df',
          200: '#a3e0bf',
          300: '#6fcc99',
          400: '#4aaa73',
          500: '#3d9a5f',
          600: '#2f7d4c',
          700: '#26653e',
          800: '#1e4f31',
          900: '#173b26',
          950: '#0d2618',
        },
        red: {
          50: '#fdf5f5',
          100: '#f8dada',
          200: '#f0b0b0',
          300: '#e08080',
          400: '#cc5555',
          500: '#c94444',
          600: '#a83636',
          700: '#872a2a',
          800: '#661f1f',
          900: '#4d1717',
          950: '#330f0f',
        },
        amber: {
          50: '#fdf8f0',
          100: '#f8ead0',
          200: '#f0d4a0',
          300: '#e0b56a',
          400: '#cc9a40',
          500: '#c8872e',
          600: '#a66d24',
          700: '#84561c',
          800: '#634015',
          900: '#4d3110',
          950: '#33200a',
        },
        cyan: {
          50: '#f0f7fa',
          100: '#d3e8f0',
          200: '#a8d1e0',
          300: '#78b5c8',
          400: '#5099aa',
          500: '#3d8899',
          600: '#316e7d',
          700: '#275762',
          800: '#1e4149',
          900: '#163133',
          950: '#0e2022',
        },
        purple: {
          50: '#f5f3f8',
          100: '#e0dae8',
          200: '#c4b5d4',
          300: '#a38dbb',
          400: '#836ba0',
          500: '#6b5488',
          600: '#564470',
          700: '#433558',
          800: '#312840',
          900: '#221c2e',
          950: '#16111f',
        },
        violet: {
          50: '#f4f3f8',
          100: '#dddae8',
          200: '#bdb5d0',
          300: '#9a8db5',
          400: '#7a6b98',
          500: '#635480',
          600: '#504468',
          700: '#3e3552',
          800: '#2e283e',
          900: '#201c2c',
          950: '#14111d',
        },
        orange: {
          50: '#fdf6f0',
          100: '#f8e4d0',
          200: '#f0c8a0',
          300: '#e0a56a',
          400: '#cc8840',
          500: '#b87330',
          600: '#965d26',
          700: '#75481e',
          800: '#573516',
          900: '#3f2710',
          950: '#2a190a',
        },
        green: {
          50: '#f0f9f4',
          100: '#d1f0df',
          200: '#a3e0bf',
          300: '#6fcc99',
          400: '#4aaa73',
          500: '#3d9a5f',
          600: '#2f7d4c',
          700: '#26653e',
          800: '#1e4f31',
          900: '#173b26',
          950: '#0d2618',
        },
        indigo: {
          // Stripe-style indigo — color de marca principal del rediseño.
          // Vibrante pero no neón. Único acento "vivo" en toda la app.
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        pink: {
          50: '#f8f3f5',
          100: '#e8d8df',
          200: '#d0b0bf',
          300: '#b5859e',
          400: '#986080',
          500: '#804a68',
          600: '#683c55',
          700: '#503042',
          800: '#3a2432',
          900: '#281a24',
          950: '#1a1018',
        },
        teal: {
          50: '#f0f8f7',
          100: '#d1ede8',
          200: '#a3dbd0',
          300: '#70c4b3',
          400: '#48a896',
          500: '#3a9280',
          600: '#2e7668',
          700: '#245c52',
          800: '#1c463e',
          900: '#14332e',
          950: '#0d221f',
        },
        yellow: {
          50: '#fdf9f0',
          100: '#f8efd0',
          200: '#f0dea0',
          300: '#e0c56a',
          400: '#ccaf40',
          500: '#b89b30',
          600: '#967e26',
          700: '#75631e',
          800: '#574a16',
          900: '#3f3610',
          950: '#2a240a',
        },
      },

      // Shadows — subtle, no colored glows
      boxShadow: {
        'soft': '0 1px 4px -1px rgba(0, 0, 0, 0.2)',
        'medium': '0 3px 12px -3px rgba(0, 0, 0, 0.25)',
        'large': '0 6px 24px -6px rgba(0, 0, 0, 0.3)',
        'inner-soft': 'inset 0 1px 2px rgba(0, 0, 0, 0.15)',
      },

      // Consistent border radius
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },

      // Typography — professional system fonts
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },

      // Smooth animations
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
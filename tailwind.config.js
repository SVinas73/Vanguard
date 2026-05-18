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
      // VANGUARD — Executive professional palette
      // Single brand accent: steel blue.
      // Status muted (pastel). No neon.
      // ============================================
      colors: {
        background: {
          DEFAULT: '#111318',
          secondary: '#171a21',
          tertiary: '#1d2028',
        },
        surface: {
          DEFAULT: '#1d2028',
          hover: '#252830',
          active: '#2c2f38',
          border: '#323640',
        },
        // Brand — steel blue (único acento "vivo")
        accent: {
          50:  '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#4a7fb5',
          700: '#3b6a99',
          800: '#2d5480',
          900: '#243b53',
          950: '#102a43',
        },
        content: {
          DEFAULT: '#e8ecf1',
          secondary: '#8b95a5',
          tertiary: '#636d7e',
          muted: '#4a5468',
        },
        // Muted pastel status — same intensity as badges
        success: { DEFAULT: '#9ec9b1', muted: 'rgba(143,196,165,0.06)', ring: 'rgba(143,196,165,0.18)' },
        warning: { DEFAULT: '#d6b97a', muted: 'rgba(212,178,112,0.06)', ring: 'rgba(212,178,112,0.18)' },
        danger:  { DEFAULT: '#dfa6a6', muted: 'rgba(214,148,148,0.06)', ring: 'rgba(214,148,148,0.18)' },
        info:    { DEFAULT: '#9fb3c8', muted: 'rgba(74,127,181,0.06)',  ring: 'rgba(74,127,181,0.20)' },

        // ============================================
        // Tailwind defaults overridden so the existing
        // codebase keeps working as-is (slate, blue, etc.)
        // ============================================
        slate: {
          50: '#f5f7fa', 100: '#e8ecf1', 200: '#d1d8e2', 300: '#b0bac8',
          400: '#8b95a5', 500: '#636d7e', 600: '#4a5468', 700: '#353d4d',
          800: '#232833', 900: '#181c25', 950: '#111318',
        },
        // blue → steel blue (so existing bg-blue-* / text-blue-* class usage maps to brand)
        blue: {
          50:  '#f0f4f8', 100: '#d9e2ec', 200: '#bcccdc', 300: '#9fb3c8',
          400: '#829ab1', 500: '#627d98', 600: '#4a7fb5', 700: '#3b6a99',
          800: '#2d5480', 900: '#243b53', 950: '#102a43',
        },
        // indigo → also steel blue, since brand is now unified
        indigo: {
          50:  '#f0f4f8', 100: '#d9e2ec', 200: '#bcccdc', 300: '#9fb3c8',
          400: '#829ab1', 500: '#4a7fb5', 600: '#4a7fb5', 700: '#3b6a99',
          800: '#2d5480', 900: '#243b53', 950: '#102a43',
        },
        // Status families collapsed to muted pastels
        emerald: { 50:'#eef4ef', 100:'#dde9e0', 200:'#bcd3c3', 300:'#9ec9b1',
                   400:'#9ec9b1', 500:'#7fb597', 600:'#5e9577', 700:'#48745d',
                   800:'#385948', 900:'#2a4336', 950:'#1a2922' },
        green:   { 50:'#eef4ef', 100:'#dde9e0', 200:'#bcd3c3', 300:'#9ec9b1',
                   400:'#9ec9b1', 500:'#7fb597', 600:'#5e9577', 700:'#48745d',
                   800:'#385948', 900:'#2a4336', 950:'#1a2922' },
        amber:   { 50:'#f7f1e4', 100:'#efe2c8', 200:'#dfc695', 300:'#d6b97a',
                   400:'#d6b97a', 500:'#bf9d56', 600:'#9c7e3f', 700:'#7a6230',
                   800:'#5a4823', 900:'#3f3219', 950:'#2a2110' },
        yellow:  { 50:'#f7f1e4', 100:'#efe2c8', 200:'#dfc695', 300:'#d6b97a',
                   400:'#d6b97a', 500:'#bf9d56', 600:'#9c7e3f', 700:'#7a6230',
                   800:'#5a4823', 900:'#3f3219', 950:'#2a2110' },
        red:     { 50:'#f7eaea', 100:'#efd1d1', 200:'#e3b6b6', 300:'#dfa6a6',
                   400:'#dfa6a6', 500:'#c98989', 600:'#a86b6b', 700:'#874f4f',
                   800:'#653a3a', 900:'#4a2a2a', 950:'#311c1c' },
        // Decorative tones drained — purple/violet/pink/orange/cyan/teal map to neutrals
        purple:  { 50:'#f0f1f5', 100:'#dde0e8', 200:'#c3c7d4', 300:'#a3a8bb',
                   400:'#838aa0', 500:'#6b7188', 600:'#565b70', 700:'#434757',
                   800:'#31343f', 900:'#22242d', 950:'#16171e' },
        violet:  { 50:'#f0f1f5', 100:'#dde0e8', 200:'#c3c7d4', 300:'#a3a8bb',
                   400:'#838aa0', 500:'#6b7188', 600:'#565b70', 700:'#434757',
                   800:'#31343f', 900:'#22242d', 950:'#16171e' },
        pink:    { 50:'#f5eef0', 100:'#e7d6dc', 200:'#d4b3bc', 300:'#bd909c',
                   400:'#a0727f', 500:'#825b68', 600:'#684854', 700:'#503842',
                   800:'#3a282f', 900:'#281c20', 950:'#181114' },
        orange:  { 50:'#f7eee4', 100:'#eed8c2', 200:'#dfb98e', 300:'#cf9b62',
                   400:'#bb803f', 500:'#9c6a33', 600:'#7c5429', 700:'#5e3f1f',
                   800:'#442d17', 900:'#2f1f10', 950:'#1f140b' },
        cyan:    { 50:'#eef2f5', 100:'#d8e0e8', 200:'#b6c2cf', 300:'#92a4b5',
                   400:'#728699', 500:'#5b6c7c', 600:'#465563', 700:'#36414b',
                   800:'#272e36', 900:'#1a1f24', 950:'#10141a' },
        teal:    { 50:'#edf3f1', 100:'#d4e0db', 200:'#b0c8c0', 300:'#8aada2',
                   400:'#6a9286', 500:'#54776c', 600:'#425e54', 700:'#324840',
                   800:'#243430', 900:'#192522', 950:'#101816' },
      },

      boxShadow: {
        'soft':        '0 1px 4px -1px rgba(0, 0, 0, 0.20)',
        'medium':      '0 3px 12px -3px rgba(0, 0, 0, 0.25)',
        'large':       '0 6px 24px -6px rgba(0, 0, 0, 0.30)',
        'inner-soft':  'inset 0 1px 2px rgba(0, 0, 0, 0.15)',
      },

      borderRadius: {
        'sm':      '6px',
        'DEFAULT': '8px',
        'md':      '10px',
        'lg':      '12px',
        'xl':      '16px',
        '2xl':     '20px',
      },

      fontSize: {
        'xs':   ['0.8125rem', { lineHeight: '1.15rem' }],
        'sm':   ['0.9375rem', { lineHeight: '1.375rem' }],
        'base': ['1rem',      { lineHeight: '1.5rem' }],
        'lg':   ['1.125rem',  { lineHeight: '1.625rem' }],
        'xl':   ['1.25rem',   { lineHeight: '1.75rem' }],
        '2xl':  ['1.5rem',    { lineHeight: '2rem' }],
        '3xl':  ['1.875rem',  { lineHeight: '2.25rem' }],
        '4xl':  ['2.25rem',   { lineHeight: '2.5rem' }],
        '5xl':  ['3rem',      { lineHeight: '1' }],
        '6xl':  ['3.75rem',   { lineHeight: '1' }],
      },

      fontFamily: {
        sans: ['Public Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },

      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(8px)' },  '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

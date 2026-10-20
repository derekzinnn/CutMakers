import type { Config } from 'tailwindcss'

/**
 * Tema vindo do preset shadcn bfDpIkWg4.
 *
 * O preset é nativo de Tailwind v4, onde `@theme` liga as CSS variables às
 * utilities sozinho. Aqui (v3.4) a ligação é explícita. As variáveis são valores
 * oklch COMPLETOS, então entram como `var(--x)` puro — sem envelopar em hsl(),
 * que é o padrão do shadcn antigo e produziria cor inválida.
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          foreground: 'var(--brand-foreground)',
          soft: 'var(--brand-soft)',
          border: 'var(--brand-border)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          subtle: 'var(--surface-subtle)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
          border: 'var(--success-border)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
          border: 'var(--warning-border)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      fontFamily: {
        // Fontes do preset (substituem DM Sans + Syne)
        sans: ['Nunito Sans Variable', 'Nunito Sans', 'sans-serif'],
        heading: ['Noto Sans Variable', 'Noto Sans', 'sans-serif'],
      },
      borderRadius: {
        // Escala derivada do --radius do preset (0.625rem = 10px),
        // substituindo o esquema fixo 8/12/16px
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config

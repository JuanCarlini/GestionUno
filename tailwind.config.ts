import type { Config } from "tailwindcss";

// all in fixtures is set to tailwind v3 as interims solutions

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			// Los cuatro roles de cada estado están explicados en globals.css.
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))',
  				tint: 'hsl(var(--destructive-tint))',
  				ink: 'hsl(var(--destructive-ink))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))',
  				tint: 'hsl(var(--success-tint))',
  				ink: 'hsl(var(--success-ink))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))',
  				tint: 'hsl(var(--warning-tint))',
  				ink: 'hsl(var(--warning-ink))'
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  				foreground: 'hsl(var(--info-foreground))',
  				tint: 'hsl(var(--info-tint))',
  				ink: 'hsl(var(--info-ink))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			// No hay familia `chart`: los gráficos tienen su propia paleta en
  			// views/reportes/paleta.css (--rep-serie-*), validada aparte contra el fondo
  			// de la card y para daltonismo. Las --chart-1..5 que venían de shadcn no las
  			// usaba nadie y eran una segunda paleta de gráficos en discordia.
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		fontSize: {
  			// El tracking es específico del tamaño: un solo valor para toda la escala está
  			// mal en algún lado. Los títulos grandes se cierran —al crecer, las letras se
  			// leen demasiado separadas— y el texto chico se abre un poco para que respire.
  			// Cuerpo (sm, base, lg) queda en cero: ahí el default de Inter ya está bien.
  			// Tamaño y line-height son los de Tailwind, intactos: esto solo agrega tracking.
  			xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
  			xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
  			'2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.0125em' }],
  			'3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
  			'4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em' }]
  		},
  		borderRadius: {
  			// xl entra a la escala para que el recuadro del logo en el login siga a
  			// --radius como todo lo demás; suelto, rounded-xl era un 0.75rem clavado que
  			// un cambio de radio de marca se habría dejado atrás.
  			xl: 'calc(var(--radius) + 4px)',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        brand: {
          50: "var(--mc-primary-light, #f4f7ff)",
          100: "var(--mc-primary-border, #e8efff)",
          200: "#d5e3ff",
          300: "#b4cdff",
          400: "#84aaff",
          500: "var(--mc-primary, #4b7cfb)",
          600: "var(--mc-primary, #2559eb)",
          700: "var(--mc-primary-hover, #1c44d3)",
          800: "#1c37ab",
          900: "#1c3287",
          950: "#111d54",
        },
        tealish: {
          50: "var(--mc-secondary-light, #f0fdfa)",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "var(--mc-secondary, #14b8a6)",
          600: "var(--mc-secondary-hover, #0d9488)",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
        neutral: {
          50: "rgb(var(--neutral-50) / <alpha-value>)",
          100: "rgb(var(--neutral-100) / <alpha-value>)",
          200: "rgb(var(--neutral-200) / <alpha-value>)",
          300: "rgb(var(--neutral-300) / <alpha-value>)",
          400: "rgb(var(--neutral-400) / <alpha-value>)",
          500: "rgb(var(--neutral-500) / <alpha-value>)",
          600: "rgb(var(--neutral-600) / <alpha-value>)",
          700: "rgb(var(--neutral-700) / <alpha-value>)",
          800: "rgb(var(--neutral-800) / <alpha-value>)",
          900: "rgb(var(--neutral-900) / <alpha-value>)",
          950: "rgb(var(--neutral-950) / <alpha-value>)",
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(75, 124, 251, 0.05)",
        card: "0 4px 20px -2px rgba(15, 23, 42, 0.04), 0 2px 10px -1px rgba(15, 23, 42, 0.02)",
        premium: "0 12px 34px -4px rgba(15, 23, 42, 0.04), 0 4px 12px -2px rgba(15, 23, 42, 0.02)",
        glow: "0 0 20px -3px rgba(37, 89, 235, 0.15)",
        "button-glow": "0 4px 14px 0 rgba(37, 89, 235, 0.35)",
        "premium-glow": "0 12px 40px -4px rgba(37, 89, 235, 0.08), 0 4px 20px -2px rgba(37, 89, 235, 0.04)",
      },
      borderRadius: {
        "xl": "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        }
      }
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effaff",
          100: "#d7f3ff",
          200: "#b0e7ff",
          300: "#72d5ff",
          400: "#2bbcff",
          500: "#0693ff",
          600: "#0072e6",
          700: "#005bb8",
          800: "#064b8f",
          900: "#0a3f75",
        },
        tealish: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(2, 132, 199, 0.08)",
        card: "0 8px 24px rgba(15, 23, 42, 0.08)",
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};


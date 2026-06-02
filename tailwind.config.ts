import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae3",
          300: "#aab3c2",
          400: "#7a8597",
          500: "#525d70",
          600: "#3b4458",
          700: "#2a3142",
          800: "#1c2230",
          900: "#11151f",
          950: "#080b13"
        },
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#b6d5ff",
          300: "#86b8ff",
          400: "#5293ff",
          500: "#2b72f6",
          600: "#1657dc",
          700: "#1245b1",
          800: "#143b8c",
          900: "#16336f"
        },
        accent: {
          amber: "#f59e0b",
          green: "#10b981",
          red: "#ef4444",
          purple: "#8b5cf6"
        }
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.05)"
      }
    }
  },
  plugins: []
};
export default config;

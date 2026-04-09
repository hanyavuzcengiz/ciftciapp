import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdfa",
          500: "#14b8a6",
          700: "#0f766e",
          900: "#134e4a"
        }
      }
    }
  },
  plugins: []
};

export default config;

import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        olive: { 50: "#f6f7ec", 100: "#e9edcf", 300: "#c3cd7f", 500: "#7f8b2e", 600: "#65701f", 700: "#4e561a" },
        steel: { 100: "#e6eaee", 300: "#a9b6c1", 500: "#5f7385", 700: "#374654", 900: "#1d2731" },
        earth: { 100: "#efe6db", 500: "#a8794f", 700: "#6f4d2e" },
      },
    },
  },
  plugins: [],
};
export default config;

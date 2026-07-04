import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tailored color system: Professional compliance slate/navy theme
        brand: {
          50: "#f5f7fa",
          100: "#e4ebf3",
          500: "#1e3a8a", // Navy Blue
          600: "#1d4ed8", // Primary blue
          900: "#0f172a", // Dark Slate Navy
        },
      },
    },
  },
  plugins: [],
};

export default config;

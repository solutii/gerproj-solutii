import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      keyframes: {
        "modal-fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "modal-rise": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "modal-fade": "modal-fade 0.2s ease-out",
        "modal-rise": "modal-rise 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;

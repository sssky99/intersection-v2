import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontWeight: {
      thin: "100",
      extralight: "200",
      light: "300",
      normal: "400",
      medium: "400",
      semibold: "400",
      bold: "500",
      extrabold: "600",
      black: "600",
    },
    extend: {
      colors: {
        black: "#181816",
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: "var(--accent)",
        outer: "var(--outer-background)",
      },
      boxShadow: {
        frame: "0 24px 80px rgba(18, 18, 18, 0.08)",
      },
      fontFamily: {
        sans: [
          "KMU80 Sungkok Serif",
          "Nanum Myeongjo",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "serif",
        ],
        serif: [
          "KMU80 Sungkok Serif",
          "Nanum Myeongjo",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Sora", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      boxShadow: {
        panel: "0 14px 40px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};

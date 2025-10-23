/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mahidol-blue': '#1e40af',
        'mahidol-yellow': '#fbbf24',
      },
    },
  },
  plugins: [],
}

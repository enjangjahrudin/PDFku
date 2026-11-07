/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        win: {
          bg: '#f3f3f3',
          card: '#ffffff',
          sidebar: '#f9f9f9',
          border: '#e5e5e5',
          hover: '#ebebeb',
          active: '#e0e0e0',
          blue: '#0067c0',
          blueLight: '#e0f0fd',
          blueHover: '#1879cd',
          text: '#1a1a1a',
          muted: '#616161',
        }
      },
      fontFamily: {
        sans: ['"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

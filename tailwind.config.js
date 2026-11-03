/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        songket: { 50: '#fdf8ec', 100: '#f8ecc8', 300: '#e9c46a', 500: '#c9962b', 700: '#8a6216', 900: '#4a330a' },
        selat: { 500: '#1f6f8b', 700: '#14485c', 900: '#0b2733' },
        hutan: { 500: '#2f7d4f', 700: '#1d5233' },
      },
      fontFamily: {
        display: ['"Trebuchet MS"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

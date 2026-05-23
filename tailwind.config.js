/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './main/templates/**/*.html',
    './main/static/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#4f46e5',
        dark: '#111827',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
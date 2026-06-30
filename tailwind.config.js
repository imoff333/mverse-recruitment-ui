/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { accent: '#ea580c' },
      fontFamily: { serif: ['Georgia', 'Cambria', 'serif'] },
    },
  },
  plugins: [],
};

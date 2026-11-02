/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#168447',
          dark: '#105C35',
          light: '#EAF7EE',
          bg: '#F5FAF5',
          text: '#17251C',
        },
      },
    },
  },
  plugins: [],
};


/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        /**
         * The one accent. Everything that used to be blue-600 is brand-500:
         * the chosen day, the toggle, the add button, a primary action.
         */
        brand: {
          50: '#F3F1FE',
          100: '#E8E5FB',
          200: '#D5CFF8',
          300: '#B8ADF3',
          400: '#9384EE',
          500: '#6C5CE7',
          600: '#5B4BD6',
          700: '#4A3BB8',
        },
        /** The page behind the app column, from 640px up. */
        canvas: '#DEDBF5',
        /** The ground inside the column, behind white cards. */
        page: '#F7F7FB',
      },
      borderRadius: {
        card: '1.25rem',
      },
    },
  },
  plugins: [],
}

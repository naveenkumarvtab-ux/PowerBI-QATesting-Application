/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7fa',
          100: '#e4e8f0',
          200: '#cdd5e1',
          300: '#aab6cb',
          400: '#8093b1',
          500: '#5c7398',
          600: '#485c7e',
          700: '#3a4a66',
          800: '#252f41',
          900: '#1b2230',
          950: '#11161f',
        },
        qa: {
          pass: '#10b981',      // emerald-500
          warning: '#f59e0b',   // amber-500
          fail: '#ef4444',      // red-500
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

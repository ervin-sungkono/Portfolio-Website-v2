/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./node_modules/flowbite-react/**/*.js",
  ],
  theme: {
    container: {
      padding: {
        DEFAULT: '1.5rem',
        sm: '2rem',
        lg: '4rem',
        xl: '5rem',
        '2xl': '6rem',
      },
    },
    extend: {
      zIndex: {
        'fixed': '9999'
      },
      keyframes: {
        float: {
          '0%, 100%' : { translate: '0px 0px', rotate: '5deg' },
          '50%': { translate: '0px 24px', rotate: '-5deg' },
        },
        rotate: {
          '0%' : { rotate: '0deg' },
          '100%': { rotate: '360deg' },
        }
      },
      animation:{
        float: 'float 6s ease-in-out infinite',
        rotate: 'rotate 30s linear infinite'
      }
    }
  },
  darkMode: 'class',
  plugins: [
    require("flowbite/plugin")
  ],
}

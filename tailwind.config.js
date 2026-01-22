/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // LDCU Colors - Maroon and Gold
                primary: {
                    50: '#fdf2f2',
                    100: '#fce4e4',
                    200: '#f9c9c9',
                    300: '#f4a3a3',
                    400: '#a33333',
                    500: '#800000',  // Main Maroon
                    600: '#5c0000',
                    700: '#4d0000',
                    800: '#3d0000',
                    900: '#2d0000',
                },
                secondary: {
                    50: '#fffef7',
                    100: '#fffce8',
                    200: '#fff8c5',
                    300: '#fff08f',
                    400: '#ffe44d',
                    500: '#FFD700',  // Main Gold
                    600: '#c9a800',
                    700: '#a38800',
                    800: '#7a6600',
                    900: '#524400',
                },
                accent: {
                    DEFAULT: '#2c3e50',
                    light: '#34495e',
                    dark: '#1a252f',
                },
                maroon: {
                    DEFAULT: '#800000',
                    light: '#a33333',
                    dark: '#5c0000',
                },
                gold: {
                    DEFAULT: '#FFD700',
                    light: '#ffe44d',
                    dark: '#c9a800',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
            },
            animation: {
                'fade-in-up': 'fadeInUp 0.5s ease-out',
                'slide-in-right': 'slideInRight 0.3s ease-out',
                'pulse-slow': 'pulse 3s infinite',
                'wave': 'wave 2.5s ease-in-out infinite',
            },
            keyframes: {
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(20px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                wave: {
                    '0%, 100%': { transform: 'rotate(0deg)' },
                    '25%': { transform: 'rotate(14deg)' },
                    '50%': { transform: 'rotate(-8deg)' },
                    '75%': { transform: 'rotate(14deg)' },
                },
            },
            boxShadow: {
                'maroon': '0 4px 14px 0 rgba(128, 0, 0, 0.39)',
                'gold': '0 4px 14px 0 rgba(255, 215, 0, 0.39)',
            },
        },
    },
    plugins: [],
}

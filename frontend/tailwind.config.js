/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e6ecff',
          500: '#2563eb',
          600: '#1e3a8a',
          700: '#1e3a8a',
          900: '#0c1e3a',
        },
        secondary: {
          50: '#f8f9ff',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        accent: '#ec4899',
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        dark: {
          50: '#f9fafb',
          100: '#f3f4f6',
          900: '#111827',
          950: '#030712',
        },
      },
      boxShadow: {
        'lg-premium': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'xl-premium': '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
      },
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #2563eb 0%, #1e40af 50%, #1e3a8a 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

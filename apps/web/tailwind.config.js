/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cloudflare brand colors
        cf: {
          orange: '#F6821F',
          'orange-dark': '#DD6B10',
          blue: '#003682',
          'blue-light': '#0055DC',
        },
        // Status colors
        status: {
          success: '#10B981',
          building: '#3B82F6',
          deploying: '#8B5CF6',
          failure: '#EF4444',
          queued: '#6B7280',
          cancelled: '#9CA3AF',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  // 关键：告诉 Tailwind 扫描 src 下的所有 React 文件
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  // 配合 App.jsx 中的 setDarkMode 逻辑
  darkMode: 'class', 
  theme: {
    extend: {
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        slideDown: 'slideDown 0.3s ease-in-out',
        slideUp: 'slideUp 0.3s ease-in-out', // 终端动画
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideDown: { '0%': { transform: 'translateY(-10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } }
      }
    },
  },
  plugins: [],
}
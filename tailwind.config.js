/** @type {import('tailwindcss').Config} */
module.exports = {
  // 扫描项目中所有 HTML/Svelte/JS 文件（确保覆盖所有使用 Tailwind 类名的文件）
  content: [
    './src/**/*.{svelte,html,js,ts}',
    './static/**/*.html'
  ],
  plugins: [],
  theme: {
    extend: {
      colors: {
          primary: '#165DFF',
          secondary: '#722ED1',
          accent: '#FF7D00',
          dark: '#1D2129',
          light: '#F2F3F5',
          muted: '#86909C',
          techBlue: '#2563EB',
          cpuRed: '#DC2626',
          osGreen: '#059669',
          hardwarePurple: '#7C3AED',
          deepBlue: '#0d3b9d',
          electricBlue: '#2d8cff',
          heroStart: '#1e40af',
          heroEnd: '#3b82f6'
      },
      fontFamily: {
          inter: ['Inter', 'sans-serif'],
          mono: ['Fira Code', 'monospace']
      },
      boxShadow: {
          'card': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
          'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          'glow': '0 0 20px rgba(45, 140, 255, 0.6)'
      }
    }
  }
}

import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import adapter from '@sveltejs/adapter-node';

export default defineConfig({
	plugins: [tailwindcss(), 
		sveltekit(),
		viteStaticCopy({ targets: []
		   })
	],
   kit: {
    adapter: adapter({
      // 可选配置：指定构建输出目录（默认 build）
      out: 'build'
    }),
   }
});

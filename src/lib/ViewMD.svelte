<script lang="ts">
  import { onMount  } from 'svelte';
  import { processMarkdownImages } from '$lib/docsify_plugin';
  import 'markview/src/styles/main.css';
    // 直接通过 import 引入 CSS 文件，无需 <link> 标签
  import '$lib/vitepress-assets/styles/base.css';
  import '$lib/vitepress-assets/styles/vars.css';
  import '$lib/vitepress-assets/styles/fonts.css';
  import '$lib/vitepress-assets/styles/icons.css';
  import '$lib/vitepress-assets/styles/utils.css';
  // 引入 components 目录下的 CSS
  import '$lib/vitepress-assets/styles/components/custom-block.css';
  import '$lib/vitepress-assets/styles/components/vp-code.css';
  import '$lib/vitepress-assets/styles/components/vp-doc.css';
  import '$lib/vitepress-assets/styles/components/vp-code-group.css';
  import '$lib/vitepress-assets/styles/components/vp-sponsor.css';


  let renderMarkdown; 

  const { mdcontent } = $props<{ mdcontent: string }>();
  let compiledContent = $state('');
  let container: HTMLElement;

 
  // TOC 配置
  const tocMaxLevel = 3;
  let tocList: any[] = [];

  // ---------------- Mermaid + Docsify 初始化 ----------------
  async function loadScript(src: string) {
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function loadMermaidAndCSS() {
    // 动态加载 Mermaid
    await loadScript('https://cdn.jsdmirror.com/npm/mermaid@11.9.0/dist/mermaid.min.js');
    // 动态加载 Docsify
 

    // 初始化 Mermaid
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose'
    });

 
  }

 

  // ---------------- TOC 生成函数 ----------------
    function generateToC(level: number, text: string, id: string) {
        const indent = (level - 1) * 20; // 每级缩进20px
        return `
            <div class="toc-item lv${level}" style="padding-left: ${indent}px;">
            <a href="#${id}" class="toc-link">${text}</a>
            </div>
        `;
    }

  function extractHeadingContent(currentHeading: HTMLElement, currentLevel: number) {
    const contentElements: HTMLElement[] = [];
    let nextSibling = currentHeading.nextElementSibling;
    while (nextSibling) {
      if (/H[1-3]/.test(nextSibling.tagName)) {
        const nextLevel = parseInt(nextSibling.tagName.replace('H',''));
        if (nextLevel <= currentLevel) break;
      }
      contentElements.push(nextSibling.cloneNode(true) as HTMLElement);
      nextSibling = nextSibling.nextElementSibling;
    }
    const tempDiv = document.createElement('div');
    contentElements.forEach(el => tempDiv.appendChild(el));
    return tempDiv.innerHTML;
  }

  function extractHeadingsAndContent() {
    tocList = [];
    const allHeadings = container.querySelectorAll('h1, h2, h3');
    allHeadings.forEach(heading => {
      const level = parseInt(heading.tagName.replace('H',''));
      if (level < 1 || level > tocMaxLevel) return;
      const text = heading.textContent.trim();
      if (!heading.id) heading.id = `toc-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
      const id = heading.id;
      const content = extractHeadingContent(heading, level);
      tocList.push({ level, text, id, content });
    });
    const tocHtml = tocList.map(item => generateToC(item.level, item.text, item.id)).join('');
    return { tocHtml: `<div class="toc-container">${tocHtml}</div>`, tocData: tocList };
  }


  function handleScroll(activeId = '') {
     const tocResult = extractHeadingsAndContent();
     
        const scrollY = window.scrollY + 100;
        if ( activeId == ''){
          tocResult.tocData.forEach(item => {
            const heading = document.getElementById(item.id);
            if (heading) {
              const rect = heading.getBoundingClientRect();
              if (rect.top <= 100 && rect.bottom >= 0) activeId = item.id;
            }
          });
        } 

        const links = document.querySelectorAll('.toc-link');
         
        links.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${activeId}`));
  }


  function initTocScrollHighlight(tocData: any[]) {
   

  
    window.addEventListener('scroll', handleScroll);
    handleScroll();
  }

  function bindTocClickEvents() {
    const tocLinks = document.querySelectorAll('.toc-link');
    tocLinks.forEach(link => {
      link.addEventListener('click', e => {
         
        e.preventDefault();
        
        const targetId = link.getAttribute('href').replace('#','');
        const el = document.getElementById(targetId);
        if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
        history.pushState(null,null, `#${targetId}`);
        handleScroll(targetId);
      });
    });
  }

  // ---------------- afterUpdate 渲染 Mermaid + TOC ----------------

  $effect(async () => {
    if (!container || !compiledContent) return;

   
    // 2️⃣ TOC
    const tocResult = extractHeadingsAndContent();
    const tocContainer = document.getElementById('right-toc');
    if (tocContainer) {
      tocContainer.innerHTML = tocResult.tocHtml;
      initTocScrollHighlight(tocResult.tocData);
      bindTocClickEvents();
    }

    // 3️⃣ Mermaid 渲染
    if (window.mermaid) {
      const mermaidBlocks = container.querySelectorAll('.mermaid');
      for (const block of mermaidBlocks) {
        const code = block.textContent;
        if (!code) continue;
        const id = block.id || `mermaid-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
        block.id = id;
        try {
          const obj = await window.mermaid.render(`mermaid-svg-${id}`, code);
          block.innerHTML = obj.svg;
        } catch (err) {
          console.error(`Mermaid render error for ${id}:`, err);
          document.getElementById(`mermaid-svg-${id}`)?.remove();
        }
      }
    }


  });

 
  $effect(() => {
    if (!mdcontent) return;
    compiledContent = mdcontent;
         
 
  });

  onMount(async () => {
 
    
    if (mdcontent) compiledContent = mdcontent;

    await loadMermaidAndCSS();
    function copyCode(btn) {
      const codeBlock = btn.closest('.code-block');
      const codeContent = codeBlock.querySelector('code');
      const text = codeContent.innerText;
      
      navigator.clipboard.writeText(text).then(() => {
          const orig = btn.textContent;
          btn.textContent = "已复制!";
          setTimeout(() => {
              btn.textContent = orig;
          }, 1000);
      }).catch(err => {
          console.error('复制失败:', err);
          alert('复制失败，请手动复制代码');
      });
    }

window.copyCode = copyCode;
  });
</script>

 


<div class="md-content">
   
  <div class="vp-doc" bind:this={container}>
    {@html compiledContent}
  </div>

</div>

<style>
  /* 基础容器样式 */
  .md-content {
    width: 100%;
    padding: 1.5rem;
    padding-bottom: 4rem; /* 底部大留白，确保内容可见 */
    box-sizing: border-box;
    /* max-height: calc(100vh - 8rem);  控制最大高度（视口高度 - 预留空间） */
    background-color: #ffffff;
    min-height:500px;
  }
 

/* 在 ViewMD.svelte 的样式部分添加 */
:global(.vp-doc img) {
  border-radius: 8px;
  box-shadow: 
    0 2px 6px rgba(0, 0, 0, 0.2),  /* 内层：近阴影，稍深，范围小 */
    0 4px 16px rgba(0, 0, 0, 0.1); /* 外层：远阴影，更浅，范围大 */
  max-width: 100%;
  height: auto;
  margin: 1.5rem auto;
  display: block;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* 可选：添加悬停效果 */
:global(.vp-doc img:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}
 

  /* 响应式适配 */
  @media (max-width: 768px) {
    .md-content {
      max-height: calc(100vh - 8rem); /* 移动端调整高度 */
      padding: 0.5rem;
      padding-bottom: 1rem; /* 移动端底部留白 */
    }

 
  }

:global(.vp-doc h2) {
  
}

:global(
  .vp-doc h1,
  .vp-doc h2,
  .vp-doc h3,
  .vp-doc h4,
  .vp-doc h5,
  .vp-doc h6
) {
  display: table;
  width: auto;  
}

</style>
    

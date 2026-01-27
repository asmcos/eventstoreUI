import { createMarkdownRenderer} from 'vitepress';
import type { MarkdownOptions } from 'vitepress';

 
/**
 * 创建Markdown渲染器并返回其实例
 * @param root 文档根目录，默认当前工作目录
 * @param options Markdown配置选项
 * @returns 自动推断为createMarkdownRenderer返回的类型
 */
export async function createRenderer(
  root: string = '.',
  options: Partial<MarkdownOptions> = {}
) {
 
  // 省略返回值类型标注，让TS自动推断
  const md =  await createMarkdownRenderer(
    root,
    { markdown: options }
  );

  md.renderer.rules.fence = function(tokens, idx, options, env, self) {
    const token = tokens[idx]
    const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
    const code = token.content.trim(); // 获取代码内容
    const lines = code.split('\n').length;

    let langName = ''
    let langAttrs = ''
  
    if (info) {
      const arr = info.split(/(\s+)/g)
      langName = arr[0]
      langAttrs = arr.slice(2).join('')
    }
  
    if (langName === 'mermaid') {
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      return `<div id="${id}" class="mermaid">${token.content}</div>`; // 先插入代码
    }

    let highlighted
    if (options.highlight) {
      highlighted = options.highlight(token.content, langName, langAttrs) || md.utils.escapeHtml(token.content)
    } else {
      highlighted = md.utils.escapeHtml(token.content)
    }

    if (lines <= 3) {       
      return `<div class="code-block">      
          <div class="code-header">        
            <span>${langName}</span>
            <button class="copy-btn" onclick="copyCode(this)">复制</button> 
          </div>
        ${highlighted}
              
      </div>`;
    }

    return `
    <div class="code-block">
      <div class="code-header">         
        <div class="code-header-left">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
        </div>
        <span>${langName}</span>
        <button class="copy-btn" onclick="copyCode(this)">复制</button>
      </div>
      ${highlighted}
    </div>`;
    
  };

  return md;
}
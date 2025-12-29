import type { RequestHandler } from './$types';
import { get_chapter_author,get_book_id } from '$lib/esclient';
 
import {createRenderer} from "$lib/render";

let mdrender;
 
// 将get_chapter回调API转换为Promise
const getChapterContent = (bookId: string, chapterId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 超时控制（5秒）
    const timer = setTimeout(() => {
      reject(new Error('获取章节内容超时'));
    }, 5000);

    get_book_id(bookId,function(msg){

      if (msg == "EOSE") return ;
      
      let author_pubkey = msg.user;

      get_chapter_author(bookId, chapterId,author_pubkey ,async (message) => {
          clearTimeout(timer); // 清除超时计时器
          
          if (message === "EOSE") {
            resolve(""); // 结束信号，返回空内容
          } else if (message?.data) {
    
            resolve(message.data); // 成功获取内容
          } else {
            reject(new Error('未找到章节内容'));
          }
      });

    })


  });
};

export const GET: RequestHandler = async ({ params, url }) => {

  try {
    const { bookId, md } = params;
    
    // 验证参数
    if (!bookId || !md) {
      return new Response('缺少书籍ID或章节ID', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
    let mdfile = md;
    // 处理404特殊情况
    if (mdfile === '_404.md') {
      return new Response('章节不存在', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    mdrender = await createRenderer();
    // 提取章节ID（移除.md后缀）
    const chapterId = mdfile.replace(/\.md$/, '');
    
    // 获取章节内容
    let content = await getChapterContent(bookId, chapterId);
    content = await mdrender.render(content);
    // 处理空内容
    if (!content.trim()) {
      return new Response('章节内容为空', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // 根据格式参数返回对应内容
    let format = url.searchParams.get('format');
    format = 'html';
    if (format === 'html') {
      // 修正相对路径引用
      const processedContent = content.replace(/\]\(\//g, '](./');
 
      
      return new Response(processedContent, {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=600' // 缓存10分钟
        }
      });
    } else {
      // 返回原始Markdown内容
      return new Response(content, {
        headers: { 
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'public, max-age=600'
        }
      });
    }

  } catch (error) {
    console.error('章节内容获取失败:', error);
    
    // 错误分类处理
    const errorMsg = error instanceof Error ? error.message : '服务器内部错误';
    const status = errorMsg.includes('未找到') || errorMsg.includes('404') 
      ? 404 
      : errorMsg.includes('超时') 
        ? 504 
        : 500;

    return new Response(errorMsg, {
      status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
};
    
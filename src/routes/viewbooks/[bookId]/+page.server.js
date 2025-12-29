import { get_book_id, get_book_shortid,get_chapter_author } from "$lib/esclient";
import {createRenderer} from "$lib/render";

let md;
let rawbookId=null;


function getTagValue(tags,t) {
  const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
  return dTag ? dTag[1] : null;
}

// 工具函数：将回调式API转换为Promise

function getBookIdPromise(s_userid,s_bookid) {
  return new Promise((resolve, reject) => {
    if (rawbookId){
      get_book_id(rawbookId, (message) => {
      
        if (message === "EOSE") {
          reject(new Error("未找到书籍信息"));
        } else if (message) {
           
          resolve(message);
        } else {
          reject(new Error("获取书籍信息失败"));
        }
      });
  
    } else {
      
      get_book_shortid(s_userid,s_bookid, (message) => {
      
        if (message === "EOSE") {
          reject(new Error("未找到书籍信息"));
        } else if (message) {
           
          resolve(message);
        } else {
          reject(new Error("获取书籍信息失败"));
        }
      });
    }


  });
}

function getChapterPromise(bookId, chapterId,author_pubkey,isMD) {
  return new Promise((resolve, reject) => {
    get_chapter_author(bookId, chapterId, author_pubkey,async (message) => {
      if (message === "EOSE") {
        resolve(null); // 没有更多数据
      } else if (message) {
         
        resolve(message);
      } else {
        reject(new Error(`获取章节 ${chapterId} 失败`));
      }
    });
  });
}

// 工具函数：查找第一个章节节点
function findFirstChapterNode(items) {
  for (const item of items) {
    if (item.type === 'chapter' && item.id) {
      return item;
    }
    if (item.children && item.children.length > 0) {
      const found = findFirstChapterNode(item.children);
      if (found) return found;
    }
  }
  return null;
}

function addLinkToItems(items, bookId) {
    return items.map(item => {
      // 复制原对象（避免直接修改源数据）
      const newItem = { ...item };
      
      // 仅为章节添加链接（文件夹可能不需要）
      if (newItem.type === 'chapter' && newItem.id) {
        // 生成链接（使用模板字符串拼接bookId和章节id）
        newItem.link = `/viewbooks/${bookId}/${newItem.id}.md`;
      }
      
      // 递归处理子项
      if (newItem.children && newItem.children.length > 0) {
        newItem.children = addLinkToItems(newItem.children, bookId);
      }
      
      return newItem;
    });
  }
  

export async function load({ params }) {
  try {
    const { bookId } = params;
    let s_userid = null,s_bookid = null;
    rawbookId = null;
     
    if (bookId.includes('-')) {
       [s_userid, s_bookid] = bookId.split('-');
    }  else {
      rawbookId = bookId;
    }

    md = await createRenderer();
    // 1. 并行预取书籍基本信息和大纲
 
    const [bookInfo]   = await Promise.all([
      getBookIdPromise( s_userid,s_bookid),
      
    ]);

    rawbookId = getTagValue(bookInfo.tags,'d');
    const[outlineData] = await Promise.all([
      getChapterPromise(rawbookId, "outline.md",bookInfo.user,false)
    ]);
    // 2. 解析大纲
    let initialOutline = [];
    if (outlineData?.data) {
      initialOutline = JSON.parse(outlineData.data);
      initialOutline = addLinkToItems(initialOutline, bookId);
    }

    // 3. 获取第一个章节内容
    let firstChapterContent = null;
    const firstChapter = findFirstChapterNode(initialOutline);
    if (firstChapter) {
      const chapterData = await getChapterPromise(rawbookId, firstChapter.id,bookInfo.user,true);
      if (chapterData?.data){
        chapterData.data = await md.render(chapterData.data);
      }
     
      firstChapterContent = chapterData?.data || null;
    }

    // 4. 提取URL中的from参数
    // 注意：server端无法直接获取window.location，需要从请求URL中解析
    // 这里假设from参数可能通过请求头或其他方式传递，实际需根据你的路由设计调整
    // const fromParam = request.url.searchParams.get('from') || null;

    return {
      bookId:rawbookId,
      bookInfo: {
        author: bookInfo.data.author,
        title: bookInfo.data.title,
        coverImgurl: bookInfo.data.coverImgurl
      },
      initialOutline,
      firstChapter: {
        id: firstChapter?.id || null,
        content: firstChapterContent
      },
      error: null
    };
  } catch (error) {
    console.error("数据预取失败:", error);
    return {
      bookId: params.bookId,
      bookInfo: null,
      initialOutline: [],
      firstChapter: null,
      error: error.message
    };
  }
}
    

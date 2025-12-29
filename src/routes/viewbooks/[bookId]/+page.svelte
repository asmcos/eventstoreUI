<script>
  import { onMount } from 'svelte';
  import ViewNestedTree from '$lib/ViewNestedTree.svelte';
  import "$lib/editbook.css";
  import ViewMD from '$lib/ViewMD.svelte';
  import {
    upload_file,
    create_book,
    update_book,
    create_chapter,
    get_book_id,
    get_chapter_author,
    like_book,
    comment_book,
    get_book_like,
    get_book_like_counts,
    get_book_comments,
    get_book_comment_counts,
  } from "$lib/esclient";
  import { getKey } from "$lib/getkey";

  export let data;
  const { 
    bookId, 
    bookInfo = {}, 
    initialOutline = [], 
    firstChapter = {}, 
    error,
    userPubkey = null 
  } = data;

  // 页面状态
  let currentChapterContent = firstChapter.content || "";
  let globalClickId = firstChapter.id || null;
  let bookAuthor    = bookInfo.author || "";
  let author_pubkey = bookInfo.user || "";
  let bookTitle     = bookInfo.title || "";
  let coverImgurl   = bookInfo.coverImgurl || "";

  // 互动状态
  let isLiked = false;
  let likeCount = 0;
  let commentCount = 0;
  let isCommentPanelOpen = false;
  let newComment = "";
  let comments = [];
  let showCommentInput = false;
   

  let Keypriv;
  let Keypub;
  let loaded = false;
  let mobileMenuOpen = false;

  // 初始化数据
  get_book_like_counts(bookId, function(message) {
    if (message.code == 200) likeCount = message.counts;
  });

  get_book_comment_counts(bookId, function(message) {
    if (message.code == 200) commentCount = message.counts;
  });
   
  // 工具函数
  function getTagValue(tags, t) {
    const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
    return dTag ? dTag[1] : null;
  }

  // 处理章节ID设置
  async function handleSetClickId(item) {
    globalClickId = item.id;
    if (item.type === 'folder') return;
    
    currentChapterContent = "";
    const tocContainer = document.getElementById('right-toc');
    if (tocContainer) {
      tocContainer.innerHTML = "";
    }
    
    if (window.innerWidth <= 768) {
      mobileMenuOpen = false;
    }
  }

  // 获取来源参数
  function getFrom() {
    const url = new URL(window.location.href);
    return url.searchParams.get('from');
  }

  // 处理章节选择
  async function handleChapterSelect(item) {
    console.log('选中章节:', item);
    const response = await fetch(`/viewbooks/${bookId}/${item.id}.md`);
    const text = await response.text();
    currentChapterContent = text;
    
    if (window.innerWidth <= 768) {
      mobileMenuOpen = false;
    }
  }

  // 查找第一个章节节点
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

  // 加载章节内容
  async function loadChapterContent(chapterId) {
    await get_chapter_author(bookId, chapterId,author_pubkey, (message) => {
      if (message !== "EOSE" && message.data) {
        currentChapterContent = message.data;
      }  
    });
  }

  // 处理点赞
  async function handleLike() {
    if (!Keypriv) {
      alert("请先登录再进行点赞操作");
      return;
    }

    // 显示遮罩
   
    isLiked = !isLiked;
    likeCount = isLiked ? likeCount + 1 : likeCount - 1;
    
    like_book(bookId, Keypub, Keypriv, function(message) {
      if (message.code == 200) {
        isLiked = message.liked;
      }
      // 延迟隐藏遮罩，给动画留出时间
      
    });
  }

  // 加载评论
  async function loadComments() {
    if (!bookId) return;

    let commentList = [];
    get_book_comments(bookId, function(message) {
      if (message != 'EOSE') {
        commentList.push(message);
        comments = [...commentList].sort((a, b) => 
          (b.servertimestamp || 0) - (a.servertimestamp || 0)
        );
      }
    });
  }

  // 处理添加评论
  async function handleAddComment() {
    if (!Keypub) {
      alert("请先登录再进行评论");
      return;
    }

    const commentText = newComment.trim();
    if (!commentText) return;

    comment_book(bookId, Keypub, Keypriv, commentText, function(message) {
      console.log(message);
    });
    
    await loadComments();
    newComment = "";
    showCommentInput = false; // 提交后隐藏评论框
     
  }

  // 评论输入框键盘事件处理
  function handleCommentKeydown(e) {
    // 检查是否是Enter键且没有按住Shift
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 阻止默认换行行为
      
      // 只有当评论内容不为空时才提交
      if (newComment.trim()) {
        handleAddComment();  // 提交评论
      }
    }
  }

  // 切换评论面板显示状态
  function toggleComment() {
    showCommentInput = !showCommentInput;
     
  }

  // 页面挂载时执行
  onMount(async () => {
    loaded = true;
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;

    if (Keypub) {
      get_book_like(bookId, Keypub, function(message) {
        if (message != 'EOSE') {
          isLiked = getTagValue(message.tags, 'liked');
        }
      });
    }

    loadComments();

    window.addEventListener('resize', () => {
      if (isCommentPanelOpen) {
        // 可添加重新定位逻辑
      }
    });
  });

  // 点击遮罩层关闭菜单
  function closeMenuOnBackdrop(e) {
    if (e.target.classList.contains('mobile-sidebar-backdrop')) {
      mobileMenuOpen = false;
    }
  }

 
</script>

<style>
  :global {
    /* 基础布局样式 */
    .book-view-container {
      display: flex;
      min-height: 100vh;
      width: 100%;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* 全局交互遮罩层 - 覆盖整个页面 */
    .interactive-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6); /* 更深的透明度，增强遮掩效果 */
      z-index: 50; /* 介于背景内容和交互控件之间 */
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    
    .interactive-backdrop.visible {
      opacity: 1;
      pointer-events: auto;
    }

    /* 侧边栏样式 */
    .book-sidebar {
      width: 340px;
      background: rgba(255, 255, 255, 0.95);
      border-right: 1px solid rgba(0, 0, 0, 0.05);
      padding: 1.8rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 2rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
      backdrop-filter: blur(10px);
      z-index: 10;
    }

    /* 书籍信息卡片样式 */
    .book-meta {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 5px 10px -5px rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
      margin-bottom: 2rem;
      position: relative;
      padding: 0.8rem 1.2rem;
      border-top: 2px solid rgba(102, 16, 242, 0.5);
    }

    /* 书籍标题与作者样式 */
    .book-title {
      font-size: 1.4rem;
      color: #1e293b;
      line-height: 1.4;
      margin-bottom: 0.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .book-author {
      color: #64748b;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 1rem 0;
    }

    .author-dot {
      width: 16px;
      height: 16px;
      background: linear-gradient(135deg, #8b5cf6, #ec4899);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .author-dot::after {
      content: '';
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
    }

    /* 书籍统计信息 */
    .book-stats {
      display: flex;
      gap: 1.5rem;
      margin-top: 1.2rem;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.9rem;
    }

    .stat-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(79, 70, 229, 0.08);
      border-radius: 8px;
      color: #4F46E5;
    }

    /* 目录区域样式 */
    .book-outline h2 {
      margin: 0 0 1.5rem 0;
      font-size: 1.2rem;
      color: #1e293b;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid rgba(79, 70, 229, 0.15);
    }

    .outline-tree {
      font-size: 0.95rem;
      line-height: 1;
    }

    /* 大纲项样式 */
    .outline-item {
      margin: 0.3rem 0;
      border-radius: 8px;
      transition: all 0.2s ease;
      cursor: pointer;
      border-left: 3px solid transparent;
      display: flex;
      align-items: center;
      gap: 0.7rem;
    }

    .outline-item:hover {
      background: rgba(79, 70, 229, 0.03);
      border-left: 3px solid rgba(79, 70, 229, 0.2);
    }

    .outline-item.active {
      background: rgba(79, 70, 229, 0.08);
      border-left: 3px solid #4F46E5;
      color: #4F46E5;
      font-weight: 500;
    }

    .outline-icon {
      color: #8B5CF6;
      font-size: 0.9rem;
    }

    .chapter-number {
      display: inline-block;
      width: 24px;
      height: 24px;
      background: rgba(139, 92, 246, 0.1);
      border-radius: 6px;
      text-align: center;
      line-height: 24px;
      font-size: 0.8rem;
      color: #8B5CF6;
      margin-right: 0.3rem;
    }

    /* 空目录提示样式 */
    .empty-outline {
      color: #94a3b8;
      font-size: 0.95rem;
      margin: 1rem 0;
      padding: 1.5rem;
      background: rgba(241, 245, 249, 0.8);
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
      text-align: center;
    }

    /* 章节层级缩进 */
    .outline-children {
      margin-left: 1.8rem;
      border-left: 1px solid rgba(0, 0, 0, 0.05);
      padding-left: 1rem;
    }

    /* 右侧内容区样式 */
    .book-content {
      flex: 1;
      padding: 2rem 3rem;
      overflow-y: auto;
      background-color: #ffffff;
      position: relative;
      height: 100vh;
    }

    .no-selection, .no-content {
      display: flex;
      height: 100%;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      font-size: 1.1rem;
      text-align: center;
      padding: 2rem;
    }

    /* 右侧 TOC 容器样式 */
    .right-toc-container {
      width: 280px;
      background: rgba(255, 255, 255, 0.95);
      border-left: 1px solid rgba(0, 0, 0, 0.05);
      padding: 1.8rem 0;
      padding-left: 1rem;
      overflow-y: auto;
      box-shadow: -2px 0 15px rgba(0, 0, 0, 0.03);
      backdrop-filter: blur(10px);
      z-index: 9;
    }

    /* TOC 样式 */
    .toc-container::before {
      content: '章节导航';
      display: block;
      padding: 0 1.2rem 1rem;
      margin: 0 0 1rem;
      font-size: 1.1rem;
      font-weight: 600;
      color: #1e293b;
      border-bottom: 2px solid rgba(79, 70, 229, 0.15);
    }

    .toc-link {
      display: block;
      padding: 0.4rem 1.2rem;
      color: #64748b;
      text-decoration: none;
      font-size: 0.92rem;
      line-height: 1.5;
      transition: all 0.2s;
      border-right: 3px solid transparent;
    }

    .toc-item {
      margin: 6px 0;
      transition: all 0.2s ease;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .toc-item:hover {
      color: #1D4ED8;
      background-color: rgba(59, 130, 246, 0.1);
      cursor: pointer;
    }

    .toc-link.active {
      color: #4F46E5;
      font-weight: 500;
      background-color: rgba(79, 70, 229, 0.05);
      border-right: 3px solid #4F46E5;
    }

    /* 多级标题缩进 */
    .lv1 .toc-link {
      font-weight: 500;
      padding-left: 1.2rem;
    }

    .lv2 .toc-link {
      padding-left: 1.8rem;
      font-size: 0.9rem;
    }

    .lv3 .toc-link {
      padding-left: 2.4rem;
      font-size: 0.88rem;
      color: #8492a6;
    }

    /* 空 TOC 状态 */
    .right-toc-container:empty {
      display: none;
    }

    /* 内容区样式 */
    .book-content blockquote {
      border-left: 4px solid #4f46e5;
      padding: 1rem 1.5rem;
      background-color: #f8fafc;
      margin: 2rem 0;
      font-style: italic;
      border-radius: 0 6px 6px 0;
    }

    /* 滚动条美化 */
    .book-sidebar::-webkit-scrollbar,
    .right-toc-container::-webkit-scrollbar,
    .book-content::-webkit-scrollbar {
      width: 6px;
    }

    .book-sidebar::-webkit-scrollbar-thumb,
    .right-toc-container::-webkit-scrollbar-thumb,
    .book-content::-webkit-scrollbar-thumb {
      background-color: rgba(156, 163, 175, 0.5);
      border-radius: 3px;
    }

    .book-sidebar::-webkit-scrollbar-track,
    .right-toc-container::-webkit-scrollbar-track,
    .book-content::-webkit-scrollbar-track {
      background-color: transparent;
    }

    /* 返回按钮 */
    .back-home-container {
      margin-bottom: -1rem;
      padding: 0 0.5rem;
    }

    .back-home-btn {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, #4F46E5 0%, #8B5CF6 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 5px rgba(79, 70, 229, 0.2);
    }

    .back-home-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(79, 70, 229, 0.3);
      background: linear-gradient(135deg, #4338ca 0%, #7c3aed 100%);
    }

    .back-home-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 3px rgba(79, 70, 229, 0.2);
    }

    /* 移动端菜单 */
    .mobile-menu-btn {
      display: none;
      position: fixed;
      top: 1rem;
      left: 1rem;
      z-index: 100;
      background: #4F46E5;
      color: white;
      border: none;
      border-radius: 8px;
      width: 44px;
      height: 44px;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }

    .mobile-sidebar {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 85%;
      height: 100%;
      background: white;
      z-index: 1000;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .mobile-sidebar-backdrop {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .mobile-sidebar.open {
      transform: translateX(0);
    }

    .mobile-sidebar-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }

    /* 响应式设计 */
    @media (max-width: 768px) {
      .book-sidebar {
        display: none;
      }
      
      .book-content {
        padding: 1rem;
        padding-top: 4rem;
      }
      
      .mobile-menu-btn {
        display: flex;
      }
      
      .mobile-sidebar,
      .mobile-sidebar-backdrop {
        display: block;
      }
      
      .right-toc-container {
        display: none;
      }
      
      .mobile-sidebar .book-meta {
        display: none;
      }
      
      .mobile-sidebar .book-outline {
        margin-top: 1rem;
      }
    }

    @media (min-width: 1200px) and (max-width: 1440px) {
      .right-toc-container {
        width: 240px;
      }
    }

    /* 隐藏的链接列表 */
    .outline1-links {
      position: absolute;
      left: -9999px;
      top: -9999px;
      width: 1px;
      height: 1px;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    }

    .outline1-links-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .outline1-links-list li {
      margin: 0.5rem 0;
    }

    .outline1-links-list a {
      color: #000;
      text-decoration: none;
    }

    .interactive-wrapper{
      position: sticky;
      bottom: 20px;
      right: 20px;
      display: flex;
      flex-direction: row;
      align-items: center;
    }
    /* 交互控件 */
    .interactive-controls {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.6rem;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 0.5rem 0.6rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      transition: all 0.2s ease;
      border: 1px solid rgba(226, 232, 240, 0.8);
      backdrop-filter: blur(10px);
      height: 40px;
      box-sizing: border-box;
      margin-left: auto;
      width: fit-content;
      margin-right: 20px;
       
    }

    .interact-item {
      display: flex;
      align-items: center;
      gap: 0.2rem;
      cursor: pointer;
      padding: 0.2rem;
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .interact-item:hover {
      background: rgba(248, 250, 252, 0.8);
    }

    /* 点赞样式 */
    .like-item {
      color: #64748b;
    }

    .like-item.liked {
      color: #ef4444;
    }

    .like-item.liked .interact-icon {
      animation: heartBeat 0.5s ease;
    }

    /* 评论样式 */
    .comment-item-control {
      color: #64748b;
    }

    .comment-item-control:hover, .comment-item-control.active {
      color: #3b82f6;
    }

    .interact-icon {
      font-size: 1.2rem;
      transition: transform 0.2s ease;
    }

    .interact-item:hover .interact-icon {
      transform: scale(1.1);
    }

    .interact-count {
      font-size: 0.9rem;
      font-weight: 600;
      min-width: 1.2rem;
      text-align: center;
    }

    .like-item .interact-count {
      color: #ef4444;
    }

    .comment-item-control .interact-count {
      color: #3b82f6;
    }

    /* 评论框背景遮罩 - 已合并到全局遮罩 */
    .comment-input-backdrop {
      display: none;
    }

    /* 评论容器样式 */
    .comment-container {
      position: relative;
      display: flex;
      align-items: center;
    }
    
    /* 评论输入框样式 */
    .comment-input-wrapper {
      display: flex;
      width: 0;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    }
    
    .comment-input-wrapper.visible {
      opacity: 1;
      pointer-events: auto;
      width: 480px;
      
    }
    
    /* 渐变边框容器样式 */
    .gradient-border-container {
      position: relative;
      width: auto;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
      right:0px;
      display: inline-block; /* 使容器根据内容宽度自适应 */
    }

    .gradient-border-container.visible {
      max-width: calc(100% - 40px);
      opacity: 1;
      pointer-events: auto;
      right:0px;

    }

  
        
    
    .comment-input-container {
      position: relative;
      width: 100%;
      border-color: #8B5CF6;

    }

    .comment-input {
      width: 100%;
      padding: 0.8rem;
      padding-right: 70px; /* 为按钮预留空间 */
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 0.92rem;
      resize: none;
      min-height: 80px;
      background: #ffffff; /* 纯白色背景 */
      transition: border-color .15s ease, box-shadow .15s ease;
      box-sizing: border-box;
      box-shadow: 
        0 0 0 3px rgba(139, 92, 246, 0.2);
    }

    .comment-input:focus {
      outline: none;
      border-color: #8B5CF6;
      /* 两层递进式阴影，内层颜色深、范围小，外层颜色浅、范围大 */
      box-shadow: 
        0 0 0 3px rgba(139, 92, 246, 0.2),  /* 内层阴影 - 颜色较深，范围较小 */
        0 0 0 8px rgba(139, 92, 246, 0.12); /* 外层阴影 - 颜色较浅，范围较大 */
      transition: border-color .15s ease, box-shadow .15s ease;
    }
 
    .comment-actions {
      position: absolute;
      right: 8px;
      bottom: 8px;
      display: flex;
      gap: 8px;
    }
    
    .cancel-comment, .send-comment {
      width: 30px;
      height: 30px;
      border-radius: 50%; /* 确保圆形 */
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      padding: 0px; /* 移除内边距确保圆形 */
      flex-shrink: 0; /* 防止按钮尺寸变化 */
      margin-bottom:4px;
    }
    
    .cancel-comment {
      background-color: #f1f5f9;
      color: #64748b;
    }
    
    .cancel-comment:hover {
      background-color: #e2e8f0;
      color: #334155;
    }
    
    .send-comment {
      background: linear-gradient(135deg, #4F46E5 0%, #8B5CF6 100%);
      color: white;
    }
    
    .send-comment:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    
    /* 修复图标居中问题 */
    .send-comment i, .cancel-comment i {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* 内容与评论区隔离条 */
    .content-divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 2.5rem 0 1.5rem;
      padding: 0 0.5rem;
    }
    
    .divider-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, transparent, rgba(148, 163, 184, 0.3), transparent);
    }
    
    .divider-text {
      font-size: 0.9rem;
      color: #94a3b8;
      white-space: nowrap;
      padding: 0.3rem 0.8rem;
      background-color: rgba(248, 250, 252, 0.8);
      border-radius: 12px;
      letter-spacing: 0.5px;
    }

    /* 评论列表 */
    .comments-list {
      margin-bottom: 0.8rem;
      padding: 0.5rem;
      scrollbar-width: thin;
      scrollbar-color: rgba(148,163,184,.6) transparent;
      border-radius: 10px;
      background-color: #fcfcfd;
    }

    .comments-list-inner {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .comment-item {
      padding: 0.9rem;
      border-radius: 12px;
      background-color: white;
      border: 1px solid #f1f5f9;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      transition: all 0.2s ease;
    }

    .comment-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border-color: #e2e8f0;
    }

    .comment-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .comment-author-avatar {
      margin-left: 8px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4F46E5 0%, #8B5CF6 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      flex-shrink: 0;
    }

    .comment-meta {
      flex: 1;
    }

    .comment-author-name {
      font-weight: 600;
      color: #1e293b;
      font-size: 0.9rem;
    }

    .comment-time {
      font-size: 0.78rem;
      color: #94a3b8;
      margin-top: 2px;
    }

    .comment-content {
      font-size: 0.95rem;
      color: #334155;
      line-height: 1.6;
      padding-left: 43px;
    }

    .no-comments {
      color: #94a3b8;
      font-size: 0.9rem;
      text-align: center;
      padding: 2rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      background-color: #fcfcfd;
      border-radius: 10px;
      border: 1px dashed #e2e8f0;
    }

    .no-comments i {
      font-size: 1.8rem;
      color: #cbd5e1;
    }

    /* 动画效果 */
    @keyframes heartBeat {
      0% { transform: scale(1); }
      14% { transform: scale(1.3); }
      28% { transform: scale(1); }
      42% { transform: scale(1.3); }
      70% { transform: scale(1); }
    }

    /* 小屏适配 */
    @media (max-width: 520px) {
      .comment-input-wrapper.visible{
        width:260px;
      }
      
      .interactive-controls {
        padding: 0.2rem 0.2rem;
        height: 38px;
        gap: 0.6rem;
      }
    }
  }
</style>

<svelte:head>
  <title>{bookTitle}</title>
</svelte:head>

<!-- 页面主容器 -->
<div class="book-view-container">
 

  <!-- 移动端菜单按钮 -->
  <button class="mobile-menu-btn" on:click={() => mobileMenuOpen = !mobileMenuOpen}>
    <i class="fas fa-bars"></i>
  </button>

  <!-- 移动端侧边栏遮罩层 -->
  <div class="mobile-sidebar-backdrop {mobileMenuOpen ? 'open' : ''}" 
       on:click={closeMenuOnBackdrop}></div>

  <!-- 移动端侧边栏 -->
  <aside class="mobile-sidebar {mobileMenuOpen ? 'open' : ''}">
    <div class="back-home-container">
      <button class="back-home-btn" on:click={() => history.back()}>
        <i class="fa fa-home mr-2"></i>返回
      </button>
    </div>

    <div class="book-outline">
      <h2>目录</h2>
      {#if initialOutline.length > 0}
        <ViewNestedTree 
          items={initialOutline} 
          onSelect={handleChapterSelect}
          onSetClickId={handleSetClickId}
          clickId={globalClickId}  
          class="outline-tree"
        />
      {:else}
        <p class="empty-outline">本书暂无目录</p>
      {/if}
    </div>
  </aside>

  <!-- 桌面端侧边栏 -->
  <aside class="book-sidebar">
    <div class="back-home-container">
      <button class="back-home-btn" on:click={() => history.back()}>
        <i class="fa fa-home mr-2"></i>返回
      </button>
    </div>

    <div class="book-meta">
      <div class="py-5 px-3 relative overflow-hidden">
        <!-- 书籍标题 -->
        <h1 class="book-title text-xl font-bold text-gray-800 mb-2 line-clamp-2 relative flex items-center gap-2">
          <span class="text-purple-600 text-lg">《</span>
          {bookTitle}
          <span class="text-purple-600 text-lg">》</span>
        </h1>
        
        <!-- 作者信息 -->
        <p class="book-author text-sm text-gray-600 flex items-center gap-2 mt-1">
          <span class="author-dot"></span>
          <span class="text-gray-500">作者:</span>
          <span class="font-medium text-gray-700 relative group">
            {bookAuthor}
          </span>
        </p>
        
        <!-- 装饰分隔线 -->
        <div class="mt-4 h-px bg-gradient-to-r from-purple-300 via-blue-200 to-transparent relative-0"></div>
        
        <!-- 章节统计 -->
        {#if initialOutline.length > 0}
          <div class="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <span class="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <i class="fa fa-list-ul text-[10px]"></i>
            </span>
            <span>共 <span class="font-medium text-purple-600">{initialOutline.length}</span> 个章节</span>
          </div>
        {/if}
      </div>
    </div>
    
    <div class="flex items-center gap-2 my-1">
      <div class="flex-1 h-px bg-gradient-to-r from-transparent to-gray-300"></div>
      <div class="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
      <div class="flex-1 h-px bg-gradient-to-l from-transparent to-gray-300"></div>
    </div>

    <div class="book-outline">
      <h2>目录</h2>
      {#if initialOutline.length > 0}
        <ViewNestedTree 
          items={initialOutline} 
          onSelect={handleChapterSelect}
          onSetClickId={handleSetClickId}
          clickId={globalClickId}  
          class="outline-tree"
        />
      {:else}
        <p class="empty-outline">本书暂无目录</p>
      {/if}
    </div>
  </aside>
  
  <!-- 右侧内容区 -->
  <main class="book-content">
      {#if !loaded}
          <!-- 状态1: 正在加载章节内容 -->
          <div class="loading">
              
              <div class="border-4 border-blue-200 border-t-blue-600 rounded-full w-8 h-8 animate-spin mx-auto"></div>
              <p>章节内容加载中...</p>
          </div>
      {:else if currentChapterContent}
          
          <ViewMD mdcontent={currentChapterContent} />
      {:else if initialOutline.length > 0}
           
          <div class="no-selection">
              <p>作者正在快速赶工中，耐心等待...</p>
          </div>
      {:else}
           
          <div class="no-content">
              <p>本书暂无内容</p>
          </div>
      {/if}

    <!-- 评论区与正文的隔离条 -->
    <div class="content-divider">
      <div class="divider-line"></div>
      <div class="divider-text">评论区</div>
      <div class="divider-line"></div>
    </div>

    <div class="comments-list">
      {#if comments.length > 0}
        <div class="comments-list-inner">
          {#each comments as comment}
            <div class="comment-item">
              <!-- 评论头部：作者和时间 -->
              <div class="comment-header">
                <div class="comment-author-avatar">
                  <span>{comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}</span>
                </div>
                <div class="comment-meta">
                  <div class="comment-author-name">{comment.author || '匿名用户'}</div>
                  <div class="comment-time">
                    {comment.servertimestamp 
                      ? new Date(comment.servertimestamp).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '未知时间'
                    }
                  </div>
                </div>
              </div>
              
              <!-- 评论内容 -->
              <div class="comment-content">
                {comment.data}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="no-comments">
          <i class="fa fa-comment-o"></i>
          <p>暂无评论，快来抢沙发~</p>
        </div>
      {/if}
    </div>

    <!-- 交互控件容器 -->
    <div class="interactive-wrapper">
      <div class="gradient-border-container {showCommentInput ? 'visible' : ''}">
        <div class="comment-input-wrapper {showCommentInput ? 'visible' : ''}">
          <div class="comment-input-container">
            <textarea 
              class="comment-input" 
              placeholder="写下你的评论..."
              bind:value={newComment}
              on:keydown={handleCommentKeydown}
              on:focus={() => {}}
            ></textarea>
            <div class="comment-actions">
              <button class="cancel-comment" on:click={toggleComment}>
                <i class="fa fa-times"></i>
              </button>
              <button class="send-comment" on:click={handleAddComment} disabled={!newComment.trim()}>
                <i class="fa fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {#if !showCommentInput}
      <div class="interactive-controls">
        <!-- 点赞按钮 -->
        <div 
          class="interact-item like-item {isLiked ? 'liked' : ''}"
          on:click={handleLike}
          title={isLiked ? "取消点赞" : "点赞"}
        >
          <i class="fa {isLiked ? 'fa-heart' : 'fa-heart-o'} interact-icon"></i>
          <span class="interact-count">{likeCount}</span>
        </div>

        <!-- 评论按钮及输入框容器 -->
        <div class="comment-container">
          <!-- 评论按钮 -->
          <div 
            class="interact-item comment-item-control {showCommentInput ? 'active' : ''}"
            on:click={toggleComment}
            title="评论"
          >
            <i class="fa fa-comment-o interact-icon"></i>
            <span class="interact-count">{commentCount}</span>
          </div>
        </div>
      </div>
     {/if} 
    </div>
  </main>

  <!-- 右侧 TOC 容器 -->
  <aside class="right-toc-container" id="right-toc">
    <!-- TOC 内容将由 ViewMD 生成并插入 -->
  </aside>
</div>

<div class="outline1-links" aria-hidden="true">
  <h2>{bookTitle} 章节链接</h2>
  {#if initialOutline.length > 0}
    <ul class="outline1-links-list">
      {#each initialOutline as item}
        <li key={item.id}>
          {#if item.type === 'chapter' && item.id}
            <a href="/viewbooks/{bookId}/{item.id}.md">{item.title}</a>
          {:else}
            <span>{item.title}</span>
          {/if}
          
          {#if item.children && item.children.length > 0}
            <ul class="outline1-links-list">
              {#each item.children as child}
                <li key={child.id}>
                  {#if child.type === 'chapter' && child.id}
                    <a href="/viewbooks/{bookId}/{child.id}.md">{child.title}</a>
                  {:else}
                    <span>{child.title}</span>
                  {/if}
                  
                  {#if child.children && child.children.length > 0}
                    <ul class="outline1-links-list">
                      {#each child.children as grandchild}
                        <li key={grandchild.id}>
                          {#if grandchild.type === 'chapter' && grandchild.id}
                            <a href="/viewbooks/{bookId}/{grandchild.id}.md">{grandchild.title}</a>
                          {:else}
                            <span>{grandchild.title}</span>
                          {/if}
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

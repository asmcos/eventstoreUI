<script>
  import { onMount } from 'svelte';
  import { uploadpath } from "$lib/config";
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { get_blog_id, 
  get_user_profile,
    like_blog, 
    get_blog_like, 
    get_blog_like_counts,
    comment_blog, 
    get_blog_comments } from "$lib/esclient";
  import ViewMD from '$lib/ViewMD.svelte';

  import {browselog} from "$lib/browselog";
  import { store_get_users_profile } from "$lib/userProfileStore";
 


  const colorPool = [
    { bgClass: "bg-blue-100", textClass: "text-blue-800" },
    { bgClass: "bg-green-100", textClass: "text-green-800" },
    { bgClass: "bg-yellow-100", textClass: "text-yellow-800" },
    { bgClass: "bg-purple-100", textClass: "text-purple-800" },
    { bgClass: "bg-orange-100", textClass: "text-orange-800" },
    { bgClass: "bg-pink-100", textClass: "text-pink-800" },
    { bgClass: "bg-teal-100", textClass: "text-teal-800" }
  ];
  
  export let data;
  const { blogId, blogData, userProfile, error } = data;

  

  let Keypriv;
  let Keypub;

  let currentContent = blogData?.content || "";
  let user_profile = userProfile;
  let loaded = false;
  
  // 点赞相关状态
  let isLiked = false;
  let likeCount = 0;
  let likeLoading = false;
  
  // 评论相关状态
  let commentList = [];
  let commentInput = "";
  let commentLoading = false;
  let submitCommentLoading = false;
  
  let users_profile = {};

  
  // 初始化点赞状态和数量
  async function initLikeStatus() {
    if (!blogId) return;
    try {
      // 获取当前用户是否点赞
      // 获取点赞总数
      await get_blog_like_counts(blogId, (message) => {
        if (message.code == 200) likeCount = message.counts;
      });
    } catch (err) {
      showNotification("加载点赞数据失败", "error");
    }
  }

  // 加载评论列表
  async function loadComments() {
    if (!blogId) return;
    
    commentLoading = true;
    let tempComments = [];
    
    try {
      get_blog_comments(blogId, function(message) {
        if (message != 'EOSE') {
          tempComments.push(message);
          // 格式化并排序评论
          commentList = [...tempComments].map(comment => ({
            ...comment,
            formattedTime: comment.servertimestamp 
              ? new Date(comment.servertimestamp).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '未知时间',
 
          })).sort((a, b) => 
            (b.servertimestamp || 0) - (a.servertimestamp || 0)
          );
        } else {
          // 当收到EOSE信号时如果还没有评论，设置为空数组
          if (commentList.length === 0) {
            commentList = [];
          }
          commentLoading = false;
        }

      if (message == 'EOSE'){
        let users_pubkey = []

        commentList.forEach(comment => {
          if (!users_pubkey.includes(comment.user)) {
            users_pubkey.push(comment.user);
          }
        });
        
        store_get_users_profile(
          users_pubkey,
          (profile) => {
            if (profile && profile.pubkey) {
               
              users_profile = {
                ...users_profile,
                [profile.pubkey]: profile.data || profile
              };
                   
            }
        })
      }

      });
    } catch (err) {
      showNotification("加载评论失败", "error");
      commentLoading = false;
    }
  }

  // 点赞/取消点赞操作
  async function handleLike() {
    if (!blogId || !Keypub || !Keypriv || likeLoading) return;
    likeLoading = true;
    try {
      await like_blog(blogId, Keypub, Keypriv, (res) => {
        if (res && res.code === 200) {
          isLiked = !isLiked;
          likeCount = isLiked ? likeCount + 1 : likeCount - 1;
          showNotification(isLiked ? "点赞成功" : "取消点赞成功", "success");
        } else {
          showNotification(isLiked ? "取消点赞失败" : "点赞失败", "error");
        }
      });
    } catch (err) {
      showNotification("操作失败，请重试", "error");
    } finally {
      likeLoading = false;
    }
  }

  // 提交评论操作
  async function handleSubmitComment() {
    if (!blogId || !Keypub || !Keypriv || !commentInput.trim() || submitCommentLoading) return;
    submitCommentLoading = true;
    try {
      await comment_blog(blogId, Keypub, Keypriv, commentInput.trim(), (res) => {
        if (res && res.code === 200) {
          showNotification("评论提交成功", "success");
          commentInput = "";
          // 重新加载评论列表
          loadComments();
        } else {
          showNotification("评论提交失败", "error");
        }
      });
    } catch (err) {
      showNotification("评论提交出错，请重试", "error");
    } finally {
      submitCommentLoading = false;
    }
  }

  onMount(async () => {
    loaded = true;
    // 初始化点赞和评论数据
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;

    browselog(Keypub,blogId);

    if (Keypub) {
      get_blog_like(blogId, Keypub, function(message) {
        if (message != 'EOSE') {
          isLiked = getTagValue(message.tags, 'liked');
        }
      });
    }

    await initLikeStatus();
    loadComments();
  });

  // 补充getTagValue函数
  function getTagValue(tags, key) {
    const tag = tags.find(item => item[0] === key);
    return tag ? tag[1] : false;
  }
</script>

<style>
:global {
  /* 原有样式保持不变 */
  .blog-content p {
    margin-bottom: 1.5rem;
    line-height: 1.7;
  }
  
  .blog-content h2 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: 700;
    color: #1e293b;
    font-size: 1.5rem;
    padding-bottom: 0.5rem;
    
  }
  
  .blog-content blockquote {
    border-left: 4px solid #4f46e5;
    padding: 1rem 1.5rem;
    background-color: #f8fafc;
    margin: 2rem 0;
    font-style: italic;
    border-radius: 0 6px 6px 0;
  }

  /* 主布局容器 */
  .main-container {
    display: flex;
    min-height: calc(100vh - 2rem);
    gap: 2rem;
    padding: 1rem;
  }

  /* 博客内容区域 */
  .blog-content-container {
    flex: 1;
    max-width: 100%;
  }

  /* 右侧 TOC 容器 */
  .right-toc-container {
    width: 280px;
    flex-shrink: 0;
    height: calc(100vh - 4rem);
    padding: 1.8rem 1rem;
    overflow-y: auto;
    position: sticky;
    top: 2rem;
    border-left: 1px solid #e2e8f0;
  }

  /* TOC 内容样式 */
  .right-toc-container .toc {
    list-style: none;
    padding-left: 1rem;
  }

  .right-toc-container .toc-item {
    margin-bottom: 0.8rem;
  }

  .right-toc-container .toc-link {
    color: #64748b;
    text-decoration: none;
    transition: color 0.2s;
    font-size: 0.95rem;
  }

  .right-toc-container .toc-link:hover,
  .right-toc-container .toc-link.active {
    color: #4f46e5;
    font-weight: 500;
  }

  /* 响应式设计 */
  @media (max-width: 1024px) {
    .main-container {
      flex-direction: column;
      gap: 1rem;
    }

    .right-toc-container {
      width: 100%;
      height: auto;
      max-height: 300px;
      position: static;
      border-left: none;
      border-top: 1px solid #e2e8f0;
      margin-top: 1rem;
      padding: 1rem;
    }
  }

  @media (max-width: 768px) {
    .main-container {
      padding: 0.5rem;
    }

    .blog-content-container {
      padding: 0 0.5rem;
    }
  }

  .toc-container {
    background: #f9f9f9;
    border-left: 3px solid #4CAF50;
    padding: 10px 15px;
    border-radius: 6px;
    font-family: "Segoe UI", sans-serif;
    font-size: 14px;
  }

  .toc-item {
    margin: 5px 0;
    transition: all 0.2s;
  }

  .toc-link {
    text-decoration: none;
    color: #333;
    display: inline-block;
    width: 100%;
  }

  .toc-link:hover {
    color: #4CAF50;
    font-weight: bold;
  }

  .toc-link.active {
    color: #4CAF50;
    font-weight: bold;
    position: relative;
  }

  .toc-link.active::before {
    content: '';
    position: absolute;
    left: -10px;
    top: 50%;
    transform: translateY(-50%);
    width: 6px;
    height: 6px;
    background-color: #4CAF50;
    border-radius: 50%;
  }

  /* 隔离横条容器 */
  .blog-divider {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 12px;
    opacity: 0.8;
    transition: opacity 0.3s ease;
  }

  .blog-divider:hover {
    opacity: 1;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, 
      rgba(79, 70, 229, 0) 0%, 
      rgba(79, 70, 229, 0.6) 50%, 
      rgba(79, 70, 229, 0) 100%
    );
    transition: all 0.5s ease;
  }

  .divider-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #4F46E5;
    position: relative;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
    transition: transform 0.3s ease;
  }

  .divider-dot::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: rgba(79, 70, 229, 0.2);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0.6;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 0.9;
    }
    100% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0.6;
    }
  }

  .top-divider .divider-line {
    background: linear-gradient(90deg, 
      rgba(79, 70, 229, 0) 0%, 
      rgba(79, 70, 229, 0.6) 50%, 
      rgba(79, 70, 229, 0) 100%
    );
  }

  .bottom-divider .divider-line {
    background: linear-gradient(90deg, 
      rgba(139, 92, 246, 0) 0%, 
      rgba(139, 92, 246, 0.6) 50%, 
      rgba(139, 92, 246, 0) 100%
    );
  }

  .bottom-divider .divider-dot {
    background-color: #8B5CF6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }

  .bottom-divider .divider-dot::after {
    background-color: rgba(139, 92, 246, 0.2);
  }

  @media (max-width: 768px) {
    .blog-divider {
      gap: 8px;
    }
    
    .top-divider {
      margin-bottom: 4rem;
    }
    
    .bottom-divider {
      margin-top: 4rem;
    }
  }

  /* -------------------------- 点赞区域样式 -------------------------- */
  .blog-like-section {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem 0;
    margin-bottom: 2rem;
    border-radius: 12px;
    background-color: #fff;
    box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
    transition: box-shadow 0.3s ease;
  }

  .blog-like-section:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }

  .like-btn {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.8rem 2rem;
    border: none;
    border-radius: 30px;
    background-color: #f8fafc;
    color: #64748b;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    outline: none;
  }

  .like-btn:hover {
    background-color: #f1f5f9;
    color: #4f46e5;
  }

  .like-btn.liked {
    background-color: rgba(79, 70, 229, 0.1);
    color: #4f46e5;
  }

  .like-icon {
    font-size: 1.2rem;
    transition: transform 0.3s ease;
  }

  .like-btn.liked .like-icon {
    animation: likePulse 0.5s ease;
  }

  .like-count {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .like-loading {
    width: 1.2rem;
    height: 1.2rem;
    border: 2px solid #cbd5e1;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes likePulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* -------------------------- 评论区域样式 -------------------------- */
  .blog-comment-section {
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
    padding: 2rem;
    margin-bottom: 3rem;
  }

  .comment-section-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 1.5rem;
    padding-bottom: 0.8rem;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

 

  /* 评论输入框样式 */
  .comment-input-container {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  /* 评论作者头像样式 */
  .comment-author-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #4f46e5;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
    flex-shrink: 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .comment-author-avatar-nobg {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
    flex-shrink: 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .comment-input-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .comment-input {
    width: 100%;
    padding: 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    resize: vertical;
    min-height: 100px;
    font-size: 1rem;
    transition: all 0.3s ease;
  }

  .comment-input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 5px rgba(79, 70, 229, 0.1);
  }

  .comment-submit-btn {
    align-self: flex-end;
    padding: 0.6rem 1.5rem;
    background-color: #4f46e5;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .comment-submit-btn:hover {
    background-color: #4338ca;
  }

  .comment-submit-btn:disabled {
    background-color: #94a3b8;
    cursor: not-allowed;
  }

  .submit-loading {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.5);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* 评论列表样式 */
  .comments-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .comment-item {
    display: flex;
    gap: 1rem;
    padding: 1.2rem;
    border-radius: 8px;
    background-color: #f8fafc;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .comment-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .comment-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .comment-content-wrapper {
    flex: 1;
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .comment-author {
    font-weight: 600;
    color: #1e293b;
  }

  .comment-time {
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .comment-text {
    color: #334155;
    line-height: 1.6;
    margin-bottom: 0.5rem;
  }

  /* 加载状态样式 */
  .comments-loading {
    text-align: center;
    padding: 2rem;
    color: #64748b;
  }

  .comment-header-divider {
      height: 1px;
      background: repeating-linear-gradient(
        to right,
        rgba(148, 163, 184, 0.6),  /* 更深的灰色，提高不透明度 */
        rgba(148, 163, 184, 0.6) 6px,  /* 增加实线长度 */
        transparent 6px,
        transparent 12px  /* 增加整体周期长度 */
      );
      margin: 0.75rem 0;  /* 稍大的间距，增强分离感 */
      width: 100%;
  }


  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid #e2e8f0;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  /* 无评论状态 */
  .no-comments {
    text-align: center;
    padding: 3rem 1rem;
    color: #64748b;
    background-color: #f8fafc;
    border-radius: 8px;
  }

  .no-comments-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: #cbd5e1;
  }

  /* 响应式评论区 */
  @media (max-width: 768px) {
    .blog-comment-section {
      padding: 1.2rem;
    }

    .comment-section-title {
      font-size: 1.2rem;
    }

    .comment-input-container {
      flex-direction: column;
      gap: 0.8rem;
    }

    .user-avatar, .comment-author-avatar {
      width: 36px;
      height: 36px;
    }

    .comment-item {
      padding: 0.8rem;
    }

    .comment-avatar {
      width: 40px;
      height: 40px;
    }
  }
}
</style>

<svelte:head>
  <title> {blogData.title || "博客文章"}</title>
</svelte:head>

<!-- 主布局容器 -->
<div class="main-container">
  <!-- 左侧博客内容区域 -->
  <div class="blog-content-container">
    <div class="container mx-auto  py-8 max-w-4xl">
      <!-- 标题区域 -->
      <div class="flex flex-col md:flex-row items-start gap-6 mb-8">
        <div class="w-full md:w-auto flex-shrink-0">
          <img 
            src={blogData.coverUrl ? `${uploadpath}${blogData.coverUrl}` : 'https://picsum.photos/seed/blogcover/200/200'} 
            alt={blogData.title || '博客封面'} 
            class="w-24 h-24 md:w-28 md:h-28 rounded-lg object-cover shadow-md"
          >
        </div>
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{blogData.title || '无标题'}</h1>
          <div class="flex flex-wrap items-center gap-4 text-gray-600">
            <div class="flex items-center">
              <img 
                src={user_profile?.avatarUrl ? `${uploadpath}${user_profile.avatarUrl}` : 'https://picsum.photos/seed/author/100/100'} 
                alt={user_profile?.displayName || '作者头像'} 
                class="w-8 h-8 rounded-full mr-2"
              >
              <span>{user_profile?.displayName || '未知作者'}</span>
            </div>
            <div class="flex items-center">
              <i class="far fa-calendar mr-2"></i>
              <span>
                {blogData.servertimestamp 
                  ? new Date(blogData.servertimestamp).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                  : '未知日期'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 标签 -->
      {#if blogData.labels && blogData.labels.length > 0}
        <div class="flex flex-wrap gap-2 mb-8">
          {#each blogData.labels.slice(0, 5) as label, index}
            <span class="text-xs {colorPool[index].bgClass} {colorPool[index].textClass} px-2 py-0.5 rounded">
              {label}
            </span>
          {/each}
        </div>
      {/if}

      <!-- 博客内容 -->
      <div class="bg-white rounded-xl shadow-md py-6 px-1  mb-8">
        <div class="blog-divider top-divider mb-6">
          <div class="divider-line"></div>
          <div class="divider-dot"></div>
          <div class="divider-line"></div>
        </div>

        <div class="blog-content ">
          {#if !loaded}
             
            <div class="text-center py-10 text-gray-500 ">
              <p>加载中...</p>
              <div class="border-4 border-blue-200 border-t-blue-600 rounded-full w-8 h-8 animate-spin"></div>  
            </div>
          {:else}
             
            {#if currentContent}
               
              <ViewMD mdcontent={currentContent} />
            {:else}
               
              <div class="text-center py-10 text-gray-500">
                <p>暂无博客内容</p>
              </div>
            {/if}
          {/if}
        </div>
      </div>

      <!-- 点赞区域 -->
      <div class="blog-like-section">
        <button 
          class="like-btn {isLiked ? 'liked' : ''}" 
          on:click={handleLike}
          disabled={!Keypub || !Keypriv}
        >
          {#if likeLoading}
            <div class="like-loading"></div>
          {:else}
            <i class={`like-icon ${isLiked ? 'fas fa-heart' : 'far fa-heart'}`}></i>
          {/if}
          <span class="like-count">{likeCount}</span>
          <span>{isLiked ? '已点赞' : '点赞'}</span>
        </button>
      </div>

      <!-- 评论区域 -->
      <div class="blog-comment-section">
        <h3 class="comment-section-title">
          评论区
          <span class="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{commentList.length}</span>
        </h3>

        <!-- 评论输入框 -->
        {#if Keypub && Keypriv}
          <div class="comment-input-container">
                <div class="comment-author-avatar">
                  <span>{'U'}</span>
                </div>
            <div class="comment-input-wrapper">
              <textarea 
                class="comment-input" 
                placeholder="分享你的想法..." 
                bind:value={commentInput}
              ></textarea>
              <button 
                class="comment-submit-btn" 
                on:click={handleSubmitComment}
                disabled={!commentInput.trim() || submitCommentLoading}
              >
                {#if submitCommentLoading}
                  <div class="submit-loading"></div>
                  <span>提交中...</span>
                {:else}
                  <span>发表评论</span>
                {/if}
              </button>
            </div>
          </div>
        {:else}
          <div class="text-center py-3 mb-4 text-gray-600 bg-gray-50 rounded-lg">
            请先登录再发表评论
          </div>
        {/if}

        <!-- 评论列表 -->
        {#if commentLoading}
          <div class="comments-loading">
            <div class="loading-spinner"></div>
            <p>加载评论中...</p>
          </div>
        {:else if commentList.length === 0}
          <div class="no-comments">
            <i class="far fa-comment-dots no-comments-icon"></i>
            <p>还没有评论，快来抢沙发吧~</p>
          </div>
        {:else}
          <div class="comments-list">
            {#each commentList as comment,index}
              <div class="comment-item">
                <div  >
                  <img class="rounded-full w-8 h-8 rounded-full mr-2 " src={uploadpath + users_profile[comment.user]?.avatarUrl || 'https://picsum.photos/seed/' + comment.user + '/100/100' }>
 
                </div>

                <div class="comment-content-wrapper">
                  <div class="comment-header">
                    <span class="comment-author"> {users_profile[comment.user]?.displayName || '匿名用户'} </span>
                    <span class="comment-time">{comment.formattedTime}</span>
                  </div>
                  <div class="comment-header-divider"></div>
                  <div class="comment-text">{comment.data}</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- 右侧 TOC 容器 -->
  <aside class="right-toc-container" id="right-toc">
    <!-- TOC 内容将由 ViewMD 生成并插入 -->
    <div class="toc-loading" hidden>
      <p class="text-gray-500 text-sm">加载目录中...</p>
    </div>
  </aside>
</div>
    

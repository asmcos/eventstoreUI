<script>
  import { onMount } from 'svelte';
  import { uploadpath } from "$lib/config";
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { upload_file, create_blog, get_blogs, 
    get_books, blog_counts,get_blog_id } from "$lib/esclient";
  import EditBlog from '$lib/EditBlog.svelte';
 
 

  const borderColors = [
    '#60a5fa', // 亮蓝
    '#a78bfa', // 亮紫
    '#22d3ee', // 亮青
    '#86efac', // 亮绿
    '#fda4af', // 亮粉
  ];

  let Keypriv;
  let Keypub;
 
  let blogId =  "";
  // 存储博客基本数据
  let blogData = {
    title: '',
    content: '',
    coverUrl: '',
    labels: [],
  };
  

  // 博客列表与分页相关状态
  let blogs = [];
  let currentPage = 1; // 当前页码
  const pageSize = 5; // 每页数量
  let blogTotalCount = 0; // 总博客数量

  // 计算总页数
 
  let totalPages =  Math.ceil(blogTotalCount / pageSize) || 1;

  // 保存成功后刷新当前页数据
  async function handleSaveSuccess(blog) {
    console.log("保存成功的博客数据：", blog);
    blogId = blog.id
    await loadBlogs(currentPage); // 刷新当前页
    await blog_counts(Keypub, message => {
      if (message.code == 200) {
        blogTotalCount = message.counts;
        totalPages =  Math.ceil(blogTotalCount / pageSize) || 1;
      }
    });
  }

  // 加载指定页的博客数据
  async function loadBlogs(page) {
    if (page < 1 || page > totalPages) return; // 边界检查
    
    blogs = []; // 清空现有数据
    const offset = (page - 1) * pageSize; // 计算偏移量
    await get_blogs(Keypub, 0, offset, pageSize, handle_blogs);
    currentPage = page; // 更新当前页
  }

  // 上一页
  async function prevPage() {
    if (currentPage > 1) {
      await loadBlogs(currentPage - 1);
    }
  }

  // 下一页
  async function nextPage() {
    if (currentPage < totalPages) {
      await loadBlogs(currentPage + 1);
    }
  }

  function getTagValue(tags, t) {
    const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
    return dTag ? dTag[1] : null;
  }

  function handle_blogs(message) {
    if (message == "EOSE") {
      return;
    } else {
      message.data = JSON.parse(message.data);
      if (getTagValue(message.tags, 'd')) {
        message.id = getTagValue(message.tags, 'd');
      }
      blogs = [...blogs, message]; // 累加当前页数据
    }
  }

  function getBlogId( ) {
      let url;
      // 处理传入的URL或使用当前页面URL
      if (blogId) return blogId;

      url = new URL(window.location.href);
   
      let Id = url.searchParams.get('blogid');
      
      blogId = Id;

      return Id; // 如果不存在会返回null
  }
 
  onMount(async () => {
    
    // 初始化用户密钥
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;

    if (!Keypriv) {
      showNotification("请先登录。", "warning");
      return;
    }
    blogId = getBlogId();
    if (blogId) {
        await get_blog_id(blogId,message =>{
            if (message.code == 200){
                if (message.user != Keypub){
                    showNotification("你不是这篇blog的作者,无法编辑",2000,"warning");
                    return ;
                }
                let b = JSON.parse(message.data);
                
                blogData = b;
                 
            }
        })
    }
    // 1. 获取总博客数量
    await blog_counts(Keypub, message => {
      if (message.code == 200) {
        blogTotalCount = message.counts;
        totalPages =  Math.ceil(blogTotalCount / pageSize) || 1;
      }
    });

    // 2. 加载第一页数据
    await loadBlogs(1);
  });

 
  async function handleBlogClick(currentBlogId, e) {
    if (blogId == currentBlogId) return ;

    window.location.href = "/editblog?blogid=" + currentBlogId;


 
  }
  function createNewBlog(){
    window.location.href = "/editblog"
  }
 
 function handleView(){
    window.location.href = "/viewblog?blogid=" + getBlogId();
 }
 

</script>

<style>
  /* 原有样式保持不变 */
  .preview-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #c7d2fe;
  }
  
  .blog-list {
    display: grid;
    gap: 10px;
  }
  
  .blog-card {
    background: white;
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    transition: all 0.3s ease;
    border-left: 4px solid #60a5fa;
    position: relative;
    overflow: hidden;
  }
  
  .blog-card.featured::before {
    content: "推荐";
    position: absolute;
    top: 12px;
    right: -30px;
    width: 100px;
    text-align: center;
    background: #4f46e5;
    color: white;
    font-size: 0.75rem;
    padding: 3px 0;
    transform: rotate(45deg);
  }
  
  .blog-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.15);
    border-left-color: #6366f1;
  }
  
  .blog-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 8px;
    line-height: 1.4;
  }
  
  .blog-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: #94a3b8;
    border-top: 1px solid #f1f5f9;
    padding-top: 12px;
  }
  
  .blog-date {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .blog-author {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 500;
    color: #475569;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
  }
  
  .empty-state i {
    font-size: 2rem;
    margin-bottom: 15px;
    color: #cbd5e1;
  }

  /* 新增分页样式 */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #f1f5f9;
  }
  
  .pagination-btn {
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: white;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .pagination-btn:hover:not(:disabled) {
    background: #f1f5f9;
    color: #4f46e5;
    border-color: #c7d2fe;
  }
  
  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pagination-info {
    font-size: 0.85rem;
    color: #64748b;
  }

    /* 🌟 新增：新建博客按钮样式 */
  .new-blog-btn {
    padding: 8px 16px;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  
  .new-blog-btn:hover {
    background: #4338ca;
    transform: translateY(-1px);
  }
  
  .new-blog-btn:active {
    transform: translateY(0);
  }

  .preview-btn {
    padding: 8px 16px;
    background: #0ea5e9;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-right: 8px;
  }
  
  .preview-btn:hover {
    background: #0284c7;
    transform: translateY(-1px);
  }
  
  .preview-btn:active {
    transform: translateY(0);
  }


</style>

<svelte:head>
  <title>esbook - 博客文章编辑</title>
  <link rel="stylesheet" href="/lib/simplemde/simplemde.min.css">
  <script src="/lib/simplemde/simplemde.min.js"></script>

</svelte:head>

<!-- 主容器 -->
<div class="min-h-screen bg-gray-50">
  <div class="container mx-auto px-4 py-6 max-w-7xl">
    <!-- 页面标题和新建按钮 -->
    <div class="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">博客管理</h1>
        <p class="text-gray-600 mt-2">创建和编辑你的博客文章</p>
      </div>
      <!-- 🌟 新增：新建博客按钮 -->
      <div class="flex gap-3">
        <!-- 🌟 新增：预览按钮 -->
        <button on:click={handleView} class="preview-btn">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          浏览
        </button>
        
        <!-- 新建博客按钮 -->
        <button on:click={createNewBlog} class="new-blog-btn">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          新建博客
        </button>
      </div>
    </div>
    
    <!-- 左右分栏布局 -->
    <div class="flex flex-col lg:flex-row gap-8">
      <!-- 左侧编辑区（占2/3宽度） -->
      <div class="w-full lg:w-2/3">
        <div class="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 p-6 transform transition-all duration-300 hover:shadow-lg">
          <EditBlog 
            initialBlog={blogData} 
            onSaveSuccess={handleSaveSuccess} 
          />
        </div>
      </div>
      
      <!-- 右侧博客列表（占1/3宽度，大屏幕显示） -->
      <div class="w-full lg:w-1/3">
        <div class="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 p-6 sticky top-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-800">我的博客</h3>
            <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              共 {blogTotalCount} 篇
            </span>
          </div>
          
          {#if blogs.length > 0}
            <div class="space-y-5">
              {#each blogs as blog, index}
                <div class="blog-card" style="border-left: 3px solid {borderColors[index % 5]};">
                  <a href={`/editblog?blogid=${blog.id}`} on:click|preventDefault={(e) => handleBlogClick(blog.id, e)} class="block group">
                    <div class="flex flex-col sm:flex-row gap-4 bg-gray-50 rounded-lg overflow-hidden transition-all duration-300 hover:bg-gray-100">
                      <!-- 博客封面图 -->
                      <div class="w-full sm:w-1/3 h-24 sm:h-auto relative overflow-hidden rounded-lg shadow-sm">
                        <img 
                          src={uploadpath + blog.data.coverUrl || 'https://picsum.photos/seed/defaultblog/300/200'} 
                          alt={blog.data.title || '博客封面'} 
                          class="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-105"
                        />
                        <div class="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                      
                      <!-- 博客信息 -->
                      <div class="w-full sm:w-2/3 p-3 flex flex-col justify-between">
                        <div>
                          <h4 class="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {blog.data.title || '无标题'}
                          </h4>
                          
                          <!-- 标签显示 -->
                          {#if blog.data.labels && blog.data.labels.length > 0}
                            <div class="flex flex-wrap gap-1 mt-1">
                              {#each blog.data.labels.slice(0, 2) as label}
                                <span class="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                                  {label}
                                </span>
                              {/each}
                              {#if blog.data.labels.length > 2}
                                <span class="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                                  +{blog.data.labels.length - 2}
                                </span>
                              {/if}
                            </div>
                          {/if}
                        </div>
                        
                        <!-- 日期 -->
                        <div class="blog-meta">
                          <div class="blog-date">
                            <i class="far fa-calendar"></i>
                            {new Date(blog.servertimestamp).toLocaleDateString('zh-CN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          <div class="blog-author">
                            <i class="far fa-user"></i>
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                </div>
              {/each}
            </div>

            <!-- 分页控件 -->
            <div class="pagination">
              <button 
                class="pagination-btn" 
                on:click={prevPage} 
                disabled={currentPage === 1}
              >
                上一页
              </button>
              <span class="pagination-info">
                第 {currentPage} / {totalPages} 页
              </span>
              <button 
                class="pagination-btn" 
                on:click={nextPage} 
                disabled={currentPage === totalPages}
              >
                下一页
              </button>
            </div>
          {:else}
            <div class="text-center py-10 bg-gray-50 rounded-lg">
              <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p class="text-gray-500">暂无博客文章</p>
              <p class="text-sm text-gray-400 mt-1">开始创建你的第一篇博客吧</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
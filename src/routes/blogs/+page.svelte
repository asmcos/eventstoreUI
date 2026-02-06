<script>
  import { onMount } from 'svelte';

  import { uploadpath, siteConfig } from "$lib/config";
  import { get_books, get_blogs, get_users_profile } from "$lib/esclient";
  import Footer from "$lib/footer.svelte";
  
  // 添加分页相关变量
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  export let data;
  const { blogs, users_profile, currentPage = 1, totalPages = 10, totalBlogs = 0, browselogs = {} } = data;
  
  // 从URL参数获取当前页码
  let currentPageNumber ;
  let totalPagesNumber ;
  
  // 初始化分页参数
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    currentPageNumber = pageParam ? parseInt(pageParam) : 1;
    totalPagesNumber = totalPages;
  
     
  });
  
  // 生成分页按钮数组
  function getPaginationButtons(currentPage, totalPages) {
    const buttons = [];
    const maxVisibleButtons = 5; // 最多显示5个页码按钮
    
    if (totalPages <= maxVisibleButtons) {
      // 如果总页数不超过最大可见按钮数，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(i);
      }
    } else {
      // 否则显示部分页码，保持当前页在中间
      let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
      let endPage = startPage + maxVisibleButtons - 1;
      
      if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
      }
      
      // 添加第一页按钮
      if (startPage > 1) {
        buttons.push(1);
        if (startPage > 2) {
          buttons.push('...');
        }
      }
      
      // 添加中间页码
      for (let i = startPage; i <= endPage; i++) {
        buttons.push(i);
      }
      
      // 添加最后一页按钮
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          buttons.push('...');
        }
        buttons.push(totalPages);
      }
    }
    
    return buttons;
  }
  
  // 跳转到指定页码
  function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPagesNumber || pageNum === currentPageNumber) {
      return;
    }
    
    // 构建新的URL
    const url = new URL(window.location.href);
    url.searchParams.set('page', pageNum);
    
    // 跳转到新页面

    window.location.href = url;
  }
  
  // 跳转到第一页
  function goToFirstPage() {
    goToPage(1);
  }
  
  // 跳转到上一页
  function goToPrevPage() {
    goToPage(currentPageNumber - 1);
  }
  
  // 跳转到下一页
  function goToNextPage() {
    goToPage(currentPageNumber + 1);
  }
  
  // 跳转到最后一页
  function goToLastPage() {
    goToPage(totalPagesNumber);
  }

  function getTagValue(tags, t) {
    const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
    return dTag ? dTag[1] : null;
  }

  function getShortBlogId(blog) {
    return `${blog.user.substring(0, 8)}-${blog.id.substring(0, 8)}`;
  }
</script>

<style>
  .blog-card {
    transition: all 0.3s ease;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  
  .blog-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
  
  /* 分页样式 */
  .pagination-container {
    margin-top: 3rem;
    margin-bottom: 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .pagination-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: white;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #e5e7eb;
  }
  
  .pagination-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 8px;
    font-weight: 500;
    transition: all 0.2s ease;
    color: #4b5563;
    background: white;
    border: 1px solid #d1d5db;
    cursor: pointer;
  }
  
  .pagination-btn:hover:not(.disabled) {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }
  
  .pagination-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pagination-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 8px;
    font-weight: 500;
    transition: all 0.2s ease;
    color: #4b5563;
    cursor: pointer;
    border: 1px solid transparent;
  }
  
  .pagination-number:hover:not(.active) {
    background-color: #f3f4f6;
  }
  
  .pagination-number.active {
    background-color: #3b82f6;
    color: white;
  }
  
  .pagination-ellipsis {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    color: #6b7280;
    user-select: none;
  }
  
  .pagination-info {
    margin-right: 1rem;
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .blog-content-preview {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>

<svelte:head>
  <title>{siteConfig.name} - 技术博客 </title>
</svelte:head>

<nav class="bg-white shadow-sm py-4">
  <div class="container mx-auto px-4 flex justify-between items-center">
    <a href="/" class="text-2xl font-bold text-blue-600">ChenLongOS</a>
    <div class="flex space-x-6">
      <a href="/" class="text-gray-700 hover:text-blue-600">首页</a>
      <a href="/blogs" class="text-blue-600 font-medium">博客</a>
    </div>
  </div>
</nav>

<div class="container mx-auto px-4 py-8">
  <div class="text-center mb-12">
    <h1 class="text-4xl font-bold text-gray-900 mb-4">{siteConfig.name} 技术博客</h1>
    <p class="text-xl text-gray-600 max-w-3xl mx-auto">辰龙操作系统 开发技巧、系统设计以及最新技术动态</p>
    
    <!-- 分页信息 -->
    {#if totalBlogs > 0}
      <div class="mt-6 text-lg text-gray-700">
        共 <span class="font-semibold text-blue-600">{totalBlogs}</span> 篇博客文章
        {#if totalPagesNumber > 1}
          ，当前为第 <span class="font-semibold text-blue-600">{currentPageNumber}</span> 页，共 <span class="font-semibold text-blue-600">{totalPagesNumber}</span> 页
        {/if}
      </div>
    {/if}
  </div>

  <!-- 博客列表 - 改为2列布局 -->
  {#if blogs && blogs.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
      {#each blogs as blog}
        <article class="blog-card bg-white rounded-xl overflow-hidden border border-gray-100">
          <div class="p-6">
            <div class="flex items-start mb-4">
              <!-- 图片区域 -->
              <div class="w-32 h-32 rounded-lg overflow-hidden mr-4 flex-shrink-0">
                <img src={uploadpath + blog.data.coverUrl} alt={blog.data.title} class="w-full h-full object-cover">
              </div>
              
              <div class="flex-1">
                <h3 class="font-semibold text-xl mb-2 hover:text-blue-600 transition-colors duration-200">
                  <a href="/viewblog?blogid={getShortBlogId(blog)}">{blog.data.title}</a>
                </h3>
                <div class="space-y-2 mb-3">
                  <div class="flex items-center">
                    <i class="fa fa-calendar-o w-6 text-blue-400"></i>
                    <span class="text-gray-700 ml-2">{blog.servertimestamp.split("T")[0]}</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-eye w-6 text-green-400"></i>
                    <span class="text-gray-700 ml-2">{browselogs[blog.id] || 0} 次</span>
                  </div>
                </div>
              </div>
            </div>
                              
            <div class="flex flex-wrap gap-2 mb-4">
              {#each blog.labels as label}
                <span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                  {label}
                </span>
              {/each}
            </div>
            
            <div class="flex justify-between items-center pt-3 border-t border-gray-100">
              {#if users_profile[blog.user]}
                <div class="flex items-center">
                  <img src={uploadpath + users_profile[blog.user].data.avatarUrl} class="w-8 h-8 rounded-full mr-2">
                  <span class="text-sm text-gray-700">{users_profile[blog.user].data.displayName}</span>
                </div>
              {/if}
              <a href="/viewblog?blogid={getShortBlogId(blog)}" class="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center">
                阅读全文
                <i class="fa fa-angle-right ml-1"></i>
              </a>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <!-- 没有博客时的显示 -->
    <div class="text-center py-16">
      <div class="text-gray-400 text-5xl mb-4">
        <i class="fa fa-file-text-o"></i>
      </div>
      <h3 class="text-2xl font-semibold text-gray-700 mb-2">暂无博客文章</h3>
      <p class="text-gray-500 max-w-md mx-auto">当前页面没有找到博客文章，请尝试其他页码或稍后再来。</p>
    </div>
  {/if}

  <!-- 分页控件 -->
  {#if totalPagesNumber > 1}
    <div class="pagination-container">
      <div class="pagination-wrapper">
        <div class="pagination-info">
          第 {currentPageNumber} / {totalPagesNumber} 页
        </div>
        
        <!-- 第一页按钮 -->
        <button 
          class="pagination-btn {currentPageNumber === 1 ? 'disabled' : ''}" 
          on:click={goToFirstPage}
          disabled={currentPageNumber === 1}
          title="第一页"
        >
          <i class="fa fa-angle-double-left"></i>
        </button>
        
        <!-- 上一页按钮 -->
        <button 
          class="pagination-btn {currentPageNumber === 1 ? 'disabled' : ''}" 
          on:click={goToPrevPage}
          disabled={currentPageNumber === 1}
          title="上一页"
        >
          <i class="fa fa-angle-left"></i>
        </button>
        
        <!-- 页码按钮 -->
        {#each getPaginationButtons(currentPageNumber, totalPagesNumber) as pageNum}
          {#if pageNum === '...'}
            <div class="pagination-ellipsis">...</div>
          {:else}
            <button 
              class="pagination-number {pageNum === currentPageNumber ? 'active' : ''}" 
              on:click={() => goToPage(pageNum)}
            >
              {pageNum}
            </button>
          {/if}
        {/each}
        
        <!-- 下一页按钮 -->
        <button 
          class="pagination-btn {currentPageNumber === totalPagesNumber ? 'disabled' : ''}" 
          on:click={goToNextPage}
          disabled={currentPageNumber === totalPagesNumber}
          title="下一页"
        >
          <i class="fa fa-angle-right"></i>
        </button>
        
        <!-- 最后一页按钮 -->
        <button 
          class="pagination-btn {currentPageNumber === totalPagesNumber ? 'disabled' : ''}" 
          on:click={goToLastPage}
          disabled={currentPageNumber === totalPagesNumber}
          title="最后一页"
        >
          <i class="fa fa-angle-double-right"></i>
        </button>
      </div>
    </div>
  {/if}
</div>

<Footer />
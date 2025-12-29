  <script>


  
  import { onMount } from 'svelte';

  import {uploadpath,siteConfig} from "$lib/config";
  import {get_books,get_blogs,get_users_profile} from "$lib/esclient";
 

  export let data;
  const {  blogs, users_profile } = data;

  function getTagValue(tags,t) {
    const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
    return dTag ? dTag[1] : null;
  }


  function getShortBlogId(blog) {
    return `${blog.user.substring(0, 8)}-${blog.id.substring(0, 8)}`;
  }

    onMount(() => {
        console.log(blogs)
    })

    
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
    .pagination-btn {
        transition: all 0.2s ease;
    }
    .pagination-btn:hover:not(.disabled) {
        background-color: #3b82f6;
        color: white;
    }
    .active-page {
        background-color: #3b82f6;
        color: white;
    }
    .blog-content-preview {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>

<svelte:head>
  <title>{siteConfig.name} - 技术博客  </title>
</svelte:head>


    <nav class="bg-white shadow-sm py-4">
        <div class="container mx-auto px-4 flex justify-between items-center">
            <a href="/" class="text-2xl font-bold text-blue-600">RISC-V Books</a>
            <div class="flex space-x-6">
                <a href="/" class="text-gray-700 hover:text-blue-600">首页</a>
                <a href="/blogs" class="text-blue-600 font-medium">博客</a>
 
            </div>
        </div>
    </nav>


     <div class="container mx-auto px-4 py-8">
        <div class="text-center mb-12">
            <h1 class="text-4xl font-bold text-gray-900 mb-4">RISC-V 技术博客</h1>
            <p class="text-xl text-gray-600 max-w-3xl mx-auto">探索RISC-V架构、开发技巧、系统设计以及最新技术动态</p>
        </div>

        <!-- 博客列表 - 改为2列布局 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <!-- blogs -->
            {#each blogs as blog}
            <article class="blog-card bg-white rounded-xl overflow-hidden border border-gray-100" >
                <div class="p-6">
                    <div class="flex items-start mb-4">
                        <!-- 图片区域 -->
                        <div class="w-32 h-32 rounded-lg overflow-hidden mr-4 flex-shrink-0">
                           <img src={uploadpath+blog.data.coverUrl} alt={blog.data.title} class="w-full h-full object-cover">
                        </div>
                        
                        <div class="flex-1">
                            <h3 class="font-semibold text-xl mb-2 hover:text-blue-600 transition-colors duration-200">
                               <a href="/viewblog?blogid={getShortBlogId(blog)}">{blog.data.title}</a>
                            </h3>
                            <div class="flex items-center text-sm text-gray-500 mb-2">
                                <span class="flex items-center mr-3">
                                    <i class="fa fa-calendar-o mr-1"></i>{blog.servertimestamp.split("T")[0] }
                                </span>
  
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
                            <img src={uploadpath + users_profile[blog.user].data.avatarUrl}   class="w-8 h-8 rounded-full mr-2">
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
    </div>


     <footer class="bg-gray-900 text-white pt-16 pb-8">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        <div>
          <a href="/" class="inline-block mb-4">
            <span class="text-white text-2xl font-bold">RISCVBooks<span class="text-blue-400">资料中心</span></span>
          </a>
          <p class="text-gray-400 mb-6">专注于RISC-V架构、芯片设计与系统软件开发的专业文档资源平台，助力开发者深入技术核心。</p>
          <div class="flex space-x-4">
 
          </div>
        </div>
        <div>
          <h4 class="text-lg font-semibold mb-4">内容导航</h4>
          <ul class="space-y-2">
            <li><a href="#books" class="text-gray-400 hover:text-white transition-colors duration-200">技术文档</a></li>
            <li><a href="#blogs" class="text-gray-400 hover:text-white transition-colors duration-200">开发指南</a></li>
            <li><a href="#topics" class="text-gray-400 hover:text-white transition-colors duration-200">技术领域</a></li>
            <li><a href="#resources" class="text-gray-400 hover:text-white transition-colors duration-200">开发工具</a></li>
            <li><a href="#" class="text-gray-400 hover:text-white transition-colors duration-200">开发者社区</a></li>
          </ul>
        </div>
        <div>
          <h4 class="text-lg font-semibold mb-4">技术领域</h4>
          <ul class="space-y-2">
            <li><a href="#" class="text-gray-400 hover:text-white transition-colors duration-200">RISC-V架构</a></li>
            <li><a href="#" class="text-gray-400 hover:text-white transition-colors duration-200">芯片设计</a></li>
            <li><a href="#" class="text-gray-400 hover:text-white transition-colors duration-200">系统软件</a></li>
            <li><a href="#" class="text-gray-400 hover:text-white transition-colors duration-200">驱动开发</a></li>
            <li><a href="#" class="text-gray-400 hover:text-white transition-colors duration-200">开发工具链</a></li>
          </ul>
        </div>
        <div>
          <h4 class="text-lg font-semibold mb-4">联系我们</h4>
          <ul class="space-y-3">
            <li class="flex items-start">
              <i class="fa fa-envelope mt-1 mr-3 text-gray-400"></i>
              <span class="text-gray-400">{siteConfig.contact}</span>
            </li>
            <li class="flex items-start">
              <i class="fab fa-github mt-1 mr-3 text-gray-400"></i>
              <span class="text-gray-400">https://github.com/riscvbooks</span>
            </li>
            <li class="flex items-start">
              <i class="fa fa-globe mt-1 mr-3 text-gray-400"></i>
              <span class="text-gray-400">{siteConfig.domain}</span>
            </li>
          </ul>
        </div>
      </div>
      <div class="border-t border-gray-800 pt-8">
        <div class="flex flex-col md:flex-row justify-between items-center">
          <p class="text-gray-400 text-sm mb-4 md:mb-0">© 2025 {siteConfig.name}. 保留所有权利。</p>
          <div class="flex space-x-6">
            <a href="#" class="text-gray-400 hover:text-white text-sm transition-colors duration-200">隐私政策</a>
            <a href="#" class="text-gray-400 hover:text-white text-sm transition-colors duration-200">使用条款</a>
            <a href="#" class="text-gray-400 hover:text-white text-sm transition-colors duration-200">内容声明</a>
          </div>
        </div>
      </div>
    </div>
  </footer>

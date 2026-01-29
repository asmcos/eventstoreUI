<script>
  import { onMount } from 'svelte';

  import {uploadpath,siteConfig} from "$lib/config";
  import {get_books,get_blogs,get_users_profile} from "$lib/esclient";
  import Carousel from "$lib/Carousel.svelte";
 
  import Header from "$lib/header.svelte";
  import Footer from "$lib/footer.svelte";

  export let data;
 

  function getTagValue(tags,t) {
    const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
    return dTag ? dTag[1] : null;
  }


  let books      = data.books;
  let blogs      = data.blogs;
  let browselogs = data.browselogs;
   
  let users_profile = data.users_profile;

  let displayedBooks = data.books;

  function goTobook(bookId){
      window.location.href = "/viewbooks/" + bookId;
  }

  function goToblog(blogId){
  
    window.location.href = "/viewblog/?blogid=" + blogId

  }

  function getShortBookId(book) {
    return `${book.user.substring(0, 8)}-${book.id.substring(0, 8)}`;
  }

  function getShortBlogId(blog) {
    return `${blog.user.substring(0, 8)}-${blog.id.substring(0, 8)}`;
  }
 

 

  onMount(() => {
    // 导航栏滚动效果



    // 平滑滚动



  });
</script>




<svelte:head>
  <title>辰龙社区文档中心 - 系统编程与操作系统技术资源</title>
</svelte:head>

<main class="font-inter bg-gray-50 text-gray-900 antialiased">
  <!-- 导航栏 -->
  <Header />


  <!-- 主内容区 -->
  <main class="pt-16">
    <!-- 英雄区域 -->
<!-- 英雄区域 - 调整后的背景色 -->
    <section id="home" class="bg-gradient-to-br from-gray-800 to-gray-700 text-white py-16 md:py-24 relative">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 overflow-hidden opacity-10">
        <div class="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500 rounded-full blur-3xl"></div>
    </div>
    
    <!-- 曲线弧度分割线 -->
    <div class="absolute bottom-0 left-0 right-0">
        <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none" class="w-full h-16">
        <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25" class="fill-gray-50"></path>
        <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" opacity=".5" class="fill-gray-50"></path>
        <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" class="fill-gray-50"></path>
        </svg>
    </div>
    
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div class="flex flex-col md:flex-row items-center">
        <div class="md:w-1/2 mb-10 md:mb-0">
            <div class="inline-block px-4 py-2 bg-blue-500/20 backdrop-blur-sm rounded-full mb-6 border border-blue-500/30">
            <span class="flex items-center text-sm font-medium">
                <i class="fa fa-code mr-2 text-blue-400"></i> 系统编程技术资源平台
            </span>
            </div>
            <div class="group"> 
            <h1 class="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-tight mb-4 relative inline-block group">
                <span class="bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-200">探索</span>
                <span class="text-blue-400 relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-blue-500">系统编程</span>
                <span class="bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-200">的核心世界</span>
                
                <!-- 文字渐变与阴影效果 -->
                <span class="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-500/20 blur-xl opacity-70 -z-10 transform -rotate-1"></span>
                
                <!-- 装饰性下划线 -->
                <span class="block w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mt-1 transform transition-transform duration-500 group-hover:scale-x-100 scale-x-75 origin-left"></span>
            </h1>
            </div>
            <p class="text-gray-300 text-lg md:text-xl mb-8 max-w-lg text-balance">
            汇聚操作系统、Rust编程与系统开发的专业文档、书籍和实战指南
            </p>
            <div class="flex flex-wrap gap-4">
            <a href="#books" class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow">
                浏览技术书籍
            </a>
            <a href="#blogs" class="px-6 py-3 bg-transparent border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-all duration-200">
                阅读博客文章
            </a>
            </div>
        </div>
        <div class="md:w-1/2 flex justify-center md:justify-end relative">
          <div class="relative w-full max-w-md">
            <!-- 背景渐变 -->
            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl blur-xl opacity-70"></div>
            
            <!-- Carousel -->
            <div class="relative z-10">
              <Carousel />
            </div>

            <!-- 左下角统计卡，向左下移动更多 -->
            <div class="absolute -bottom-10 -left-10 bg-white p-3 rounded-lg shadow-lg border border-gray-100 flex items-center gap-2 z-20">
              <div class="text-blue-600">
                <i class="fa fa-book text-2xl"></i>
              </div>
              <div>
                <p class="text-gray-900 font-semibold">50+</p>
                <p class="text-xs text-gray-500">专业技术书籍</p>
              </div>
            </div>

            <!-- 右上角统计卡，向右上移动更多 -->
            <div class="absolute -top-10 -right-10 bg-white p-3 rounded-lg shadow-lg border border-gray-100 flex items-center gap-2 z-20">
              <div class="text-purple-600">
                <i class="fa fa-file-text text-2xl"></i>
              </div>
              <div>
                <p class="text-gray-900 font-semibold">120+</p>
                <p class="text-xs text-gray-500">技术博客文章</p>
              </div>
            </div>
          </div>
        </div>

        </div>
    </div>
    </section>

    <!-- 技术书籍展示区 - 4:3比例图片 -->
    <section id="books" class="py-16 bg-gray-50">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
          <div>
            <h2 class="text-3xl font-bold mb-4">推荐技术书籍</h2>
            <p class="text-gray-600 max-w-2xl">精选系统编程、操作系统与Rust领域的高质量技术书籍</p>
          </div>
          <div class="mt-4 md:mt-0">
            <div class="relative">
              <select class="appearance-none bg-white border border-gray-200 rounded-lg py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200">
                <option>全部书籍</option>
                <option>操作系统</option>
                <option>Rust编程</option>
                <option>系统编程</option>
                <option>最新上架</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {#each displayedBooks as book}
            <div 
              class="group bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col border border-gray-100 cursor-pointer"
              on:click={goTobook(getShortBookId(book))}
            >
              <!-- 图片区域（保持1:1比例） -->
              <div class="relative w-full" style="padding-top: 100%;">
                <img 
                  src={uploadpath + book.data.coverImgurl} 
                  alt={book.data.title} 
                  class="absolute top-0 left-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <!-- 内容区域 -->
              <div class="p-5 flex-grow flex flex-col">
                <!-- 标题 -->
                <h3 class="font-bold text-gray-900 text-lg mb-3 group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[56px]">
                  {book.data.title}
                </h3>
                
                <!-- 标签区域 -->
                <div class="flex flex-wrap gap-2 mb-4">
                  {#each book.labels as label}
                    <span class="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full border border-gray-200">
                      {label}
                    </span>
                  {/each}
                </div>

                <!-- 底部区域（包含浏览量和按钮） -->
                <div class="mt-auto pt-4 border-t border-gray-100">
                  <div class="flex items-center justify-between">
                    <!-- 浏览量（显示在底部左侧） -->
                    <div class="flex items-center text-gray-600">
                      <div class="flex items-center bg-gray-50 px-3 py-1.5 rounded-lg">
                        <svg class="w-4 h-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                          <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"></path>
                        </svg>
                        <span class="text-sm font-medium">
                          {browselogs[book.id] || 0}
                        </span>
                      </div>
                    </div>
                    
                    <!-- 阅读按钮 -->
                    <button class="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5">
                      阅读
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <div class="mt-12 text-center">
          <a href="#" class="inline-flex items-center px-6 py-3 bg-white border border-gray-200 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition-all duration-200">
            查看更多书籍
            <i class="fa fa-arrow-right ml-2"></i>
          </a>
        </div>
      </div>
    </section>

    <!-- 专题领域 -->
    <section id="topics" class="py-16 bg-white">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold mb-4">核心技术专题</h2>
          <p class="text-gray-600 max-w-2xl mx-auto">聚焦系统编程领域的核心技术方向</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <!-- Rust系统编程专题 -->
          <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 hover:shadow-md transition-all duration-300">
            <div class="w-14 h-14 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-6">
              <i class="fa fa-code text-2xl"></i>
            </div>
            <h3 class="text-xl font-bold mb-3">Rust系统编程</h3>
            <p class="text-gray-600 mb-4">探索Rust在系统开发中的应用，包括内存安全、并发编程和底层硬件交互技术</p>
            <ul class="space-y-2 mb-6">
              <li class="flex items-center text-sm text-gray-700">
                <i class="fa fa-check-circle text-blue-500 mr-2"></i>
                <span>Rust内存模型与所有权系统</span>
              </li>
              <li class="flex items-center text-sm text-gray-700">
                <i class="fa fa-check-circle text-blue-500 mr-2"></i>
                <span>异步编程与高性能IO</span>
              </li>
              <li class="flex items-center text-sm text-gray-700">
                <i class="fa fa-check-circle text-blue-500 mr-2"></i>
                <span>系统工具与库开发实践</span>
              </li>
            </ul>
            <a href="#" class="inline-flex items-center text-blue-600 font-medium hover:text-blue-700 transition-colors">
              进入专题 <i class="fa fa-arrow-right ml-1"></i>
            </a>
          </div>

          <!-- 操作系统内核专题 -->
          <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100 hover:shadow-md transition-all duration-300">
            <div class="w-14 h-14 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-6">
              <i class="fa fa-cogs text-2xl"></i>
            </div>
            <h3 class="text-xl font-bold mb-3">操作系统内核</h3>
            <p class="text-gray-600 mb-4">深入解析操作系统核心机制，包括进程管理、内存分配和文件系统实现原理</p>
            <ul class="space-y-2 mb-6">
              <li class="flex items-center text-sm text-gray-700">
                <i class="fa fa-check-circle text-purple-500 mr-2"></i>
                <span>进程调度与同步机制</span>
              </li>
              <li class="flex items-center text-sm text-gray-700">
                <i class="fa fa-check-circle text-purple-500 mr-2"></i>
                <span>虚拟内存与分页管理</span>
              </li>
              <li class="flex items-center text-sm text-gray-700">
                <i class="fa fa-check-circle text-purple-500 mr-2"></i>
                <span>内核模块开发与调试</span>
              </li>
            </ul>
            <a href="#" class="inline-flex items-center text-purple-600 font-medium hover:text-purple-700 transition-colors">
              进入专题 <i class="fa fa-arrow-right ml-1"></i>
            </a>
          </div>

          <!-- 系统性能优化专题 -->
          <div class="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6 border border-green-100 hover:shadow-md transition-all duration-300">
            <div class="w-14 h-14 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-6">
              <i class="fa fa-tachometer text-2xl"></i>
            </div>
            <h3 class="text-xl font-bold mb-3">系统性能优化</h3>
            <p class="text-gray-600 mb-4">学习系统级性能分析与优化技术，提升软件运行效率和资源利用率</p>
            <ul class="space-y-2 mb-6">
              <li class="flex items-center text-sm text-gray-700">
                <i class="fa fa-check-circle text-green-500 mr-2"></i>
                <span>性能分析工具与方法论</span>
              </li>
              <li class="flex items-center text-sm text-gray-700">
                <i class="fa fa-check-circle text-green-500 mr-2"></i>
                <span>内存与缓存优化策略</span>
              </li>
              <li class="flex items-center text-sm text-gray-700">
                <i class="fa fa-check-circle text-green-500 mr-2"></i>
                <span>并发与多线程优化</span>
              </li>
            </ul>
            <a href="#" class="inline-flex items-center text-green-600 font-medium hover:text-green-700 transition-colors">
              进入专题 <i class="fa fa-arrow-right ml-1"></i>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- 博客文章区 - 120x120正方形图片 -->
    <section id="blogs" class="py-16 bg-gray-50">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
          <div>
            <h2 class="text-3xl font-bold mb-4">最新博客文章</h2>
            <p class="text-gray-600 max-w-2xl">系统编程与操作系统领域的技术分享与实践指南</p>
          </div>
          <div class="mt-4 md:mt-0">
            <div class="relative">
              <select class="appearance-none bg-white border border-gray-200 rounded-lg py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200">
                <option>最新发布</option>
                <option>Rust编程</option>
                <option>操作系统</option>
                <option>系统编程</option>
                <option>热门文章</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <i class="fa fa-chevron-down text-xs"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {#each blogs as blog}
            <article class="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100" on:click={goToblog(getShortBlogId(blog))}>
              <div class="p-5">
                <div class="flex items-start mb-4">
                  <!-- 120x120正方形小图片 -->
                  <div class="w-28 h-28 rounded-lg overflow-hidden mr-4 flex-shrink-0">
                    <img src={uploadpath+blog.data.coverUrl} alt={blog.data.title} class="w-full h-full object-cover">
                  </div>
                  
                  <div class="flex-1">
                     
                    <h3 class="font-semibold text-lg mb-2 hover:text-blue-600 transition-colors duration-200">
                      <a href=" "  >{blog.data.title}</a>

                    </h3>
                      <div class="space-y-2 mb-3">
                        <div class="flex items-center">
                          <i class="fa fa-calendar-o w-6 text-blue-400"></i>
                          <span class="text-gray-700 ml-2"> {blog.servertimestamp.split("T")[0]}</span>
                        </div>
                        <div class="flex items-center">
                          <i class="fa fa-eye w-6 text-green-400"></i>
                          <span class="text-gray-700 ml-2"> {browselogs[blog.id] || 0} 次</span>
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
                    <img src={uploadpath + users_profile[blog.user].data.avatarUrl}   class="w-8 h-8 rounded-full mr-2">
                    <span class="text-sm text-gray-700">{users_profile[blog.user].data.displayName}</span>
                  </div>
                  {/if}
                  <a href="" class="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center" >

                    阅读全文
                    <i class="fa fa-angle-right ml-1"></i>
                  </a>
                </div>
              </div>
            </article>
          {/each}
        </div>

        <div class="mt-12 text-center">
          <a href="/blogs" class="inline-flex items-center px-6 py-3 bg-white border border-gray-200 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition-all duration-200">
            查看更多文章
            <i class="fa fa-arrow-right ml-2"></i>
          </a>
        </div>
      </div>
    </section>

    <!-- 资源下载区 -->
    <section id="resources" class="py-16 bg-white">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold mb-4">技术资源下载</h2>
          <p class="text-gray-600 max-w-2xl mx-auto">获取系统编程与操作系统开发相关的实用资源</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div class="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md transition-all duration-300">
            <div class="flex items-center mb-6">
              <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mr-4">
                <i class="fa fa-file-code-o text-xl"></i>
              </div>
              <div>
                <h3 class="text-xl font-bold">Rust系统编程示例代码</h3>
                <p class="text-gray-600">实用代码片段与完整项目示例</p>
              </div>
            </div>
            <ul class="space-y-3 mb-6">
              <li class="flex items-center">
                <i class="fa fa-check text-green-500 mr-2"></i>
                <span>内存安全示例代码集</span>
              </li>
              <li class="flex items-center">
                <i class="fa fa-check text-green-500 mr-2"></i>
                <span>异步IO操作实现</span>
              </li>
              <li class="flex items-center">
                <i class="fa fa-check text-green-500 mr-2"></i>
                <span>系统调用封装库</span>
              </li>
            </ul>
            <button class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium flex items-center">
              <i class="fa fa-download mr-2"></i> 下载资源包
            </button>
          </div>
          
          <div class="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md transition-all duration-300">
            <div class="flex items-center mb-6">
              <div class="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mr-4">
                <i class="fa fa-file-pdf-o text-xl"></i>
              </div>
              <div>
                <h3 class="text-xl font-bold">操作系统内核学习手册</h3>
                <p class="text-gray-600">内核原理与实践指南文档</p>
              </div>
            </div>
            <ul class="space-y-3 mb-6">
              <li class="flex items-center">
                <i class="fa fa-check text-green-500 mr-2"></i>
                <span>Linux内核架构详解</span>
              </li>
              <li class="flex items-center">
                <i class="fa fa-check text-green-500 mr-2"></i>
                <span>进程管理与调度手册</span>
              </li>
              <li class="flex items-center">
                <i class="fa fa-check text-green-500 mr-2"></i>
                <span>内核调试实战指南</span>
              </li>
            </ul>
            <button class="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 text-sm font-medium flex items-center">
              <i class="fa fa-download mr-2"></i> 下载PDF文档
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- 页脚 -->
  <Footer />
</main>

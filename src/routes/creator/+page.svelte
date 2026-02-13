<script>
  import { onMount } from 'svelte';
  import { uploadpath } from "$lib/config";
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { upload_file,create_blog,get_blogs,
      get_books,blog_counts,book_counts } from "$lib/esclient";
  import EditBlog from '$lib/EditBlog.svelte';

  let Keypriv;
  let Keypub;
  let simplemde;
  
  let blogs = [];
  let books = [];
  let blogTotalCount = 0 ;
  let bookTotalCount = 0 ;

  // 存储封面图片的Uint8Array数据
  let coverImageData = null;
  // 存储博客基本数据
  let blogData = {
    title: '',
    content: '',
    coverUrl: '',
    labels:[],
  };
 

  function handleSaveSuccess(blog) {
    showNotification("博客发布成功，可以点击右侧更新。",3000,"info");
 
  }
  function getTagValue(tags,t) {
    const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
    return dTag ? dTag[1] : null;
  }

  function handle_blogs(message){
    if (message == "EOSE"){
      ;
    }
    else {
      let temp = blogs;
      message.data = JSON.parse(message.data)
      if (getTagValue(message.tags,'d')){
          message.id = getTagValue(message.tags,'d');
      } 
      temp.push(message)
      blogs = temp;
    }
  }

  function handle_books(message){
    if (message == "EOSE"){
      ;
    }
    else {
      let temp = books;
      if (getTagValue(message.tags,'d')){
            message.id = getTagValue(message.tags,'d');
      }
      
      temp.push(message)
      books = temp;
    }
  }

  function handle_blog_counts(message){
    if (message.code == 200) {
      blogTotalCount = message.counts;
    }
  }
  function handle_book_counts(message){
    if (message.code == 200) {
      bookTotalCount = message.counts;
    }
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
    // 0 isDraft 表示获取所有的blog
    // offset=0
    // limit = 4
    await get_blogs(Keypub, 0, 0, 4,handle_blogs);
    await get_books(Keypub, 0, 10,  handle_books);
 
    await blog_counts(Keypub,handle_blog_counts);
    await book_counts(Keypub,handle_book_counts);

    return () => {
 
    };
  });


 
</script>

<style>
  /* 页面核心样式 */
  .editor-toolbar {
    background: linear-gradient(to bottom, #F9FAFB, #E5E7EB);
  }

  .content-card {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .content-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .markdown-body {
    font-family: 'Noto Serif SC', serif;
    line-height: 1.8;
    font-size: 17px;
  }

  .markdown-body h1, .markdown-body h2, .markdown-body h3 {
    font-weight: 700;
    margin-top: 1.5em;
    margin-bottom: 0.8em;
    color: #1F2937;
  }

  .markdown-body h1 {
    font-size: 2.2rem;
    border-bottom: 2px solid #E5E7EB;
    padding-bottom: 0.3em;
  }

  .markdown-body h2 {
    font-size: 1.8rem;
  }

  .markdown-body h3 {
    font-size: 1.5rem;
  }

  .markdown-body p {
    margin-bottom: 1.2em;
  }

  .markdown-body blockquote {
    border-left: 4px solid #4F46E5;
    padding: 0 1em;
    color: #4B5563;
    margin: 1.5em 0;
  }

  /* 编辑器样式 */
  .CodeMirror {
    min-height: 500px !important;
    border: 1px solid #E5E7EB !important;
    border-radius: 0 0 0.5rem 0.5rem !important;
  }

  .editor-toolbar {
    border-radius: 0.5rem 0.5rem 0 0 !important;
  }

  /* 图片上传区域样式 */
  #previewImage {
    object-fit: cover;
  }
  
  .border-primary {
    border-color: #4F46E5;
  }
  
  /* 隐藏文件输入框 */
  #coverFileInput {
    display: none;
  }

    /* 书籍封面基础样式 */
  .book-cover {
    /* 保持封面的固定尺寸，与布局匹配 */
    width: 64px; /* 16rem 转换为具体像素 */
    height: 80px; /* 20rem 转换为具体像素 */
    
    /* 确保封面图正确显示 */
    background-color: #f3f4f6; /* 加载前的占位背景 */
    border-radius: 4px; /* 轻微圆角，增加质感 */
    overflow: hidden; /* 裁剪超出封面的内容 */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* 轻微阴影，增强立体感 */
    
    /* 封面悬停效果 */
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  /* 悬停动画 */
  .book-cover:hover {
    transform: translateY(-2px); /* 轻微上浮 */
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15); /* 增强阴影 */
  }

  /* 书籍封面丝带效果（如果需要标记新书/热门等） */
  .book-ribbon {
    position: relative;
  }

  /* 可选：右上角丝带标记样式 */
  .book-ribbon::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 20px 20px 0;
    border-color: transparent #4f46e5 transparent transparent; /* 主色调丝带 */
    opacity: 0.8;
  }

  /* 封面图片容器样式 */
  .book-cover > div {
    width: 100%;
    height: 100%;
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover; /* 覆盖整个容器，可能裁剪部分内容 */
    transition: background-image 0.3s ease; /* 图片切换动画 */
  }

  /* 加载失败时的默认图标容器 */
  .book-cover > div:last-child {
    background-color: #9ca3af; /* 加载失败时的背景色 */
  }

  /* 适配不同屏幕尺寸 */
  @media (max-width: 640px) {
    .book-cover {
      width: 56px;
      height: 70px;
    }
  }
</style>

<svelte:head>
    <title>esbook - 创作空间</title>
</svelte:head>

<!-- 页面内容 -->
<!-- 顶部统计卡片 -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
  <div class="bg-white rounded-xl shadow-sm p-6">
    <div class="flex items-center">
      <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
        <i class="fas fa-file-alt text-blue-500 text-xl"></i>
      </div>
      <div>
        <h3 class="text-sm text-gray-500">博客文章</h3>
        <p class="text-2xl font-bold text-gray-800">{blogTotalCount} 篇</p>
      </div>
    </div>
    <div class="mt-4">
      <div class="flex justify-between text-sm text-gray-600 mb-1">
        <span>已发布</span>
        <span></span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div class="bg-blue-500 h-2 rounded-full" style="width: 66%"></div>
      </div>
    </div>
  </div>

  <div class="bg-white rounded-xl shadow-sm p-6">
    <div class="flex items-center">
      <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
        <i class="fas fa-book text-green-500 text-xl"></i>
      </div>
      <div>
        <h3 class="text-sm text-gray-500">书籍作品</h3>
        <p class="text-2xl font-bold text-gray-800">{bookTotalCount} 本</p>
      </div>
    </div>
    <div class="mt-4">
      <div class="flex justify-between text-sm text-gray-600 mb-1">
        <span>已完成</span>
        <span>1</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div class="bg-green-500 h-2 rounded-full" style="width: 33%"></div>
      </div>
    </div>
  </div>

  <div class="bg-white rounded-xl shadow-sm p-6">
    <div class="flex items-center">
      <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mr-4">
        <i class="fas fa-eye text-purple-500 text-xl"></i>
      </div>
      <div>
        <h3 class="text-sm text-gray-500">今日阅读</h3>
        <p class="text-2xl font-bold text-gray-800">1,258 次</p>
      </div>
    </div>
    <div class="mt-4">
      <div class="flex justify-between text-sm text-gray-600 mb-1">
        <span>总阅读量</span>
        <span>28.9K</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div class="bg-purple-500 h-2 rounded-full" style="width: 45%"></div>
      </div>
    </div>
  </div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
  <!-- 博客编辑器 -->
  <div class="bg-white rounded-xl shadow-sm overflow-hidden">

    <EditBlog 
      initialBlog={blogData} 
      onSaveSuccess={handleSaveSuccess} 
    />
  
 
    
  </div>

  <!-- 内容管理 -->
  <div class="space-y-8">
    <!-- 近期博客 -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-gray-800">近期博客</h2>
          <a href="/editblog" class="text-primary text-sm hover:underline">查看全部</a>
        </div>
      </div>

      <div class="p-6">
        <div class="space-y-4">
         {#each blogs as blog}
          <div class="content-card bg-white border border-gray-200 rounded-lg p-4 hover:border-primary">
            <div class="flex">
              <div class="flex-shrink-0 w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
                <img src="{uploadpath + blog.data.coverUrl}" alt="博客封面" class="w-full h-full object-cover">
              </div>
              <div class="ml-4">
                <h3 class="font-bold text-gray-800">{blog.data.title}</h3>
                <div class="flex items-center mt-1 text-sm text-gray-500">
                  <span>技术 · {blog.servertimestamp.split("T")[0]}</span>
                  <span class="mx-2">|</span>
                  <span><i class="fas fa-eye mr-1"></i>  </span>
                </div>
              </div>
              <div class="ml-auto flex items-center">
                <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">已发布</span>
              </div>
            </div>
            <div class="mt-3 flex space-x-2"> 
             <a href="/editblog?blogid={blog.id}">
              <button class="text-sm text-gray-600 hover:text-primary">
               <i class="fas fa-edit mr-1"></i> 编辑
              </button>
              </a>
              <button class="text-sm text-gray-600 hover:text-red-500">
                <i class="fas fa-trash-alt mr-1"></i> 删除
              </button>
              <button class="text-sm text-gray-600 hover:text-green-500">
                <i class="fas fa-chart-line mr-1"></i> 数据
              </button>
            </div>
          </div>
          {/each}

 
 
        </div>
      </div>
    </div>

    <!-- 我的书籍 -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-gray-800">我的书籍</h2>
          <a href="/editbook" class="text-primary text-sm hover:underline">新建书籍</a>
        </div>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
        {#each books as book}
          <div class="content-card bg-white border border-gray-200 rounded-lg p-4 hover:border-primary">
            <div class="flex">
               <a href="/editbook?bookid={book.id}">
              <!-- 使用书籍封面图替换纯色背景 -->
              <div class="book-cover book-ribbon relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden">
                <!-- 背景图使用书籍的封面图片 -->
                <div style="background-image: url('{uploadpath + book.data.coverImgurl}'); 
                            background-size: cover; 
                            background-position: center; 
                            width: 100%; 
                            height: 100%;">
                </div>
                <!-- 当封面图加载失败时显示默认图标 -->
                <div class="absolute inset-0 flex items-center justify-center text-white bg-gray-400 hidden" 
                    on:error|once="{e => e.currentTarget.classList.remove('hidden')}">
                  <i class="fas fa-book text-2xl"></i>
                </div>
              </div>
              </a>
              
              <div class="ml-4">
                <a href="/editbook?bookid={book.id}"><h3 class="font-bold text-gray-800">{book.data.title}</h3>
                <div class="flex items-center mt-1 text-sm text-gray-500">
                  <span>{book.labels && book.labels.length > 0 ? book.labels[0] : '未分类'}</span>
                  <span class="mx-2">|</span>
                  <span>{book.servertimestamp.split("T")[0] } </span>
                </div>
                <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div class="bg-green-500 h-2 rounded-full" style="width: 100%"></div>
                </div>
                </a>
              </div>
            </div>
          </div>
        {/each}
 

          <div class="content-card bg-white border border-gray-200 rounded-lg p-4 hover:border-primary">
            <a href="/editbook">
              <div class="flex items-center justify-center h-full">
                <button class="flex flex-col items-center text-gray-400 hover:text-primary">
                  <div class="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mb-2">
                    <i class="fas fa-plus text-xl"></i>
                  </div>
                  <span>新建书籍</span>
                </button>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

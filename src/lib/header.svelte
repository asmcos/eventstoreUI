<script>
  import { onMount } from 'svelte';
    onMount(async () => {
      const navbar = document.getElementById('navbar');
        window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navbar.classList.add('shadow-md', 'bg-gray-900/95');
            navbar.classList.remove('bg-gray-900');
        } else {
            navbar.classList.remove('shadow-md', 'bg-gray-900/95');
            navbar.classList.add('bg-gray-900');
        }
        });

                // 移动端菜单切换
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
        });

        // 搜索模态框
        const searchBtn = document.getElementById('search-btn');
        const closeSearchBtn = document.getElementById('close-search-btn');
        const searchModal = document.getElementById('search-modal');
        const searchModalContent = document.getElementById('search-modal-content');

        searchBtn.addEventListener('click', () => {
        searchModal.classList.remove('hidden');
        setTimeout(() => {
            searchModalContent.classList.remove('scale-95', 'opacity-0');
            searchModalContent.classList.add('scale-100', 'opacity-100');
        }, 10);
        });

        closeSearchBtn.addEventListener('click', () => {
        searchModalContent.classList.remove('scale-100', 'opacity-100');
        searchModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            searchModal.classList.add('hidden');
        }, 300);
        });

        // 点击模态框外部关闭
        searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
            searchModalContent.classList.remove('scale-100', 'opacity-100');
            searchModalContent.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
            searchModal.classList.add('hidden');
            }, 300);
        }
        });
  
    
    });
</script>
<style>
.logo-title {
    font-size: 2.5rem;
    font-weight: 800;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin: 0;
    line-height: 1;
    text-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
    letter-spacing: -0.5px;
}

/* 创作中心按钮样式 */
.creator-btn {
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    color: white;
    font-weight: 600;
    padding: 0.5rem 1.25rem;
    border-radius: 0.375rem;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.creator-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35);
    background: linear-gradient(90deg, #2563eb, #7c3aed);
}

/* 移动端创作中心按钮样式 */
.mobile-creator-btn {
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    color: white;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 0.5rem;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}
</style>

 
<header id="navbar" class="fixed w-full top-0 z-50 transition-all duration-300 bg-gray-900">
    <div class="border-b border-gray-800">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <div class="flex items-center">
            <a href="https://docs.chenlongos.cn" class="flex items-center">
              <span class="logo-title ">辰龙文档中心</span>
            </a>
          </div>

          <!-- 导航链接 - 桌面版 -->
          <nav class="hidden md:flex space-x-8">
            <a href="https://docs.chenlongos.cn" class="text-gray-300 hover:text-white font-medium transition-colors duration-200">首页</a>
            <a href="https://docs.chenlongos.cn/viewbooks" class="text-gray-300 hover:text-white font-medium transition-colors duration-200">技术书籍</a>
            <a href="https://docs.chenlongos.cn/blogs" class="text-gray-300 hover:text-white font-medium transition-colors duration-200">博客文章</a>
            <a href="https://docs.chenlongos.cn/viewtopics" class="text-gray-300 hover:text-white font-medium transition-colors duration-200">话题</a>
          </nav>

          <!-- 右侧操作区 -->
          <div class="flex items-center space-x-4">
            <!-- 创作中心按钮（桌面版） -->
            <a href="https://docs.chenlongos.cn/creator" class=" md:block creator-btn">
              创作中心
            </a>
            
            <!-- 搜索按钮 -->
            <button id="search-btn" class="p-2 rounded-full hover:bg-gray-800 transition-colors duration-200">
              <i class="fa fa-search text-gray-400"></i>
            </button>
            
            <!-- 移动端菜单按钮 -->
            <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-200">
              <i class="fa fa-bars"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 移动端菜单 -->
    <div id="mobile-menu" class="hidden md:hidden bg-gray-800 border-b border-gray-700 shadow-lg">
      <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
        <a href="https://docs.chenlongos.cn" class="block px-3 py-2 rounded-md text-base font-medium hover:bg-gray-700 text-white transition-colors duration-200">首页</a>
        <a href="https://docs.chenlongos.cn/viewbooks" class="block px-3 py-2 rounded-md text-base font-medium hover:bg-gray-700 text-white transition-colors duration-200">技术书籍</a>
        <a href="https://docs.chenlongos.cn/blogs" class="block px-3 py-2 rounded-md text-base font-medium hover:bg-gray-700 text-white transition-colors duration-200">博客文章</a>
        <a href="https://docs.chenlongos.cn/viewtopics" class="block px-3 py-2 rounded-md text-base font-medium hover:bg-gray-700 text-white transition-colors duration-200">话题</a>
        
        <!-- 移动端创作中心按钮 -->
        <div class="pt-2">
          <a href="https://docs.chenlongos.cn/creator" class="mobile-creator-btn">
            创作中心
          </a>
        </div>
      </div>
    </div>
  </header>


  <!-- 搜索模态框 -->
  <div id="search-modal" class="fixed inset-0 bg-black/70 z-50 hidden flex items-center justify-center p-4">
    <div class="bg-gray-800 rounded-xl w-full max-w-3xl p-6 shadow-xl transform transition-all duration-300 scale-95 opacity-0" id="search-modal-content">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold text-white">技术资源搜索</h3>
        <button id="close-search-btn" class="text-gray-400 hover:text-white transition-colors duration-200">
          <i class="fa fa-times text-xl"></i>
        </button>
      </div>
      <div class="relative">
        <input type="text" placeholder="搜索系统编程、操作系统、Rust相关资源..." class="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200">
        <i class="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
      </div>
      <div class="mt-6">
        <h4 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">热门技术搜索</h4>
        <div class="flex flex-wrap gap-2">
          <span class="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 cursor-pointer transition-colors duration-200">Rust系统编程</span>
          <span class="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 cursor-pointer transition-colors duration-200">Linux内核</span>
          <span class="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 cursor-pointer transition-colors duration-200">操作系统原理</span>
          <span class="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 cursor-pointer transition-colors duration-200">Rust异步编程</span>
          <span class="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm hover:bg-gray-600 cursor-pointer transition-colors duration-200">内存安全</span>
        </div>
      </div>
    </div>
  </div>
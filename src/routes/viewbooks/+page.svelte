 <script>
  import { onMount } from 'svelte';
  import "$lib/editbook.css";
  import {uploadpath} from "$lib/config";
  import {get_books} from "$lib/esclient";

 

 function getTagValue(tags,t) {
  const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
  return dTag ? dTag[1] : null;
}


  let books = [];
  let displayedBooks = [...books];
  function handleBooks(e){
    console.log(e);
    if (e != "EOSE"){
        // 改变bookId
        if (getTagValue(e.tags,'d')){
            e.id = getTagValue(e.tags,'d');
        } 

        books.push(e)
    } else {
        displayedBooks = [...books]
    }
    console.log(displayedBooks)
  }
  //offset 0, limit 20
  get_books(null,0,20,handleBooks);
 

    

    
    // 状态变量
    let mobileMenuOpen = false;
    let selectedBook = null;
    let modalOpen = false;
    let scrolled = false;
    let activeCategory = "科学技术";
   
    
    // 分类筛选（科技 / 机器人 / 操作系统 / 社区 等）
    const categories = [
        { name: "科学技术", icon: "microchip", color: "text-cyan-400" },
        { name: "机器人", icon: "robot", color: "text-blue-400" },
        { name: "操作系统", icon: "desktop", color: "text-primary" },
        { name: "开发者社区", icon: "users", color: "text-green-400" },
        { name: "人工智能", icon: "brain", color: "text-purple-400" },
        { name: "开源与工具", icon: "code-branch", color: "text-yellow-400" }
    ];
    
    // 生成评分星星
    function generateRatingStars(rating) {
        let stars = '';
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star"></i>';
        }
        
        if (hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        }
        
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star"></i>';
        }
        
        return stars;
    }
    
    // 打开书籍详情模态框
    function openBookModal(book) {
        selectedBook = book;
        modalOpen = true;
        document.body.style.overflow = 'hidden';
    }
    
    // 关闭模态框
    function closeModal() {
        modalOpen = false;
        document.body.style.overflow = '';
    }
    
    // 加载更多书籍
    function loadMoreBooks() {
        // 复制前4本书籍卡片并修改部分内容
        const newBooks = books.slice(0, 4).map((book, index) => ({
            ...book,
            id: book.id + 8 + index,
            ribbon: index % 2 === 0 ? "新书" : "畅销"
        }));
        
        displayedBooks = [...displayedBooks, ...newBooks];
    }

    function goTobook(bookId){
        window.location.href = "/viewbooks/" + bookId;
    }
    
    // 导航栏滚动效果
    onMount(() => {
        window.addEventListener('scroll', () => {
            scrolled = window.scrollY > 50;
        });
    });
</script>

<svelte:head>
    <title>辰龙机器人操作 | 探索无限知识世界</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
</svelte:head>

<style>
    :global(body) {
        font-family: 'Inter', sans-serif;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        color: #F8FAFC;
        min-height: 100vh;
        scroll-behavior: smooth;
        margin: 0;
        padding: 0;
        overflow-x: hidden;
    }
    
    /* 书籍卡片动画 */
    .book-card {
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        perspective: 1500px;
    }
    
    .book-card-inner {
        transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform-style: preserve-3d;
    }
    
    .book-card:hover .book-card-inner {
        transform: rotateY(15deg) translateZ(10px);
    }
    
    .book-card:hover {
        transform: translateY(-8px);
        box-shadow: 0 20px 30px rgba(0, 0, 0, 0.4);
    }
    
    .book-cover {
        height: 280px;
        background-size: cover;
        background-position: center;
        border-radius: 8px 8px 0 0;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        transition: all 0.4s ease;
    }
    
    .book-card:hover .book-cover {
        height: 290px;
    }
    
    .book-info {
        background: rgba(30, 41, 59, 0.85);
        backdrop-filter: blur(10px);
        border-radius: 0 0 8px 8px;
        padding: 1.5rem;
        transition: all 0.4s ease;
    }
    
    .book-title {
        font-weight: 700;
        font-size: 1.25rem;
        margin-bottom: 0.5rem;
        color: #F8FAFC;
        transition: all 0.3s ease;
    }
    
    .book-card:hover .book-title {
        color: #a5b4fc;
    }
    
    .book-meta {
        color: #94A3B8;
        font-size: 0.875rem;
        margin-top: 0.5rem;
    }
    
    /* 筛选按钮动画 */
    .filter-btn {
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    }
    
    .filter-btn::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 0;
        height: 3px;
        background-color: #4F46E5;
        transition: width 0.3s ease;
    }
    
    .filter-btn:hover::after, .filter-btn.active::after {
        width: 100%;
    }
    
    .filter-btn:hover, .filter-btn.active {
        background-color: rgba(79, 70, 229, 0.15);
        color: #a5b4fc;
        transform: translateY(-3px);
    }
    
    /* 导航栏滚动效果 */
    .navbar {
        transition: all 0.3s ease;
    }
    
    .navbar.scrolled {
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
        background: rgba(30, 41, 59, 0.9);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    
    /* 按钮动画 */
    .btn-primary {
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        z-index: 1;
    }
    
    .btn-primary::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        transition: all 0.6s ease;
        z-index: -1;
    }
    
    .btn-primary:hover::before {
        left: 100%;
    }
    
    /* 搜索框动画 */
    .search-input {
        transition: all 0.3s ease;
    }
    
    .search-input:focus {
        width: 220px;
    }
    
    /* 头部区域动画 */
    .hero-content {
        opacity: 0;
        transform: translateY(30px);
        animation: fadeUp 1s ease forwards 0.3s;
    }
    
    @keyframes fadeUp {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* 书籍卡片加载动画 */
    .book-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 2rem;
    }
    
    .book-card {
        opacity: 0;
        transform: translateY(20px);
        animation: fadeInUp 0.5s ease forwards;
    }
    
    @keyframes fadeInUp {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* 为每个卡片设置不同的延迟 */
    .book-card:nth-child(1) { animation-delay: 0.1s; }
    .book-card:nth-child(2) { animation-delay: 0.2s; }
    .book-card:nth-child(3) { animation-delay: 0.3s; }
    .book-card:nth-child(4) { animation-delay: 0.4s; }
    .book-card:nth-child(5) { animation-delay: 0.5s; }
    .book-card:nth-child(6) { animation-delay: 0.6s; }
    .book-card:nth-child(7) { animation-delay: 0.7s; }
    .book-card:nth-child(8) { animation-delay: 0.8s; }
    
    /* 移动端适配 */
    @media (max-width: 768px) {
        .header-height {
            height: auto;
            min-height: 80vh;
        }
        
        .search-input:focus {
            width: 180px;
        }
        
        .book-cover {
            height: 240px;
        }
        
        .book-card:hover .book-cover {
            height: 250px;
        }
    }
    
    /* 书籍详情模态框 */
    .modal {
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .modal.active {
        opacity: 1;
        visibility: visible;
    }
    
    .modal-content {
        background-color: #1e293b;
        border-radius: 12px;
        width: 90%;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
        transform: scale(0.9);
        transition: transform 0.3s ease;
    }
    
    .modal.active .modal-content {
        transform: scale(1);
    }
    
    .close-modal {
        position: absolute;
        top: 20px;
        right: 20px;
        font-size: 1.5rem;
        cursor: pointer;
        color: #94A3B8;
        transition: all 0.2s ease;
    }
    
    .close-modal:hover {
        color: white;
        transform: rotate(90deg);
    }
    
    .glass {
        background: rgba(30, 41, 59, 0.5);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .book-ribbon {
        clip-path: polygon(0 0, 100% 0, 100% 85%, 85% 100%, 0 100%);
    }
</style>

<!-- 导航栏 -->
<nav class="navbar glass py-4 px-6 sticky top-0 z-50" class:scrolled>
    <div class="max-w-7xl mx-auto flex justify-between items-center">
        <div class="flex items-center space-x-2">
            <i class="fas fa-book-open text-primary text-2xl"></i>
            <span class="text-xl font-bold">辰龙机器人操作系统</span>
        </div>
      
        <!-- 桌面导航 -->
        <div class="hidden md:flex space-x-8">
            <a href="#" class="hover:text-primary transition">首页</a>
            <a href="#" class="text-primary font-medium border-b-2 border-primary">书籍库</a>
            <a href="#" class="hover:text-primary transition">分类</a>
            <a href="#" class="hover:text-primary transition">畅销榜</a>
            <a href="#" class="hover:text-primary transition">关于我们</a>
        </div>
      
        <!-- 移动端菜单按钮 -->
        <div class="md:hidden flex items-center">
            <button on:click={() => mobileMenuOpen = !mobileMenuOpen} class="text-2xl">
                <i class={mobileMenuOpen ? "fas fa-times" : "fas fa-bars"}></i>
            </button>
        </div>
      
        <div class="hidden md:flex items-center space-x-4">
            <div class="relative">
                <input type="text" placeholder="搜索书名、作者..." class="search-input bg-slate-800 rounded-full py-2 px-4 pl-10 w-64 focus:outline-none focus:ring-2 focus:ring-primary">
                <i class="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
            </div>
            <button class="glass border border-primary text-primary hover:bg-primary hover:text-white py-2 px-4 rounded-full transition">登录</button>
        </div>
    </div>
    
    <!-- 移动端导航菜单 -->
   <div id="mobile-menu" class="glass rounded-lg mt-4 p-4 md:hidden {!mobileMenuOpen ? 'hidden' : ''}">
        <div class="flex flex-col space-y-4">
            <a href="#" class="hover:text-primary transition py-2">首页</a>
            <a href="#" class="text-primary font-medium py-2">书籍库</a>
            <a href="#" class="hover:text-primary transition py-2">分类</a>
            <a href="#" class="hover:text-primary transition py-2">畅销榜</a>
            <a href="#" class="hover:text-primary transition py-2">关于我们</a>
            
            <div class="relative mt-2">
                <input type="text" placeholder="搜索书名、作者..." class="bg-slate-800 rounded-full py-2 px-4 pl-10 w-full focus:outline-none focus:ring-2 focus:ring-primary">
                <i class="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
            </div>
            
            <button class="glass border border-primary text-primary hover:bg-primary hover:text-white py-2 px-4 rounded-full transition">登录</button>
        </div>
    </div>
</nav>

<!-- 主内容区 -->
<main class="max-w-7xl mx-auto px-4 py-8">
    <!-- 分类筛选 -->
    <section class="mb-10">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold">书籍分类</h2>
            <div class="text-primary hover:underline cursor-pointer transition">
                查看全部 <i class="fas fa-arrow-right ml-1"></i>
            </div>
        </div>
      
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {#each categories as category}
                <div 
                    class="filter-btn bg-slate-800 p-4 rounded-xl text-center cursor-pointer"
                    class:active={activeCategory === category.name}
                    on:click={() => activeCategory = category.name}
                >
                    <i class={`fas fa-${category.icon} text-2xl mb-2 ${category.color}`}></i>
                    <span>{category.name}</span>
                </div>
            {/each}
        </div>
    </section>
  
    <!-- 书籍列表 -->
    <section>
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 class="text-2xl font-bold">精选书籍</h2>
            <div class="flex space-x-2 w-full sm:w-auto">
                <select class="bg-slate-800 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto">
                    <option>最新上架</option>
                    <option>最受欢迎</option>
                    <option>评分最高</option>
                </select>
                <button class="glass border border-primary text-primary hover:bg-primary hover:text-white py-2 px-4 rounded-lg transition">
                    <i class="fas fa-sort"></i> 排序
                </button>
            </div>
        </div>
      
        <div class="book-grid">
            {#each displayedBooks as book}
                <div class="book-card cursor-pointer" on:click={goTobook(book.id)} >
                    <div class="book-card-inner">
                        <div class="book-cover book-ribbon relative" style="background-image: url('{uploadpath+book.data.coverImgurl}');">
                            {#if book.ribbon}
                                <div class="absolute top-0 right-0 bg-{book.ribbon === '畅销' ? 'secondary' : 'primary'} text-white px-3 py-1 text-sm font-medium book-ribbon">
                                    {book.ribbon}
                                </div>
                            {/if}
                        </div>
                        <div class="book-info">
                            <h3 class="book-title">{book.data.title}</h3>
                            <!--div class="flex items-center mt-1">
                                <div class="text-yellow-400 flex">
                                    {@html generateRatingStars(book.rating)}
                                </div>
                                <span class="text-slate-400 text-sm ml-2">{book.rating} ({book.reviews})</span>
                            </div-->
                            <div class="book-meta">
                                <div>作者：{book.data.author}</div>
                                <div>创作时间：{book.servertimestamp.split("T")[0]}</div>
                                <div>分类：{book.category}</div>
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
      
        <div class="mt-12 text-center">
            <button on:click={loadMoreBooks} class="glass border border-primary text-primary hover:bg-primary hover:text-white py-3 px-8 rounded-lg transition">
                加载更多书籍 <i class="fas fa-arrow-right ml-2"></i>
            </button>
        </div>
    </section>
    
 
</main>

 

<!-- 页脚 -->
<footer class="glass py-12 mt-16">
    <div class="max-w-7xl mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
            
        </div>
      
        <div class="pt-8 border-t border-slate-700 text-center text-slate-500">
            <p>© 2004-2026 辰龙机器人操作系统 北京亚嵌科技 电子书平台. 保留所有权利。</p>
        </div>
    </div>
</footer>
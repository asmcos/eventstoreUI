<!-- src/routes/creator/+layout.svelte -->
<script>
  import { onMount } from 'svelte';
  import { getKey } from "$lib/getkey";
  import { WebStorage } from '$lib/WebStorage';
  import {get_user_profile,blog_counts,book_counts} from '$lib/esclient';
  import { uploadpath } from "$lib/config";

  // 全局状态：密钥信息和注销确认模态框
  let Keypriv;
  let Keypub;
  let showConfirmModal = false;
  let confirmMessage = "";
  let confirmcallback = "";
  let user_profile;

  let blogTotalCount = 0 ;
  let bookTotalCount = 0 ;

  // 注销逻辑（全局共享）
  const Logout = () => {
    const storage = new WebStorage(localStorage);
    storage.remove("keyPriv");
    window.location.reload();
  };

  // 触发注销确认
  function LogoutClick() {
    confirmMessage = `注销登录将会删除本地私钥，一旦删除将无法通过任何途径恢复，请确保已经保存后点击确认\n`;
    showConfirmModal = true;
    confirmcallback = (result) => {
      if (result) Logout();
      confirmcallback = "";
      showConfirmModal = false;
    };
  }

  // 处理模态框确认结果
  function handleConfirm(confirmed) {
    confirmcallback(confirmed);
  }

  // 全局初始化（路由守卫+侧边栏交互）
  onMount(async () => {
    // 路由守卫：未登录则跳转至登录页
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;
    if (!Keypriv) {
      window.location.href = "/login?from=/creator";
    }

    await get_user_profile(Keypub,message =>{
        if (message.code == 200){
            user_profile = JSON.parse(message.data)
        }
         
         
    })
    await blog_counts(Keypub,message =>{
      if (message.code == 200) {
        blogTotalCount = message.counts;
      }
    });
    await book_counts(Keypub,message =>{
      if (message.code == 200) {
        bookTotalCount = message.counts;
      }
    });

    // 侧边栏标签切换逻辑（共享交互）
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active-tab'));
        button.classList.add('active-tab');
        
        const indicator = document.querySelector('.tab-indicator');
        const buttonRect = button.getBoundingClientRect();
        const containerRect = button.parentElement.getBoundingClientRect();
        indicator.style.width = `${buttonRect.width}px`;
        indicator.style.transform = `translateX(${buttonRect.left - containerRect.left}px)`;
      });
    });
  });
</script>

<style>
  /* 全局样式（共享） */
  body {
    font-family: 'Noto Serif SC', serif;
    background-color: #F3F4F6;
    color: #1F2937;
  }

  .sidebar {
    transition: all 0.3s ease;
  }

  .active-tab {
    background: linear-gradient(to right, #4F46E5, #7C3AED);
    color: white;
    box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
  }

  .tab-indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(to right, #4F46E5, #7C3AED);
    transition: all 0.3s ease;
  }

  /* 模态框样式（共享） */
  .modal-backdrop {
    background-color: rgba(0, 0, 0, 0.5);
  }

  .modal-content {
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }
</style>

<!-- 页面容器结构 -->
<div class="flex min-h-screen">
  <!-- 侧边栏（共享导航） -->
  <div class="sidebar w-64 bg-white shadow-lg fixed h-full">
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center">
        <div class="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xl">创</div>
        <div class="ml-3">
          <h2 class="font-bold text-gray-800">我的创作空间</h2>
          <p class="text-sm text-gray-500">用户名: {user_profile?user_profile.displayName:"暂未设置"}</p>
        </div>
      </div>
    </div>

    <nav class="py-4">
      <div class="px-4 mb-4">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">创作中心</p>
      </div>

      <ul>
        <li>
          <a href="/" class="flex items-center px-4 py-3 text-gray-700 hover:bg-sky-50">
            <i class="fas fa-home w-5 text-center mr-3 text-sky-500"></i>
            <span>主页</span>
          </a>
        </li>

        <li>
          <a href="/creator" class="flex items-center px-4 py-3 text-gray-700 hover:bg-indigo-50">
            <i class="fas fa-pen-nib w-5 text-center mr-3 text-indigo-500"></i>
            <span>创作中心</span>
          </a>
        </li>

        <li>
          <a href="/editblog" class="flex items-center px-4 py-3 text-gray-700 hover:bg-emerald-50">
            <i class="fas fa-blog w-5 text-center mr-3 text-emerald-500"></i>
            <span>博客管理</span>
            <span class="ml-auto bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full">{blogTotalCount}</span>
          </a>
        </li>

        <li>
          <a href="/editbook" class="flex items-center px-4 py-3 text-gray-700 hover:bg-amber-50">
            <i class="fas fa-book w-5 text-center mr-3 text-amber-500"></i>
            <span>书籍管理</span>
            <span class="ml-auto bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">{bookTotalCount}</span>
          </a>
        </li>

        <li>
          <a href="#" class="flex items-center px-4 py-3 text-gray-700 hover:bg-rose-50">
            <i class="fas fa-chart-line w-5 text-center mr-3 text-rose-500"></i>
            <span>数据统计</span>
          </a>
        </li>
      </ul>


      <div class="px-4 mt-8 mb-4">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">创作工具</p>
      </div>

      <ul>
        <li>
          <a href="/editblog" class="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50">
            <i class="fas fa-plus-circle w-5 text-center mr-3 text-green-500"></i>
            <span>新建博客</span>
          </a>
        </li>
        <li>
          <a href="/editbook" class="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50">
            <i class="fas fa-book-medical w-5 text-center mr-3 text-blue-500"></i>
            <span>新建书籍</span>
          </a>
        </li>

      </ul>
    </nav>

    <!-- 用户信息与注销按钮（共享） -->
     
    <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50">
      <div class="flex items-center justify-between">
        <a href="/creator/profile" class="rounded-lg border border-transparent p-1  hover:bg-purple-100 hover:scale-[1.02] transition-all duration-200 ease-in-out">
        <div class="flex items-center ">
        <!-- 根据用户资料是否存在动态渲染头像或默认图标 -->
        <div class="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center overflow-hidden">
        {#if user_profile && user_profile.avatarUrl}
            <!-- 存在头像URL时显示用户头像 -->
            <img 
            src={uploadpath+user_profile.avatarUrl} 
            alt={user_profile.displayName || '用户头像'} 
            class="w-full h-full object-cover rounded-full border border-blue-200"
            >
        {:else}
            <!-- 不存在头像时显示默认图标 -->
            <i class="fas fa-user text-primary"></i>
        {/if}
        </div>
          <div class="ml-3 ">
            <p class="text-sm font-medium text-gray-900"> {user_profile?user_profile.displayName:"未完善信息"}</p>
            <p class="text-xs text-gray-500"> {user_profile?user_profile.title:""}</p>
          </div>
        </div>
        </a>
        <a href="#" class="text-gray-500 hover:text-primary" on:click={LogoutClick}>
          <i class="fas fa-sign-out-alt"></i>
        </a>
      </div>
    </div>
     

  </div>

  <!-- 主内容区插槽（由page.svelte填充） -->
  <main class="flex-1 ml-64 p-8">
    <slot />
  </main>
</div>

<!-- 注销确认模态框（全局共享） -->
{#if showConfirmModal}
  <div class="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
    <div class="bg-white modal-content p-6 max-w-md w-full shadow-xl">
      <h3 class="text-xl font-bold mb-4 text-primary">提示</h3>
      <p class="text-gray-700 mb-6 whitespace-pre-line">{confirmMessage}</p>
      <div class="flex justify-end gap-3">
        <button 
          class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition"
          on:click={() => handleConfirm(false)}
        >
          取消
        </button>
        <button 
          class="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
          on:click={() => handleConfirm(true)}
        >
          确定
        </button>
      </div>
    </div>
  </div>
{/if}
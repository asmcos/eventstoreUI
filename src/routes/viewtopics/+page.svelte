<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { get_topics, get_browselog_count, get_topics_post_count } from "$lib/esclient";
  import { store_get_users_profile } from "$lib/userProfileStore";
  import { uploadpath } from "$lib/config";
  
  // 用户密钥
  let Keypriv;
  let Keypub;
  
  // 主题列表数据
  let topics = [];
  let topicsbrowse = {};
  let topicsreply = {};
  let loading = true;
  let hasMore = true;
  let pagination = {
    current: 1,
    total: 1,
    perPage: 20,
    totalItems: 0
  };
  
  // 用户资料数据
  let users_profile = {};
  
  // 筛选条件
  let filters = {
    status: 'all',
    sort: 'latest',
    search: ''
  };
  
  // 当前显示的页面内容
  let currentView = 'list';
  let errorMessage = '';
  
  // 工具函数
  function getTagValue(tags, t) {
    const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
    return dTag ? dTag[1] : null;
  }
  
  function getShortTopicId(topic) {
    if (!topic || !topic.user) return 'unknown';
    const userPart = topic.user.substring(0, 8);
    const idPart = topic.id ? topic.id.substring(0, 8) : 'unknown';
    return `${userPart}-${idPart}`;
  }
  
  // 初始化
  onMount(async () => {
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;
    
    await loadTopics();
    loadbrowelog();
  });
  
  // 加载主题
  async function loadTopics() {
    topics = [];
    users_profile = {};
    loading = true;
    currentView = 'list';
    errorMessage = '';
    
    const offset = (pagination.current - 1) * pagination.perPage;
    
    let isDraft;
    switch (filters.status) {
      case 'draft':
        isDraft = 1;
        break;
      case 'published':
        isDraft = 2;
        break;
      case 'all':
      default:
        isDraft = 0;
    }
    
    try {
      await new Promise((resolve, reject) => {
        get_topics(
          "",
          false,
          offset,
          pagination.perPage,
          async (message) => {
            try {
              await handleTopicMessage(message);
              if (message === "EOSE") {
                resolve();
              }
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error('调用get_topics失败:', error);
      loading = false;
      currentView = 'error';
      errorMessage = '加载失败，请检查网络连接';
      showNotification("加载失败", 3000, "error");
    }
  }
  
  // 处理接收到的消息
  async function handleTopicMessage(message) {
    if (!message) {
      console.warn('收到空消息');
      return;
    }
    
    // 如果是EOSE消息
    if (message === "EOSE") {
      await loadUserProfiles();
      loading = false;
      hasMore = topics.length >= pagination.perPage;
      
      if (topics.length === 0) {
        currentView = 'empty';
      } else {
        currentView = 'list';
      }
      
      console.log('加载完成，主题数量:', topics.length);
      return;
    }
    
    // 处理错误消息
    if (message === "ERROR") {
      loading = false;
      errorMessage = "获取主题列表失败，请稍后重试";
      currentView = 'error';
      showNotification("获取主题失败", 3000, "error");
      return;
    }
    
    // 处理事件数据
    if (message && message.code === 200) {
      try {
        const topic = parseEventToTopic(message);
        if (topic) {
          if (!topics.some(t => t.id === topic.id)) {
            topics = [...topics, topic];
            topics.sort((a, b) => {
              if (filters.sort === 'latest') {
                return new Date(b.createdAt) - new Date(a.createdAt);
              }
              return 0;
            });
          }
        }
      } catch (error) {
        console.error('解析事件失败:', error);
      }
    }
  }
  
  // 解析事件为主题对象
  function parseEventToTopic(event) {
    try {
      let data;
      try {
        data = JSON.parse(event.data || '{}');
      } catch (e) {
        data = {};
      }
      
      const tags = event.tags || [];
      let category = '未分类';
      let status = 'published';
      const tagArray = [];
      let isSticky = false;
      
      tags.forEach(tag => {
        if (Array.isArray(tag)) {
          if (tag[0] === 't' && tag[1] !== 'create_topic') {
            if (!category || category === '未分类') {
              category = tag[1];
            }
            tagArray.push(tag[1]);
          } else if (tag[0] === 's') {
            status = tag[1];
          } else if (tag[0] === 'sticky' && tag[1] === 'true') {
            isSticky = true;
          }
        }
      });
      
      const userPubkey = event.user;
      
      return {
        id: getTagValue(event.tags, 'd'),
        title: data.title || '无标题',
        content: data.content || '',
        user: userPubkey,
        category: category,
        status: status,
        createdAt: event.created_at ? new Date(event.created_at * 1000).toISOString() : new Date().toISOString(),
        lastReplyAt: null,
        replyCount: 0,
        viewCount: 0,
        isSticky: isSticky,
        isHot: false,
        tags: tagArray,
        rawEvent: event
      };
    } catch (error) {
      console.error('解析事件出错:', error);
      return null;
    }
  }
  
  // 加载浏览和回复统计
  function loadbrowelog() {
    const ids = topics.map(topic => topic.id);
    
    // 调用统计接口
    get_browselog_count(ids, function (message) {
      if (message.code == 200) {
        message.counts.map(count => {
          topicsbrowse[count.targetId] = count.count;
        });
      }
      if (message == "EOSE") topicsbrowse = topicsbrowse;
    });
    
    get_topics_post_count(ids, function (message) {
      if (message.code == 200) {
        message.counts.map(count => {
          topicsreply[count.targetid] = count.count;
        });
      }
      if (message == "EOSE") topicsreply = topicsreply;
    });
  }
  
  // 获取用户资料
  async function loadUserProfiles() {
    if (!topics.length) return;
    
    const pubkeys = new Set();
    topics.forEach(topic => {
      if (topic.user && topic.user !== 'unknown') {
        pubkeys.add(topic.user);
      }
    });
    
    if (pubkeys.size === 0) return;
    
    return new Promise((resolve) => {
      store_get_users_profile(
        Array.from(pubkeys),
        (profile) => {
          if (profile && profile.pubkey) {
            users_profile[profile.pubkey] = profile.data || profile;
            users_profile = users_profile;
          }
          if (profile == "EOSE") resolve();
        }
      );
      
      setTimeout(() => {
        console.log('用户资料加载完成');
        resolve();
      }, 2000);
    });
  }
  
  // 处理状态筛选
  function handleStatusFilter(status) {
    filters.status = status;
    pagination.current = 1;
    topics = [];
    loadTopics();
  }
  
  // 处理搜索
  function handleSearch(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const searchQuery = formData.get('search') || '';
    
    if (searchQuery.trim()) {
      showNotification("搜索功能暂未实现", 3000, "info");
    }
  }
  
  // 刷新列表
  function handleRefresh() {
    topics = [];
    users_profile = {};
    pagination.current = 1;
    loadTopics();
    showNotification("刷新中...", 1000, "info");
  }
  
  // 加载更多
  async function handleLoadMore() {
    if (!hasMore || loading) return;
    
    pagination.current += 1;
    const offset = (pagination.current - 1) * pagination.perPage;
    
    loading = true;
    
    try {
      await new Promise((resolve, reject) => {
        get_topics(
          "",
          false,
          offset,
          pagination.perPage,
          async (message) => {
            try {
              if (message === "EOSE") {
                await loadUserProfiles();
                loading = false;
                resolve();
              } else if (message && message.code === 200) {
                const topic = parseEventToTopic(message);
                if (topic && !topics.some(t => t.id === topic.id)) {
                  topics = [...topics, topic];
                }
              }
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error('加载更多失败:', error);
      loading = false;
      showNotification("加载更多失败", 3000, "error");
    }
  }
  
  // 跳转到主题详情
  function goToTopicDetail(topic) {
    let shortid = getShortTopicId(topic)
    goto(`/viewtopics/${shortid}`);
  }
  
  // 跳转到创建主题页面
  function goToCreateTopic() {
    goto('/edittopic/');
  }
  
  // 格式化时间
  function formatTime(time) {
    if (!time) return '';
    try {
      const date = new Date(time);
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
      const diff = now - date;
      
      // 今天
      if (date.toDateString() === now.toDateString()) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      }
      
      // 昨天
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return '昨天';
      }
      
      // 一周内
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days}天前`;
      }
      
      // 一个月内
      if (diff < 30 * 24 * 60 * 60 * 1000) {
        const weeks = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
        return `${weeks}周前`;
      }
      
      // 更早
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    } catch (error) {
      return '';
    }
  }
</script>

<div class="container mx-auto px-4 py-6 max-w-6xl">
  <!-- 页面头部 - 现代科技感设计 -->
  <div class="mb-8">
    <div class="relative rounded-xl p-6 bg-gray-900 border border-gray-800 overflow-hidden">
      <!-- 科技感背景底纹 -->
      <div class="absolute inset-0 opacity-20">
        <!-- 网格背景 -->
        <div class="absolute inset-0 bg-[linear-gradient(rgba(66,153,225,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(66,153,225,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        
        <!-- 动态光晕效果 -->
        <div class="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full filter blur-[100px] opacity-20 animate-pulse"></div>
        <div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600 rounded-full filter blur-[120px] opacity-10 animate-pulse" style="animation-delay: 1s;"></div>
        
        <!-- 几何装饰 -->
        <div class="absolute top-0 right-0 w-32 h-32 border-t-4 border-r-4 border-blue-500/30"></div>
        <div class="absolute bottom-0 left-0 w-24 h-24 border-b-4 border-l-4 border-purple-500/30"></div>
      </div>
      
      <!-- 主内容 -->
      <div class="relative z-10">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div class="space-y-4">
            <!-- 标题区域 -->
            <div class="flex items-center gap-3">
              <!-- 科技感图标 -->
              <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              
              <div>
                <h1 class="text-3xl font-bold text-white mb-1">
                  主题列表
                </h1>
                <p class="text-gray-400 text-lg">
                  <span class="text-blue-400 font-medium">Community Hub</span> • 科技讨论平台
                </p>
              </div>
            </div>
            
            <!-- 描述文本 -->
            <p class="text-gray-300 max-w-2xl">
              探索前沿科技话题，参与深度技术讨论，分享你的见解和经验。 
            </p>
          </div>
          
          <!-- 按钮区域 -->
          <div class="flex items-center gap-3 mt-4 sm:mt-0">
            <!-- 刷新按钮 -->
            <button 
              on:click={handleRefresh}
              class="px-4 py-2.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-all duration-300 flex items-center gap-2 border border-gray-700 hover:border-blue-500/50 shadow-lg hover:shadow-blue-500/10"
              title="刷新列表"
              disabled={loading}
            >
              {#if loading}
                <div class="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
              {:else}
                <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              {/if}
              <span>刷新</span>
            </button>
            
            <!-- 发布按钮 - 科技感渐变 -->
            <button 
              on:click={goToCreateTopic}
              class="px-6 py-2.5 text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 hover:from-blue-700 hover:via-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:-translate-y-1"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              发布新主题
            </button>
          </div>
        </div>
        
        <!-- 统计信息卡片 -->
         
          
          
           
         
      </div>
    </div>
  </div>
  
  <!-- 主题列表 -->
  <div class="topics-list bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
    <!-- 加载状态 -->
    {#if loading && topics.length === 0}
      <div class="py-16 text-center">
        <div class="w-12 h-12 border-4 border-gray-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
        <p class="text-gray-600 dark:text-gray-400 text-lg">正在加载主题列表，请稍候...</p>
      </div>
    
    <!-- 错误状态 -->
    {:else if currentView === 'error'}
      <div class="py-16 text-center">
        <div class="w-16 h-16 mx-auto mb-6 text-red-500">
          <svg class="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">加载失败</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{errorMessage || '获取主题列表时发生错误，请检查网络连接后重试'}</p>
        <button on:click={handleRefresh} class="px-6 py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-lg transition-colors shadow hover:shadow-lg">
          重试加载
        </button>
      </div>
    
    <!-- 空状态 -->
    {:else if currentView === 'empty'}
      <div class="py-16 text-center">
        <div class="w-16 h-16 mx-auto mb-6 text-gray-400">
          <svg class="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">暂无主题</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">还没有人发布主题，快来创建第一个话题，开启精彩讨论吧！</p>
        <button on:click={goToCreateTopic} class="px-6 py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-lg transition-colors shadow hover:shadow-lg">
          创建第一个主题
        </button>
      </div>
    
    <!-- 主题列表 -->
    {:else if topics.length > 0}
      <div>
        <!-- 列表头部 -->
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 grid grid-cols-12 gap-6 items-center">
          <div class="col-span-7 text-sm font-medium text-gray-700 dark:text-gray-300">
            主题内容
          </div>
          <div class="col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
            互动数据
          </div>
          <div class="col-span-2 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
            发布时间
          </div>
        </div>
        
        <!-- 主题项 -->
        <div>
          {#each topics as topic (topic.id)}
            <div 
              class="group px-6 py-5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 cursor-pointer grid grid-cols-12 gap-6 items-center hover:shadow-sm"
              on:click={() => goToTopicDetail(topic)}
            >
              <!-- 左侧：主题内容 -->
              <div class="col-span-7">
                <div class="flex items-start gap-4">
                  <!-- 图标 - 恢复为蓝色 -->
                  <div class="flex-shrink-0 mt-0.5">
                    {#if topic.isSticky}
                      <div class="w-10 h-10 text-amber-500 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg flex items-center justify-center" title="置顶主题">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z"/>
                        </svg>
                      </div>
                    {:else if topic.category}
                      <div class="w-10 h-10 text-blue-500 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                        </svg>
                      </div>
                    {:else}
                      <div class="w-10 h-10 text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
                        </svg>
                      </div>
                    {/if}
                  </div>
                  
                  <!-- 标题和元信息 -->
                  <div class="flex-1 min-w-0">
                    <!-- 标题 - 悬停恢复为蓝色 -->
                    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2 line-clamp-1">
                      {topic.title}
                      {#if topic.isHot}
                        <span class="inline-block ml-2 px-2 py-1 text-xs bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900 dark:to-orange-900 text-red-700 dark:text-red-200 rounded-full font-medium">🔥 热门</span>
                      {/if}
                    </h3>
                    
                    <!-- 元信息 -->
                    <div class="flex items-center gap-4">
                      <!-- 作者 -->
                      <div class="flex items-center gap-2">
                        <img 
                          src={uploadpath+users_profile[topic.user]?.avatarUrl || 
                               `https://api.dicebear.com/7.x/avataaars/svg?seed=${topic.user}`} 
                          alt="头像"
                          class="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700"
                        />
                        <span class="text-sm text-gray-600 dark:text-gray-400 font-medium">
                          {users_profile[topic.user]?.displayName || 
                           users_profile[topic.user]?.name ||
                           users_profile[topic.user]?.data?.displayName ||
                           `用户${topic.user?.slice(0, 8)}`}
                        </span>
                      </div>
                      
                      <!-- 分隔点 -->
                      <div class="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                      
                      <!-- 分类 - 保持紫色 -->
                      {#if topic.category && topic.category !== '未分类'}
                        <span class="text-sm px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                          {topic.category}
                        </span>
                      {/if}
                      
                      <!-- 标签 -->
                      {#if topic.tags && topic.tags.length > 0}
                        <div class="flex items-center gap-1">
                          {#each topic.tags.slice(0, 2) as tag}
                            <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                              {tag}
                            </span>
                          {/each}
                          {#if topic.tags.length > 2}
                            <span class="text-xs text-gray-400">+{topic.tags.length - 2}</span>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 中间：统计信息 -->
              <div class="col-span-3">
                <div class="flex justify-center items-center gap-6">
                  <!-- 浏览 -->
                  <div class="text-center">
                    <div class="flex flex-col items-center gap-1">
                      <div class="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        <span class="text-lg font-bold text-gray-900 dark:text-gray-100">{topicsbrowse[topic.id] ?? 0}</span>
                      </div>
                      <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">浏览量</span>
                    </div>
                  </div>
                  
                  <!-- 分隔线 -->
                  <div class="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                  
                  <!-- 回复 -->
                  <div class="text-center">
                    <div class="flex flex-col items-center gap-1">
                      <div class="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                        <span class="text-lg font-bold text-gray-900 dark:text-gray-100">{topicsreply[topic.id] ?? 0}</span>
                      </div>
                      <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">回复数</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 右侧：时间 -->
              <div class="col-span-2">
                <div class="text-right">
                  <span class="inline-block px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium whitespace-nowrap">
                    {formatTime(topic.createdAt)}
                  </span>
                  {#if topic.status === 'draft'}
                    <span class="inline-block mt-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded text-xs font-medium">
                      草稿
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
        
        <!-- 加载更多 -->
        {#if hasMore}
          <div class="px-6 py-6 text-center bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <button 
              on:click={handleLoadMore}
              disabled={loading}
              class="px-8 py-3 text-sm bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all flex items-center gap-3 mx-auto border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 shadow-sm hover:shadow"
            >
              {#if loading}
                <div class="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                <span class="font-medium">正在加载更多主题...</span>
              {:else}
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                </svg>
                <span class="font-medium">加载更多主题</span>
              {/if}
            </button>
          </div>
        {:else if topics.length > 0}
          <div class="px-6 py-6 text-center bg-gradient-to-r from-gray-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div class="flex flex-col items-center gap-2">
              <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="text-gray-600 dark:text-gray-400 font-medium">已加载全部主题，共 {topics.length} 个</span>
            </div>
          </div>
        {/if}
      </div>
    
    {:else}
      <div class="py-16 text-center">
        <p class="text-gray-500 dark:text-gray-400 text-lg">暂无数据</p>
      </div>
    {/if}
  </div>
  
  <!-- 底部信息 -->
  <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
    <p class="text-gray-600 dark:text-gray-400">
      共 <span class="font-semibold text-blue-600 dark:text-blue-400">{topics.length}</span> 个主题 • 
      最后更新：<span class="font-medium">{formatTime(new Date())}</span>
    </p>
  </div>
</div>

<style>
  /* 基础样式 */
  .topics-list {
    background: white;
    border-radius: 1rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    border: 1px solid #e5e7eb;
    transition: all 0.3s ease;
  }
  
  .topics-list:hover {
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.12);
  }
  
  .dark .topics-list {
    background: #111827;
    border-color: #374151;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .dark .topics-list:hover {
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
  }
  
  /* 动画 */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 0.1;
      transform: scale(1);
    }
    50% {
      opacity: 0.2;
      transform: scale(1.05);
    }
  }
  
  .animate-pulse {
    animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  /* 标题截断 */
  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  /* 悬停效果 */
  .group:hover {
    transform: translateY(-2px);
    transition: all 0.3s ease;
  }
  
  /* 响应式调整 */
  @media (max-width: 768px) {
    .container {
      padding-left: 1rem;
      padding-right: 1rem;
    }
    
    /* 移动端网格布局调整 */
    .grid-cols-12 {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
    
    .col-span-7,
    .col-span-3,
    .col-span-2 {
      grid-column: span 12;
      width: 100%;
    }
    
    /* 移动端主题项调整 */
    [class*="col-span-"] {
      padding: 0.5rem 0;
    }
    
    /* 移动端统计信息水平排列 */
    .col-span-3 .flex {
      justify-content: flex-start;
      gap: 2rem;
    }
    
    /* 移动端时间信息 */
    .col-span-2 {
      text-align: left !important;
    }
    
    /* 移动端减小内边距 */
    .px-6 {
      padding-left: 1rem;
      padding-right: 1rem;
    }
    
    .py-5 {
      padding-top: 1rem;
      padding-bottom: 1rem;
    }
    
    /* 移动端头部调整 */
    .grid-cols-3 {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }
</style>
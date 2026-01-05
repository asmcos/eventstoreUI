<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { get_topics } from "$lib/esclient";
  import { store_get_users_profile } from "$lib/userProfileStore";
  import {uploadpath} from "$lib/config";
  
  import "$lib/viewtopic.css";
  
  // 用户密钥
  let Keypriv;
  let Keypub;
  
  // 主题列表数据
  let topics = [];
  let loading = true;
  let hasMore = true;
  let pagination = {
    current: 1,
    total: 1,
    perPage: 20,
    totalItems: 0
  };
  
  // 用户资料数据 - 使用响应式更新
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
  
    function getTagValue(tags, t) {
        const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
        return dTag ? dTag[1] : null;
    }


    function goToTopic(topicId){
        window.location.href = "/viewtopics/" + topicId;
    }

    function getShortTopicId(topic) {
        // 确保topic和topic.user存在
        if (!topic || !topic.user) return 'unknown';
        
        // 使用用户pubkey的前8位和topic ID的前8位
        const userPart = topic.user.substring(0, 8);
        const idPart = topic.id ? topic.id.substring(0, 8) : 'unknown';
        
        return `${userPart}-${idPart}`;
    }

  onMount(async () => {
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;
    
    if (!Keypriv) {
      showNotification("请先登录", 3000, "warning");
      setTimeout(() => goto('/login'), 2000);
      return;
    }
    
    await loadTopics();
  });
  
  async function loadTopics() {
    if (!Keypub) return;
    
    topics = [];
    users_profile = {}; // 清空用户资料
    loading = true;
    currentView = 'list';
    errorMessage = '';
    
    const offset = (pagination.current - 1) * pagination.perPage;
    
    let isDraft;
    switch(filters.status) {
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
    
    console.log('加载主题列表:', {
      pubkey: Keypub,
      isDraft,
      offset,
      limit: pagination.perPage
    });
    
    try {
      // 获取主题 - 使用Promise包装回调
      await new Promise((resolve, reject) => {
        get_topics(
          "",
          false,
          offset,
          pagination.perPage,
          async (message) => {
            try {
              await handleTopicMessage(message);
              // 如果收到EOSE，表示主题加载完成
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
  
  // 处理接收到的消息 - 改为async
  async function handleTopicMessage(message) {
    //console.log('收到消息:', message);
    
    if (!message) {
      console.warn('收到空消息');
      return;
    }
    
    // 如果是EOSE消息
    if (message === "EOSE") {
      // 等待用户资料加载完成
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
            
            // 按时间排序
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
        id: getTagValue(event.tags,'d'),
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
  
  // 获取用户资料 - 改为async，等待所有资料加载完成
  async function loadUserProfiles() {
    if (!topics.length) return;
    
    const pubkeys = new Set();
    topics.forEach(topic => {
      if (topic.user && topic.user !== 'unknown') {
        pubkeys.add(topic.user);
      }
    });
    
    if (pubkeys.size === 0) return;
    
    console.log('获取用户资料，pubkeys数量:', pubkeys.size);
    
    // 使用Promise包装store_get_users_profile回调
    return new Promise((resolve) => {
      store_get_users_profile(
        Array.from(pubkeys),
        (profile) => {
          if (profile && profile.pubkey) {
            // 直接更新users_profile对象
            users_profile[profile.pubkey] = profile.data || profile;
            
            // 为了让Svelte检测到变化，需要重新赋值
            users_profile = users_profile;
            
            console.log('更新用户资料:', profile.pubkey);
          }

          if(profile == "EOSE") resolve();
          
          // 这里假设store_get_users_profile会在所有资料获取完成后回调
          // 或者有某种方式知道所有资料都已加载
          // 如果是一次性返回所有资料，可以在这里resolve
        }
      );
      
      // 或者设置一个超时，确保不会永远等待
      setTimeout(() => {
        console.log('用户资料加载超时或完成');
        resolve();
      }, 2000); // 2秒超时
    });
  }
  
  // 直接在模板中使用users_profile对象，不要用getter函数
  
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
                // 加载更多时也要获取用户资料
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
  function goToTopicDetail(topicId) {
    goto(`/viewtopics/${topicId}`);
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
      
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return '昨天';
      }
      
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days}天前`;
      }
      
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    } catch (error) {
      return '';
    }
  }
</script>

<div class="container mx-auto px-4 py-8 max-w-6xl">
  <!-- 页面头部 -->
  <div class="page-header">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1>主题列表</h1>
        <div class="header-subtitle">浏览和发现有趣的话题</div>
      </div>
      <div class="flex items-center gap-3">
        <button 
          on:click={handleRefresh}
          class="btn btn-secondary"
          title="刷新列表"
          disabled={loading}
        >
          {#if loading}
            <div class="spinner-small"></div>
          {:else}
            <svg class="icon" viewBox="0 0 24 24">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          {/if}
          刷新
        </button>
        <button 
          on:click={goToCreateTopic}
          class="btn btn-primary"
        >
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          发布新主题
        </button>
      </div>
    </div>
  </div>
  
  <!-- 主要内容区域 -->
  <div class="topics-container">
    <!-- 加载状态 -->
    {#if loading && topics.length === 0}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>正在加载主题列表...</p>
      </div>
    
    <!-- 错误状态 -->
    {:else if currentView === 'error'}
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>加载失败</h3>
        <p>{errorMessage || '获取主题列表时发生错误'}</p>
        <button on:click={handleRefresh} class="btn btn-primary">
          重试
        </button>
      </div>
    
    <!-- 空状态 -->
    {:else if currentView === 'empty'}
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <h3>暂无主题</h3>
        <p>还没有人发布主题，快来创建第一个吧！</p>
        <button on:click={goToCreateTopic} class="btn btn-primary">
          发布新主题
        </button>
      </div>
    
    <!-- 主题列表 -->
    {:else if topics.length > 0}
      <div class="topics-list">
        <!-- 列表头部 -->
        <div class="topics-header">
          <div class="header-title">主题</div>
          <div class="header-stats">回复</div>
          <div class="header-time">发布时间</div>
        </div>
        
        <!-- 主题项 -->
        <div class="topics-items">
          {#each topics as topic (topic.id)}
            <div class="topic-item" on:click={() => goToTopicDetail(topic.id)}>
              <div class="topic-content">
                <div class="topic-main">
                  <div class="topic-icon">
                    {#if topic.isSticky}
                      <span class="icon-sticky" title="置顶主题">📌</span>
                    {:else}
                      <span class="icon-normal">📄</span>
                    {/if}
                  </div>
                  <div class="topic-info">
                    <h3 class="topic-title" on:click={goToTopic(getShortTopicId(topic))}>
                      {topic.title}
                    </h3>
                    <div class="topic-meta">
                      <div class="author-info">
                        <!-- 直接使用users_profile对象，Svelte会自动响应式更新 -->
                        <img 
                          src={uploadpath+users_profile[topic.user]?.avatarUrl || 
                               `https://api.dicebear.com/7.x/avataaars/svg?seed=${topic.user}`} 
                          alt={users_profile[topic.user]?.displayName || 
                               users_profile[topic.user]?.name ||
                               users_profile[topic.user]?.data?.displayName ||
                               `用户${topic.user?.slice(0, 6)}`}
                          class="author-avatar"
                        />
                        <span class="author-name">
                          {users_profile[topic.user]?.displayName || 
                           users_profile[topic.user]?.name ||
                           users_profile[topic.user]?.data?.displayName ||
                           `用户${topic.user?.slice(0, 6)}`}
                        </span>
                      </div>
                      {#if topic.category && topic.category !== '未分类'}
                        <span class="topic-category">{topic.category}</span>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="topic-stats">
                <div class="stats-box">
                  <span class="stats-value">{topic.replyCount}</span>
                  <span class="stats-label">回复</span>
                </div>
              </div>
              
              <div class="topic-time">
                <span class="time-badge">
                  {formatTime(topic.createdAt)}
                </span>
              </div>
            </div>
          {/each}
        </div>
        
        <!-- 加载更多 -->
        {#if hasMore}
          <div class="load-more">
            <button 
              on:click={handleLoadMore}
              disabled={loading}
              class="btn load-more-btn"
            >
              {#if loading}
                <div class="spinner-small"></div>
                正在加载...
              {:else}
                加载更多
              {/if}
            </button>
          </div>
        {:else if topics.length > 0}
          <div class="no-more">
            <span>已加载全部主题</span>
          </div>
        {/if}
      </div>
    
    {:else}
      <div class="empty-state">
        <p>暂无数据</p>
      </div>
    {/if}
  </div>
  
  <!-- 底部信息 -->
  <div class="footer">
    <div class="footer-info">
      <span>共 {topics.length} 个主题</span>
    </div>
  </div>
</div>
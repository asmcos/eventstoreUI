<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { get_topics } from "$lib/esclient";
  import { store_get_users_profile } from "$lib/userProfileStore";
  
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
  
  // 用户资料数据 - 与你的数据结构保持一致
  let users_profile = {};
  
  // 筛选条件
  let filters = {
    status: 'all', // all, draft, published
    sort: 'latest',
    search: ''
  };
  
  // 当前显示的页面内容
  let currentView = 'list'; // list, empty, error
  let errorMessage = '';
  
  onMount(async () => {
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;
    
    if (!Keypriv) {
      showNotification("请先登录", 3000, "warning");
      setTimeout(() => goto('/login'), 2000);
      return;
    }
    
    // 加载主题列表
    await loadTopics();
  });
  
  // 加载主题列表
  async function loadTopics() {
    if (!Keypub) return;
    
    topics = [];
    loading = true;
    currentView = 'list';
    errorMessage = '';
    
    // 计算offset
    const offset = (pagination.current - 1) * pagination.perPage;
    
    // 确定isDraft值
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
      // 获取主题
      get_topics(
        "",  // 使用当前用户的公钥
        false, // isDraft状态
        offset,  // offset
        pagination.perPage, // limit
        handleTopicMessage // callback
      );
    } catch (error) {
      console.error('调用get_topics失败:', error);
      loading = false;
      currentView = 'error';
      errorMessage = '加载失败，请检查网络连接';
      showNotification("加载失败", 3000, "error");
    }
  }
  
  // 处理接收到的消息
  function handleTopicMessage(message) {
    console.log('收到消息:', message);
    
    // 检查消息格式
    if (!message) {
      console.warn('收到空消息');
      return;
    }
    
    // 如果是EOSE消息
    if (message === "EOSE") {
      // 结束事件流，加载完成
      loading = false;
      
      // 检查是否还有更多数据
      hasMore = topics.length >= pagination.perPage;
      
      // 如果没有数据，显示空状态
      if (topics.length === 0) {
        currentView = 'empty';
      } else {
        currentView = 'list';
      }
      
      console.log('加载完成，主题数量:', topics.length);
      
      // 主题加载完成后，获取用户资料
      loadUserProfiles();
      
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
    
    // 处理事件数据 - 根据你提供的get_topics回调
    if (message && message.code === 200) {
      try {
        // 解析事件数据
        const topic = parseEventToTopic(message);
        
        if (topic) {
          // 避免重复添加
          if (!topics.some(t => t.id === topic.id)) {
            topics = [...topics, topic];
            
            // 按时间排序（最新的在前面）
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
  
  // 解析Nostr事件为Topic对象
  function parseEventToTopic(event) {
    try {
      // 解析内容
      let data;
      try {
        data = JSON.parse(event.data || '{}');
      } catch (e) {
        data = {};
      }
      
      // 从tags中提取信息
      const tags = event.tags || [];
      let category = '未分类';
      let status = 'published';
      const tagArray = [];
      let isSticky = false;
      
      tags.forEach(tag => {
        if (Array.isArray(tag)) {
          if (tag[0] === 't') {
            if (tag[1] !== 'create_topic') {
              if (!category || category === '未分类') {
                category = tag[1];
              }
              tagArray.push(tag[1]);
            }
          } else if (tag[0] === 's') {
            status = tag[1];
          } else if (tag[0] === 'sticky' && tag[1] === 'true') {
            isSticky = true;
          }
        }
      });
      
      // 获取用户pubkey
      const userPubkey = event.user?.pubkey || 'unknown';
      
      return {
        id: event.id || Math.random().toString(36).substr(2, 9),
        title: data.title || '无标题',
        content: data.content || '',
        user: userPubkey, // 存储用户pubkey
        author: { // 保留原有结构，但内容会通过用户资料更新
          id: userPubkey,
          name: '加载中...',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userPubkey}`
        },
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
      // 返回一个默认的topic对象
      return {
        id: Math.random().toString(36).substr(2, 9),
        title: '解析失败',
        content: '',
        user: 'unknown',
        author: {
          id: 'unknown',
          name: '未知用户',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=unknown'
        },
        category: '未分类',
        status: 'published',
        createdAt: new Date().toISOString(),
        lastReplyAt: null,
        replyCount: 0,
        viewCount: 0,
        isSticky: false,
        isHot: false,
        tags: [],
        rawEvent: event
      };
    }
  }
  
  // 获取用户资料 - 根据你的数据结构
  function loadUserProfiles() {
    if (!topics.length) return;
    
    // 收集所有不重复的pubkey
    const pubkeys = new Set();
    topics.forEach(topic => {
      if (topic.user && topic.user !== 'unknown') {
        pubkeys.add(topic.user);
      }
    });
    
    if (pubkeys.size === 0) return;
    
    console.log('获取用户资料，pubkeys数量:', pubkeys.size);
    
    // 调用store_get_users_profile获取用户资料
    store_get_users_profile(
      Array.from(pubkeys),
      (profiles) => {
        console.log(profiles)
        if (profiles && Array.isArray(profiles)) {
          // 按照你的数据结构更新users_profile
          profiles.forEach(profile => {
            if (profile && profile.pubkey) {
              users_profile[profile.pubkey] = {
                data: {
                  displayName: profile.display_name || profile.nickname || profile.name || `用户${profile.pubkey.slice(0, 6)}`,
                  avatarUrl: profile.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.pubkey}`,
                  about: profile.about,
                  nip05: profile.nip05
                }
              };
            }
          });
          
          // 强制Svelte重新渲染
          users_profile = { ...users_profile };
        }
      }
    );
  }
  
  // 获取用户显示名称 - 根据你的数据结构
  function getUserDisplayName(userPubkey) {
    if (!userPubkey || userPubkey === 'unknown') return '未知用户';
    
    if (users_profile[userPubkey] && users_profile[userPubkey].data && users_profile[userPubkey].data.displayName) {
      return users_profile[userPubkey].data.displayName;
    }
    
    // 如果还没有用户资料，返回默认名称
    return `用户${userPubkey.slice(0, 6)}`;
  }
  
  // 获取用户头像URL - 根据你的数据结构
  function getUserAvatarUrl(userPubkey) {
    if (!userPubkey || userPubkey === 'unknown') {
      return 'https://api.dicebear.com/7.x/avataaars/svg?seed=unknown';
    }
    
    if (users_profile[userPubkey] && users_profile[userPubkey].data && users_profile[userPubkey].data.avatarUrl) {
      return users_profile[userPubkey].data.avatarUrl;
    }
    
    // 如果还没有用户资料，返回默认头像
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userPubkey}`;
  }
  
  // 以下所有原有函数保持不变
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
    pagination.current = 1;
    loadTopics();
    showNotification("刷新中...", 1000, "info");
  }
  
  // 加载更多
  function handleLoadMore() {
    if (!hasMore || loading) return;
    
    pagination.current += 1;
    const offset = (pagination.current - 1) * pagination.perPage;
    
    // 获取更多主题
    get_topics(
      "", // pubkey传空
      false, // isDraft
      offset,
      pagination.perPage,
      handleTopicMessage
    );
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
      
      // 如果是今天
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      
      // 如果是昨天
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
      
      // 返回日期
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    } catch (error) {
      return '';
    }
  }
  
  // 获取状态标签样式
  function getStatusStyle(status) {
    switch(status) {
      case 'draft':
        return { label: '草稿', class: 'status-draft' };
      case 'published':
        return { label: '已发布', class: 'status-published' };
      default:
        return { label: '未知', class: 'status-unknown' };
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
  
  <!-- 筛选标签 -->
  {#if 0}
  <div class="filter-tabs">
    <button 
      class:active={filters.status === 'all'}
      on:click={() => handleStatusFilter('all')}
      class="filter-tab {filters.status === 'all' ? 'active' : ''}"
    >
      全部主题
    </button>
  </div>
  {/if}

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
                    <h3 class="topic-title">
                      {topic.title}
                    </h3>
                    <div class="topic-meta">
                      <div class="author-info">
                        <img 
                          src={getUserAvatarUrl(topic.user)} 
                          alt={getUserDisplayName(topic.user)}
                          class="author-avatar"
                        />
                        <span class="author-name">{getUserDisplayName(topic.user)}</span>
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
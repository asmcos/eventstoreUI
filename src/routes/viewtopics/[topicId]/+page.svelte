<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { store_get_users_profile } from "$lib/userProfileStore";
  import { upload_file, create_post, get_browselog_count, get_topics_post_count } from "$lib/esclient";
  import {uploadpath} from "$lib/config";
  import {browselog} from "$lib/browselog";

  // 接收从load函数传递过来的数据
  export let data;
  
  // 用户密钥
  let Keypriv;
  let Keypub;
  
  // 从data中解构出topic和posts
  let { topic, posts, topicId, users_pubkey } = data;
   
  // 用户资料存储对象，key为pubkey，value为用户资料
  let users_profile = {};
  
  // 添加一个标志来跟踪用户资料是否已加载
  let profilesLoaded = false;
  
  // 当前用户信息
  let currentUser = null;
  
  // 回复内容
  let replyContent = '';
  let replying = false;
  
  // SimpleMDE实例
  let simpleMDE = null;
  let replyTextarea = null;
  
  // 统计数据
  let viewCount = 0; // 浏览量
  let replyCount = 0; // 回复数
  let loadingStats = true; // 统计数据加载状态

  // 自定义图片上传按钮
  const customImageButton = {
    name: 'customImageUpload',
    action: function(editor) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      
      input.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
          for (let file of files) {
            if (!file.type.startsWith('image/')) {
              showNotification(`${file.name} 不是图片文件`, 3000, 'warning');
              continue;
            }
            
            // 检查文件大小（限制5MB）
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
              showNotification(`${file.name} 大小超过5MB限制`, 3000, 'error');
              continue;
            }
            
            showNotification(`正在上传 ${file.name}...`, 2000, 'info');
            
            // 创建文件读取器
            const reader = new FileReader();
            
            reader.onload = function(e) {
              const arrayBuffer = e.target.result;
              const uint8Array = new Uint8Array(arrayBuffer);
              
              // 调用上传函数
              upload_file(file.name, uint8Array, Keypub, Keypriv, function(message) {
                if (message && message[2] && message[2].code == 200) {
                  const url = message[2].fileUrl;
                  const cm = editor.codemirror;
                  const cursor = cm.getCursor();
                  
                  // 插入Markdown格式的图片链接
                  const imageMarkdown = `![${file.name}](${uploadpath + url})\n`;
                  cm.replaceRange(imageMarkdown, cursor);
                  
                  // 移动光标到新行
                  cm.setCursor({
                    line: cursor.line + 1,
                    ch: 0
                  });
                  
                  showNotification(`${file.name} 上传成功`, 2000, 'success');
                } else {
 
                }
              });
            };
            
            reader.onerror = function(error) {
              console.error('读取文件失败:', error);
              showNotification(`读取 ${file.name} 失败`, 3000, 'error');
            };
            
            // 读取文件为ArrayBuffer
            reader.readAsArrayBuffer(file);
          }
        }
      });
      
      input.click();
    },
    className: 'fa fa-image',
    title: '上传图片'
  };
  
  onMount(async () => {
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;
    
 
    browselog(Keypub, topicId);
    
    if (Keypriv) {
      currentUser = {
        pubkey: Keypub,
        privkey: Keypriv
      };
    }
    
    // 只有在登录的情况下才初始化编辑器
    if (currentUser) {
      // 初始化SimpleMDE编辑器
      initSimpleMDE();
    }
    
    // 加载用户资料
    await loadUserProfiles();
    
    // 加载统计数据
    loadTopicStats();
  });
  
  onDestroy(() => {
    // 清理SimpleMDE实例
    if (simpleMDE) {
      simpleMDE.toTextArea();
      simpleMDE = null;
    }
  });
  
  // 加载主题统计数据（浏览量和回复数）
  function loadTopicStats() {
    if (!topicId) return;
    
    // 获取浏览量
    get_browselog_count([topicId], (message) => {
      if (message && message.code === 200) {
        const countData = message.counts.find(item => item.targetId === topicId);
        if (countData) {
          viewCount = countData.count;
        }
      }
      loadingStats = false;
    });
    
    // 获取回复数
    get_topics_post_count([topicId], (message) => {
      if (message && message.code === 200) {
        const countData = message.counts.find(item => item.targetid === topicId);
        if (countData) {
          replyCount = countData.count;
        }
      }
    });
  }
  
  // 初始化SimpleMDE编辑器
  function initSimpleMDE() {
    if (typeof window === 'undefined') return;
    
    // 等待DOM渲染完成
    setTimeout(() => {
      if (replyTextarea) {
        // 创建自定义工具栏
        const customToolbar = [
          "bold", "italic", "heading", "|",
          "code", "quote", "unordered-list", "ordered-list", "|",
          "link", customImageButton, "|",
          "preview", "guide"
        ];
        
        simpleMDE = new SimpleMDE({
          element: replyTextarea,
          spellChecker: false,
          autosave: {
            enabled: false,
            uniqueId: "topic-reply-" + topicId,
          },
          placeholder: "输入您的回复内容...支持Markdown语法，可直接粘贴截图或上传图片",
          hideIcons: ["guide", "fullscreen", "side-by-side"],
          showIcons: ["code", "table"],
          status: false,
          toolbar: customToolbar,
          uploadImage: true,
          imageUploadFunction: uploadImage,
          renderingConfig: {
            singleLineBreaks: false,
            codeSyntaxHighlighting: true,
          }
        });
        
        // 监听编辑器内容变化
        simpleMDE.codemirror.on("change", () => {
          replyContent = simpleMDE.value();
        });
        
        // 添加粘贴事件监听，支持截图粘贴
        setupPasteHandler();
      }
    }, 100);
  }
  
  // 设置粘贴事件处理器
  function setupPasteHandler() {
    if (!simpleMDE || !simpleMDE.codemirror) return;
    
    const cm = simpleMDE.codemirror;
    const textarea = cm.getInputField();
    
    textarea.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      // 检查是否有图片数据
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault(); // 阻止默认粘贴行为
          
          const file = items[i].getAsFile();
          if (file) {
            try {
              await handlePastedImageUpload(file);
            } catch (error) {
              console.error('处理粘贴图片失败:', error);
              showNotification('图片上传失败', 3000, 'error');
            }
          }
          break;
        }
      }
    });
  }
  
  // 处理粘贴的图片上传
  async function handlePastedImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('不是有效的图片文件');
    }
    
    // 检查文件大小
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('图片大小不能超过5MB');
    }
    
    showNotification('正在上传粘贴的图片...', 2000, 'info');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // 使用当前时间戳作为文件名
        const timestamp = Date.now();
        const filename = `screenshot_${timestamp}.png`;
        
        upload_file(filename, uint8Array, Keypub, Keypriv, function(message) {
          if (message && message[2] && message[2].code == 200) {
            const url = message[2].fileUrl;
            const cm = simpleMDE.codemirror;
            const cursor = cm.getCursor();
            
            const imageMarkdown = `![截图](${uploadpath + url})`;
            cm.replaceRange(imageMarkdown, cursor);
            
            cm.setCursor({
              line: cursor.line,
              ch: cursor.ch + imageMarkdown.length
            });
            
            showNotification('截图上传成功', 2000, 'success');
            resolve(url);
          } else {
            
          }
        });
      };
      
      reader.onerror = function(error) {
        reject(error);
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  // SimpleMDE的图片上传函数
  async function uploadImage(file, onSuccess, onError) {
    try {
      showNotification(`正在上传 ${file.name}...`, 2000, 'info');
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          const arrayBuffer = e.target.result;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          upload_file(file.name, uint8Array, Keypub, Keypriv, function(message) {
            if (message && message[2] && message[2].code == 200) {
              const url = uploadpath + message[2].fileUrl;
              onSuccess(url);
              showNotification(`${file.name} 上传成功`, 2000, 'success');
              resolve(url);
            } else {
              // 备选方案
              if (file.size < 1024 * 1024) {
                const base64 = e.target.result;
                onSuccess(base64);
                showNotification(`${file.name} 已嵌入（base64格式）`, 2000, 'info');
                resolve(base64);
              } else {
                onError('上传失败');
                reject(new Error('上传失败'));
              }
            }
          });
        };
        
        reader.readAsArrayBuffer(file);
      });
    } catch (error) {
      console.error('图片上传失败:', error);
      onError(error.message);
    }
  }
  
  // 加载用户资料 - 恢复原始逻辑
  async function loadUserProfiles() {
    if (!topic) return;
    
    console.log('开始加载用户资料，pubkeys数量:', users_pubkey.length);
    
    return new Promise((resolve, reject) => {
      // 使用store_get_users_profile获取用户资料
      store_get_users_profile(
        users_pubkey,
        (profile) => {
          if (profile && profile.pubkey) {
            // 存储用户资料（兼容profile.data或直接profile）- 恢复原始逻辑
            users_profile = {
              ...users_profile,
              [profile.pubkey]: profile.data || profile
            };
            
            console.log(`已加载用户资料: ${profile.pubkey}`, users_profile[profile.pubkey]);
          }
          // 收到EOSE标识时，解析Promise
          if (profile === "EOSE") {
            console.log('用户资料加载完成');
            profilesLoaded = true;
            resolve();
          }
        },
        (error) => {
          console.error('获取用户资料失败:', error);
          // 错误时拒绝Promise
          reject(error);
        }
      );
    });
  }
  
  // 获取用户显示名称（恢复原始逻辑）
  function getUserDisplayName(pubkey) {
    if (!pubkey) return '未知用户';
    
    const profile = users_profile[pubkey];
    if (profile) {
      return profile.displayName || profile.name || profile.username || `用户${pubkey.slice(0, 6)}`;
    }
    
    return `用户${pubkey.slice(0, 6)}`;
  }
  
  // 获取用户头像（恢复原始逻辑）
  function getUserAvatar(pubkey) {
    if (!pubkey) return 'https://api.dicebear.com/7.x/avataaars/svg?seed=unknown';
    
    const profile = users_profile[pubkey];
    if (profile && profile.avatarUrl) {
      return uploadpath + profile.avatarUrl;
    }
    
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${pubkey}`;
  }
  
  // 获取用户其他资料
  function getUserProfile(pubkey) {
    if (!pubkey || !users_profile[pubkey]) return null;
    return users_profile[pubkey];
  }
  
  // 检查用户是否有资料
  function hasUserProfile(pubkey) {
    return !!users_profile[pubkey];
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
  
  // 发布回复
  async function publishReply() {
    if (!replyContent.trim() || !currentUser || replying) return;
    
    replying = true;
    
    try {
      // 创建回复内容
      const replyData = {
        content: replyContent,
        topic_id: topic.id,
        created_at: Math.floor(Date.now() / 1000)
      };
      
      // 调用API发布回复
      await new Promise((resolve, reject) => {
        create_post(
          replyContent,
          topicId,topicId,"",
          currentUser.pubkey,
          currentUser.privkey,
          (message) => {
            if (message && message.code === 200) {
              showNotification("回复发布成功", 3000, "success");
              
              // 清空编辑器内容
              if (simpleMDE) {
                simpleMDE.value('');
              }
              
              // 重新加载页面获取最新回复
              setTimeout(() => {
                window.location.reload();
              }, 1000);
              
              resolve();
            } else if (message === "ERROR") {
              reject(new Error('发布回复失败'));
            }
          }
        );
      });
      
    } catch (error) {
      console.error('发布回复失败:', error);
      showNotification(error.message || "发布回复失败", 3000, "error");
    } finally {
      replying = false;
    }
  }
  
  // 返回主题列表
  function goBackToList() {
    goto('/viewtopics');
  }
  
  // 编辑主题（如果是作者）
  function editTopic() {
    if (topic && currentUser && topic.user.pubkey === currentUser.pubkey) {
      goto(`/edittopic/${topicId}`);
    } else {
      showNotification("您不是该主题的作者", 3000, "warning");
    }
  }
  
  // 跳转到登录页面
  function goToLogin() {
    goto('/login');
  }
</script>

<svelte:head>
  <link rel="stylesheet" href="/lib/simplemde/simplemde.min.css">
  <script src="/lib/simplemde/simplemde.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
   <title>{topic?.title || '主题详情'}</title>
</svelte:head>

<!-- 亮色科技感背景 -->
<div class="min-h-screen bg-gray-50">
  <!-- 浅色网格底纹 -->
  <div class="fixed inset-0 bg-[linear-gradient(rgba(66,153,225,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(66,153,225,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
  
  <!-- 浅色光晕效果 -->
  <div class="fixed top-0 left-1/4 w-96 h-96 bg-blue-100/50 rounded-full filter blur-[100px] pointer-events-none"></div>
  <div class="fixed bottom-0 right-1/4 w-96 h-96 bg-purple-100/50 rounded-full filter blur-[100px] pointer-events-none"></div>
  
  <div class="container mx-auto px-4 py-8 max-w-4xl relative z-10">
    <!-- 返回按钮 - 亮色科技感样式 -->
    <div class="mb-8">
      <button 
        on:click={goBackToList}
        class="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-all duration-300 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-white shadow-md hover:shadow-blue-100"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        返回主题列表
      </button>
    </div>
    
    {#if !topic}
      <!-- 加载中或错误状态 - 亮色科技感加载动画 -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg p-8 text-center py-16">
        <div class="text-gray-600 mb-6">
          {#if data.error}
            <div class="w-16 h-16 mx-auto mb-4 text-red-500">
              <svg class="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="text-xl text-red-600 font-medium">{data.error}</div>
            <p class="text-gray-500 mt-2">加载主题失败，请稍后重试</p>
          {:else}
            <div class="w-16 h-16 mx-auto border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <div class="text-xl text-gray-800">加载中...</div>
            <p class="text-gray-500 mt-2">正在获取主题内容</p>
          {/if}
        </div>
      </div>
    {:else}
      <!-- 主题内容 - 亮色科技感卡片 -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg mb-8 overflow-hidden relative">
        <!-- 亮色装饰元素 -->
        <div class="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-blue-200 rounded-bl-full"></div>
        <div class="absolute bottom-0 left-0 w-24 h-24 border-b-2 border-l-2 border-purple-200 rounded-tr-full"></div>
        
        <!-- 主题头部 - 仅保留这个原生CSS渐变背景修改 -->
        <div style="background: linear-gradient(to bottom right, rgba(239, 246, 255, 0.8), rgba(241, 245, 249, 0.3), rgba(250, 245, 255, 0.5));" class="p-8 border-b border-blue-200  relative z-10">
          <div class="flex flex-col justify-between mb-6 gap-4">
            <div>
              {#if topic.is_sticky}
                <!-- 置顶标签 - 恢复原始样式 -->
                <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-100 to-amber-50 text-amber-800 text-xs font-semibold rounded-full mb-3 backdrop-blur-sm border border-amber-200 shadow-sm">
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.5 17.5v-11l7 7 7-7v11a.5.5 0 01-.5.5H6a.5.5 0 01-.5-.5z"/>
                  </svg>
                  置顶主题
                </span>
              {/if}
              
              <!-- 主题标题 - 突出显示 -->
              <h1 class="text-2xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">{topic.title}</h1>
              
              <!-- 作者信息和统计数据放在一行，弱化次要信息 -->
              <div class="flex flex-wrap items-center justify-between gap-6 mb-6">
                <!-- 作者信息 -->
                <div class="flex items-center gap-4">
                  <img 
                    src={uploadpath + users_profile[topic.user]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${topic.user}`}
                    alt={getUserDisplayName(topic.user)}
                    class="w-10 h-10 rounded-full border-2 border-white shadow-md shadow-blue-50"
                    on:error={(e) => {
                      e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${topic.user || 'unknown'}`;
                    }}
                  />
                  <div>
                    <div class="font-medium text-gray-900">
                      {users_profile[topic.user]?.displayName || users_profile[topic.user]?.username || `用户${topic.user?.slice(0, 6) || '未知'}`}
                    </div>
                    <div class="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span class="flex items-center gap-1.5">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        {formatTime(topic.created_at)}
                      </span>
                      {#if topic.last_reply_at}
                        <span class="flex items-center gap-1.5">
                          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                          </svg>
                          最后回复: {formatTime(topic.last_reply_at)}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
                
                <!-- 统计数据 - 移到右侧，缩小尺寸 -->
                <div class="flex items-center gap-4">
                  <!-- 浏览量 -->
                  <div class="flex items-center gap-2 text-gray-800" title="浏览量">
                    <div class="w-6 h-6 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center  ">
                      <svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </div>
                    <div>
                      <div class="text-base font-semibold text-gray-900">
                        {#if loadingStats}
                          <span class="inline-block w-8 h-4 bg-blue-100/50 rounded animate-pulse"></span>
                        {:else}
                          {viewCount || 0}
                        {/if}
                      </div>
                    </div>
                  </div>
                  
                  <!-- 回复数 -->
                  <div class="flex items-center gap-2 text-gray-800" title="回复数">
                    <div class="w-6 h-6 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center  ">
                      <svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                      </svg>
                    </div>
                    <div>
                      <div class="text-base font-semibold text-gray-900">{replyCount || posts.length}</div>
                    </div>
                  </div>
                  
                  <!-- 只显示有分类的情况 -->
                  {#if topic.category && topic.category !== '未分类'}
                    <div class="flex items-center gap-2 text-gray-800">
                      <div class="w-6 h-6 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center border border-purple-100">
                        <svg class="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                        </svg>
                      </div>
                      <div>
                        <div class="text-xs text-gray-500">分类</div>
                        <div class="text-base font-semibold text-gray-900">{topic.category}</div>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
              
              <!-- 编辑按钮 - 恢复原始样式 -->
              {#if currentUser && topic.user.pubkey === currentUser.pubkey}
                <button 
                  on:click={editTopic}
                  class="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 hover:from-blue-200 hover:to-blue-100 rounded-lg transition-all duration-300 border border-blue-200 backdrop-blur-sm shadow-md hover:shadow-blue-100 mb-6 self-start"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  编辑主题
                </button>
              {/if}
            </div>
          </div>
        </div>
        
        <!-- 主题内容区域 - 白色背景 -->
        <div class="p-8">
          <!-- 主题内容 - 突出显示 -->
          <div class="prose max-w-none relative z-10 text-lg leading-relaxed">
            {@html topic.renderedContent || topic.content}
          </div>
          
          <!-- 标签 - 恢复原始样式 -->
          {#if topic.labels && topic.labels.length > 0}
            <div class="flex flex-wrap gap-2 pt-8 border-t border-gray-100 relative z-10">
              <span class="text-gray-600 text-sm font-medium mr-2">标签:</span>
              {#each topic.labels as label}
                <!-- 适配不同的标签数据格式 -->
                {#if typeof label === 'string'}
                  <span class="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-sm rounded-lg border border-blue-200 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                    {label}
                  </span>
                {:else if Array.isArray(label) && label.length > 0}
                  <span class="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-sm rounded-lg border border-blue-200 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                    {label[1] || label[0]}
                  </span>
                {:else if label}
                  <span class="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-sm rounded-lg border border-blue-200 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                    {label}
                  </span>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- 回复区域 - 亮色科技感卡片 -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg p-8 relative">
        <!-- 亮色装饰元素 -->
        <div class="absolute top-0 left-0 w-24 h-24 border-t-2 border-l-2 border-green-200 rounded-br-full"></div>
        
        <h2 class="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3 relative z-10">
          <span class="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center border border-green-100">
            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
          </span>
          评论区 ({replyCount || posts.length})
        </h2>
        
        <!-- 回复列表 -->
        {#if posts.length === 0}
          <div class="text-center py-12 text-gray-600 relative z-10">
            <div class="w-16 h-16 mx-auto mb-4 text-gray-300">
              <svg class="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
              </svg>
            </div>
            <h3 class="text-xl text-gray-800 mb-2">暂无评论</h3>
            <p class="text-gray-500">快来成为第一个评论的人吧！</p>
          </div>
        {:else}
          <div class="space-y-0 mb-8 relative z-10">
            {#each posts as post, index (post.id)}
              <div class="py-6 ">
                 
                <!-- 强化的隔离线 - 更明显的视觉效果 -->
                {#if index > 0}
                  <div class="w-full h-[1px] bg-gray-200 my-8"></div>
                {/if}
                
                <div class="flex gap-4">
                  <!-- 用户头像 -->
                  <div class="flex-shrink-0">
                    <img 
                      src={uploadpath + users_profile[post.user]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user}`} 
                      alt={getUserDisplayName(post.user)}
                      class="w-10 h-10 rounded-full border border-white shadow-md shadow-purple-50"
                      on:error={(e) => {
                        e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user || 'unknown'}`;
                      }}
                    />
                  </div>
                  
                  <!-- 回复内容 -->
                  <div class="flex-1 min-w-0">
                    <div class="mb-3">
                      <div class="flex flex-wrap items-center gap-3 mb-2">
                        <span class="font-medium text-gray-900">
                          {users_profile[post.user]?.displayName || users_profile[post.user]?.username || `用户${post.user?.slice(0, 6) || '未知'}`}
                        </span>
                        <span class="text-sm text-gray-500 px-2 py-0.5 bg-gray-100 rounded-full">
                          {formatTime(post.created_at)}
                        </span>
                      </div>
                    </div>
                    
                    <div class="prose prose-sm max-w-none text-gray-700 text-base">
                      {@html post.content}
                    </div>
                  </div>
                </div>
               <div class="mt-4 mx-auto border-b border-purple-100 border-opacity-80"></div>
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- 发布回复区域 -->
        {#if currentUser}
          <!-- 登录用户显示回复表单 -->
          <div class="  pt-8 relative z-10">
            <h3 class="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              发表评论
            </h3>
            
            <div class="space-y-6">
              <!-- SimpleMDE编辑器 - 亮色科技感样式 -->
              <div class="simplemde-editor bg-white border border-gray-200 rounded-lg overflow-hidden shadow-md">
                <textarea
                  bind:this={replyTextarea}
                  id="reply-editor"
                  placeholder="输入您的回复内容...支持Markdown语法，可直接粘贴截图或上传图片"
                  rows="4"
                  class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none hidden bg-white text-gray-800"
                ></textarea>
              </div>
              
              <!-- 上传提示 - 亮色科技感样式 -->
              <div class="text-sm text-gray-700 bg-blue-50 p-4 rounded-lg border border-blue-100 backdrop-blur-sm">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>支持Markdown语法，可直接粘贴截图或使用工具栏上传图片（最大5MB）</span>
                </div>
              </div>
              
              <div class="flex justify-end gap-4">
                <button
                  on:click={() => {
                    if (simpleMDE) {
                      simpleMDE.value('');
                    }
                  }}
                  class="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm"
                >
                  清空内容
                </button>
                
                <!-- 发布按钮 - 完全恢复原始样式 -->
                <button
                  on:click={publishReply}
                  disabled={!replyContent.trim() || !currentUser || replying}
                  class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 shadow-lg shadow-blue-200/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {#if replying}
                    <span class="flex items-center gap-2">
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      发布中...
                    </span>
                  {:else}
                    发布评论
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {:else}
          <!-- 未登录用户显示登录提示 - 恢复原始样式 -->
          <div class="border-t border-gray-200 pt-8 relative z-10">
            <div class="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center backdrop-blur-sm">
              <div class="mb-6">
                <svg class="w-16 h-16 text-blue-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-gray-900 mb-3">登录后即可参与讨论</h3>
              <p class="text-gray-600 mb-6 max-w-md mx-auto">请登录后发表评论，与其他用户一起交流技术观点和经验。</p>
              <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <!-- 登录按钮 - 完全恢复原始样式 -->
                <button
                  on:click={goToLogin}
                  class="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 shadow-lg shadow-blue-200/50"
                >
                  立即登录
                </button>
                <button
                  on:click={goBackToList}
                  class="px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm"
                >
                  返回主题列表
                </button>
              </div>
              <p class="text-sm text-gray-500 mt-6">
                还没有账号？<a href="/register" class="text-blue-600 hover:text-blue-700 font-medium transition-colors">立即注册</a>
              </p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
  
  <!-- 底部装饰 -->
  <div class="h-16 bg-gradient-to-t from-gray-50 to-transparent"></div>
</div>

<style>
  /* 基础动画 */
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
  
  .animate-pulse {
    animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  /* 确保prose样式正常工作 */
  .prose {
    color: #374151;
    font-size: 1.1rem;
    line-height: 1.8;
  }
  
  .prose p {
    margin-top: 1.5em;
    margin-bottom: 1.5em;
  }
  
  .prose h1, .prose h2, .prose h3, .prose h4 {
    color: #111827;
    font-weight: 600;
    margin-top: 1.8em;
    margin-bottom: 0.8em;
  }
  
  .prose a {
    color: #3b82f6;
    text-decoration: underline;
  }
  
  .prose code {
    background-color: #f3f4f6;
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-size: 0.875em;
  }
  
  .prose pre {
    background-color: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-top: 1.5em;
    margin-bottom: 1.5em;
  }
  
  /* SimpleMDE编辑器亮色科技感样式 */
  .simplemde-editor {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
    background-color: white;
  }
  
  .simplemde-editor .editor-toolbar {
    border: none;
    border-bottom: 1px solid #e5e7eb;
    background-color: #f9fafb;
    padding: 0.75rem;
  }
  
  .simplemde-editor .editor-toolbar button {
    border: 1px solid transparent;
    background: none;
    color: #6b7280;
    margin: 0 4px;
    border-radius: 0.25rem;
    padding: 4px 8px;
  }
  
  .simplemde-editor .editor-toolbar button:hover,
  .simplemde-editor .editor-toolbar button.active {
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
  }
  
  .simplemde-editor .CodeMirror {
    border: none;
    font-family: 'Inter', 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace;
    min-height: 200px;
    padding: 1rem;
    background-color: white;
    color: #111827;
  }
  
  .simplemde-editor .editor-preview {
    background-color: #f9fafb;
    color: #111827;
    padding: 1rem;
  }
  
  /* 滚动条美化 */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f3f4f6;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
  
  /* 响应式调整 */
  @media (max-width: 768px) {
    .container {
      padding-left: 1rem;
      padding-right: 1rem;
    }
    
    .prose {
      font-size: 1rem;
    }
    
    h1 {
      font-size: 2rem !important;
    }
    
    h2 {
      font-size: 1.5rem !important;
    }
    
    .simplemde-editor .CodeMirror {
      min-height: 150px;
    }
  }
</style>
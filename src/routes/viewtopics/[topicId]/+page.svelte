<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { store_get_users_profile } from "$lib/userProfileStore";
  import { upload_file, create_post } from "$lib/esclient";
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
 
  });
  
  onDestroy(() => {
    // 清理SimpleMDE实例
    if (simpleMDE) {
      simpleMDE.toTextArea();
      simpleMDE = null;
    }
  });
  
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
  
  // 加载用户资料
  async function loadUserProfiles() {
    if (!topic) return;
    
    console.log('开始加载用户资料，pubkeys数量:', users_pubkey.length);
    
    return new Promise((resolve, reject) => {
      // 使用store_get_users_profile获取用户资料
      store_get_users_profile(
        users_pubkey,
        (profile) => {
          if (profile && profile.pubkey) {
            // 存储用户资料（兼容profile.data或直接profile）
            const userData = profile.data || profile;
            
            // 重要：使用解构赋值创建新对象来触发响应式更新
            users_profile = {
              ...users_profile,
              [profile.pubkey]: userData
            };
            
            console.log(`已加载用户资料: ${profile.pubkey}`, userData);
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
  
  // 获取用户显示名称（带默认值）
  function getUserDisplayName(pubkey) {
    if (!pubkey) return '未知用户';
    
    const profile = users_profile[pubkey];
    if (profile) {
      return profile.displayName || profile.username || `用户${pubkey.slice(0, 6)}`;
    }
    
    return `用户${pubkey.slice(0, 6)}`;
  }
  
  // 获取用户头像（带默认值）
  function getUserAvatar(pubkey) {
    if (!pubkey) return 'https://api.dicebear.com/7.x/avataaars/svg?seed=unknown';
    
    const profile = users_profile[pubkey];
    if (profile && profile.avatarUrl) {
      return profile.avatarUrl;
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
   <title>{topic.title}</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <!-- 返回按钮 -->
  <div class="mb-6">
    <button 
      on:click={goBackToList}
      class="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
      </svg>
      返回主题列表
    </button>
  </div>
  
  {#if !topic}
    <!-- 加载中或错误状态 -->
    <div class="text-center py-12">
      <div class="text-gray-500 mb-4">
        {#if data.error}
          <div class="text-red-500">{data.error}</div>
        {:else}
          <div class="spinner mx-auto"></div>
          <div>加载中...</div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- 主题内容 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <!-- 主题头部 -->
      <div class="mb-6">
        <div class="flex justify-between items-start mb-4">
          <div>
            {#if topic.is_sticky}
              <span class="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full mb-2">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5.5 17.5v-11l7 7 7-7v11a.5.5 0 01-.5.5H6a.5.5 0 01-.5-.5z"/>
                </svg>
                置顶
              </span>
            {/if}
            <h1 class="text-3xl font-bold text-gray-900 mb-3">{topic.title}</h1>
          </div>
          
          {#if currentUser && topic.user.pubkey === currentUser.pubkey}
            <button 
              on:click={editTopic}
              class="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              编辑
            </button>
          {/if}
        </div>
        
        <!-- 作者信息 -->
        <div class="flex items-center gap-3 mb-6">
          <img 
            src={uploadpath + users_profile[topic.user]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${topic.user}`}
            alt={getUserDisplayName(topic.user)}
            class="w-10 h-10 rounded-full border-2 border-white shadow"
            on:error={(e) => {
              // 头像加载失败时使用默认头像
              e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${topic.user || 'unknown'}`;
            }}
          />
          <div>
            <div class="font-medium text-gray-900">
              {users_profile[topic.user]?.displayName || users_profile[topic.user]?.username || `用户${topic.user?.slice(0, 6) || '未知'}`}
 
            </div>
            <div class="flex items-center gap-3 text-sm text-gray-500">
              <span>发布时间：{formatTime(topic.created_at)}</span>
              <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                {topic.category || '未分类'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 主题内容 -->
      <div class="prose max-w-none mb-8">
        {@html topic.renderedContent || topic.content}
      </div>
      
      <!-- 标签 -->
      {#if topic.tags && topic.tags.length > 0}
        <div class="flex flex-wrap gap-2 pt-6 border-t border-gray-100">
          {#each topic.tags as tag}
            {#if Array.isArray(tag) && tag[0] === 't' && tag[1] !== 'create_topic'}
              <span class="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded-full">
                {tag[1]}
              </span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
    
    <!-- 回复区域 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 class="text-xl font-bold text-gray-900 mb-6">
        回复 ({posts.length})
      </h2>
      
      <!-- 回复列表 -->
      {#if posts.length === 0}
        <div class="text-center py-8 text-gray-500">
          暂无回复，快来第一个回复吧！
        </div>
      {:else}
        <div class="space-y-6 mb-8">
          {#each posts as post (post.id)}
            <div class="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
              <div class="flex gap-4">
                <!-- 用户头像 -->
                <div class="flex-shrink-0">
                  <img 
                    src={uploadpath + users_profile[post.user]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user}`} 
                    alt={getUserDisplayName(post.user)}
                    class="w-8 h-8 rounded-full"
                    on:error={(e) => {
                      e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user || 'unknown'}`;
                    }}
                  />
                </div>
                
                <!-- 回复内容 -->
                <div class="flex-1 min-w-0">
                  <div class="mb-3">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-900">
                        {users_profile[post.user]?.displayName || users_profile[post.user]?.username || `用户${post.user?.slice(0, 6) || '未知'}`}
                      </span>
 
                      <span class="text-sm text-gray-500">
                        {formatTime(post.created_at)}
                      </span>
                    </div>
                  </div>
                  
                  <div class="prose prose-sm max-w-none text-gray-700">
                    {@html post.content}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
      
      <!-- 发布回复区域 -->
      {#if currentUser}
        <!-- 登录用户显示回复表单 -->
        <div class="border-t border-gray-200 pt-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">发表回复</h3>
          
          <div class="space-y-4">
            <!-- SimpleMDE编辑器 -->
            <div class="simplemde-editor">
              <textarea
                bind:this={replyTextarea}
                id="reply-editor"
                placeholder="输入您的回复内容..."
                rows="4"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none hidden"
              ></textarea>
            </div>
            
            <!-- 简单的上传提示 -->
            <div class="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>支持Markdown语法，可直接粘贴截图或使用工具栏上传图片</span>
              </div>
            </div>
            
            <div class="flex justify-end gap-3">
              <button
                on:click={() => {
                  if (simpleMDE) {
                    simpleMDE.value('');
                  }
                }}
                class="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                清空
              </button>
              
              <button
                on:click={publishReply}
                disabled={!replyContent.trim() || !currentUser || replying}
                class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {#if replying}
                  <span class="flex items-center gap-2">
                    <div class="spinner-small"></div>
                    发布中...
                  </span>
                {:else}
                  发布回复
                {/if}
              </button>
            </div>
          </div>
        </div>
      {:else}
        <!-- 未登录用户显示登录提示 -->
        <div class="border-t border-gray-200 pt-6">
          <div class="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
            <div class="mb-4">
              <svg class="w-12 h-12 text-blue-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">登录后即可参与讨论</h3>
            <p class="text-gray-600 mb-4">请登录后发表回复，与其他用户一起交流。</p>
            <div class="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                on:click={goToLogin}
                class="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                立即登录
              </button>
              <button
                on:click={goBackToList}
                class="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                返回主题列表
              </button>
            </div>
            <p class="text-sm text-gray-500 mt-4">
              还没有账号？<a href="/register" class="text-blue-600 hover:text-blue-800 font-medium">立即注册</a>
            </p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* 确保prose样式正常工作 */
  .prose {
    color: #374151;
  }
  
  .prose p {
    margin-top: 1.25em;
    margin-bottom: 1.25em;
  }
  
  .prose h1, .prose h2, .prose h3, .prose h4 {
    color: #111827;
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
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
    margin-top: 1.25em;
    margin-bottom: 1.25em;
  }
  
  /* SimpleMDE样式调整 */
  .simplemde-editor {
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .simplemde-editor .editor-toolbar {
    border: none;
    border-bottom: 1px solid #d1d5db;
    background-color: #f9fafb;
    padding: 0.5rem;
  }
  
  .simplemde-editor .editor-toolbar button {
    border: 1px solid transparent;
    background: none;
    color: #6b7280;
    margin: 0 2px;
  }
  
  .simplemde-editor .editor-toolbar button:hover,
  .simplemde-editor .editor-toolbar button.active {
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
  }
  
  .simplemde-editor .CodeMirror {
    border: none;
    font-family: 'Inter', -apple-system, sans-serif;
    min-height: 200px;
    padding: 0.75rem;
    background-color: white;
  }
  
  .simplemde-editor .editor-preview {
    background-color: #f9fafb;
    padding: 1rem;
  }
  
  /* 暗色模式适配 */
  @media (prefers-color-scheme: dark) {
    .simplemde-editor {
      border-color: #374151;
    }
    
    .simplemde-editor .editor-toolbar {
      background-color: #1f2937;
      border-color: #374151;
    }
    
    .simplemde-editor .editor-toolbar button {
      color: #9ca3af;
    }
    
    .simplemde-editor .editor-toolbar button:hover,
    .simplemde-editor .editor-toolbar button.active {
      background-color: #374151;
      border-color: #4b5563;
      color: #f3f4f6;
    }
    
    .simplemde-editor .CodeMirror {
      background-color: #111827;
      color: #f9fafb;
    }
    
    .simplemde-editor .editor-preview {
      background-color: #1f2937;
    }
  }
</style>
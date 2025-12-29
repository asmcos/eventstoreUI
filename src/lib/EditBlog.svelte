<script>
  import { onMount, onDestroy } from 'svelte';
  import { uploadpath } from "$lib/config";
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { upload_file, create_blog } from "$lib/esclient";

  // 组件属性
  export let initialBlog = { title: '', content: '', coverUrl: '', labels: [] };
  export let onSaveSuccess = () => {};

  // 状态管理
  let Keypriv;
  let Keypub;
  let simplemde;
  let coverImageData = null;
  let blogData = { ...initialBlog };
  let isMouseInArea = false; // 控制提示框显示
  let initialContent=null;

 
  let blogId;

  // DOM引用
  let uploadArea;
  let previewImage;
  let fileInput;

  function getBlogId( ) {
      let url;
      // 处理传入的URL或使用当前页面URL
      if (blogId) return blogId;

      url = new URL(window.location.href);
   
      let Id = url.searchParams.get('blogid');
      
      blogId = Id;

      return Id; // 如果不存在会返回null
  }

  let showAddTagInput = false; // 控制添加标签输入框显示
  let newTagName = ""; // 新标签输入值

  const colorPool = [
    { bgClass: "bg-blue-100", textClass: "text-blue-800" },
    { bgClass: "bg-green-100", textClass: "text-green-800" },
    { bgClass: "bg-yellow-100", textClass: "text-yellow-800" },
    { bgClass: "bg-purple-100", textClass: "text-purple-800" },
    { bgClass: "bg-orange-100", textClass: "text-orange-800" },
    { bgClass: "bg-pink-100", textClass: "text-pink-800" },
    { bgClass: "bg-teal-100", textClass: "text-teal-800" }
  ];

  function addTag(){
    
    if (newTagName){
        
        blogData.labels.push(newTagName);
    }
    showAddTagInput = false;
    blogData.labels = [...blogData.labels]
    newTagName = "";

  }

  // 初始化
  onMount(async () => {
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;
    
    if (!Keypriv) {
      showNotification("请先登录", 2000, "warning");
      return;
    }

    // 初始化编辑器
    if (window.SimpleMDE) {
      initEditor(window.SimpleMDE);
    } else {
      loadSimpleMDE();
    }

    // 绑定粘贴事件
    document.addEventListener('paste', handlePaste);
      // 清理资源
 

    return () => {
 
      document.removeEventListener('paste', handlePaste);
        if (simplemde?.codemirror) {
            simplemde.toTextArea();
        }
    };

  });




  // 加载编辑器
  function loadSimpleMDE() {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://cdn.jsdelivr.net/npm/simplemde@1.11.2/dist/simplemde.min.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/simplemde@1.11.2/dist/simplemde.min.js';
    script.onload = () => initEditor(window.SimpleMDE);
    document.body.appendChild(script);
  }

  const insertImageButton = {
      name: 'insertImage',
      action: function (editor) {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.addEventListener('change', async (event) => {
              const file = event.target.files[0];
              if (file) {
                                    // 创建文件读取器
                const reader = new FileReader();

                // 读取完成后处理
                reader.onload = function(e) {
                    const arrayBuffer = e.target.result;
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    // 调用上传函数，使用原文件的名称
                    upload_file(file.name, uint8Array, Keypub, Keypriv, function(message) {
                        if (message[2].code == 200) {
                            let url = message[2].fileUrl;
                            const cm = editor.codemirror;
                            const cursor = cm.getCursor();
                            // 插入Markdown格式的图片链接
                            const imageMarkdown = `![图片](${uploadpath + url})\n`;
                            cm.replaceRange(imageMarkdown, cursor);
                            cm.setCursor(cursor.line + 1, 0);
                        }
                    });
                };
                  // 读取文件为ArrayBuffer
                reader.readAsArrayBuffer(file);
              }
          });
          input.click();
      },
      className: 'fa fa-camera',
      title: '上传图片'
  };

  // 初始化编辑器
  function initEditor(SimpleMDE) {
    simplemde = new SimpleMDE({
      element: document.getElementById('blogEditor'),
      autoDownloadFontAwesome: false,
      spellChecker: false,
      toolbar: [
        'heading-1', 'heading-2', 'heading-3', '|',
        'bold', 'italic', 'strikethrough', '|',
        'unordered-list', 'ordered-list', '|',
        'link', 'image', 'table', '|',
        'quote', 'code', '|',
        'preview', 'side-by-side', 'fullscreen',insertImageButton, '|',
        'guide'
      ],
      initialValue: blogData.content 
    });
  }

  // 处理图片文件
  function handleImageFile(blob) {
    const reader = new FileReader();
    reader.onload = (event) => {
      blogData.coverUrl = "";
      previewImage.src = event.target.result;
      previewImage.classList.remove('hidden');
      
      // 转换为Uint8Array
      const [header, base64Data] = event.target.result.split(',');
      const binaryString = atob(base64Data);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      coverImageData = uint8Array;
      showNotification("封面图片已准备好", 2000, "info");
    };
    reader.readAsDataURL(blob);
  }

  // 处理粘贴事件
  function handlePaste(e) {
    // 编辑器内粘贴
    if (simplemde?.codemirror?.hasFocus()) {
      handleEditorPaste(e);
    }
    // 封面区域粘贴
    else if (isMouseInArea) {
      handleUploadAreaPaste(e);
    }
  }

  // 封面区域粘贴处理
  function handleUploadAreaPaste(e) {
    if (!e.clipboardData?.items) return;
    for (let item of e.clipboardData.items) {
      if (item.kind === 'file' && item.type.includes('image')) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          handleImageFile(blob);
          showNotification("图片处理中...", 1000, "info");
          break;
        }
      }
    }
  }

  // 编辑器内粘贴处理
  function handleEditorPaste(e) {
    if (!e.clipboardData?.items) return;
    for (let item of e.clipboardData.items) {
      if (item.kind === 'file' && item.type.includes('image')) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            const uint8Array = new Uint8Array(event.target.result);
            upload_file("paste.png", uint8Array, Keypub, Keypriv, (message) => {
              if (message[2]?.code === 200) {
                const url = message[2].fileUrl;
                const cm = simplemde.codemirror;
                const cursor = cm.getCursor();
                cm.replaceRange(`![图片](${uploadpath + url})\n`, cursor);
                cm.setCursor(cursor.line + 1, 0);
                showNotification("图片上传成功", 2000, "success");
              }
            });
          };
          reader.readAsArrayBuffer(blob);
          break;
        }
      }
    }
  }

  // 保存博客
  async function saveBlog(isPublish = false) {
    if (!Keypriv) return;
    blogData.content = simplemde?.value() || '';
    if (!blogData.title.trim()) {
      showNotification("请输入文章标题", 2000, "warning");
      return;
    }

    // 上传封面
    if (coverImageData) {
      try {
        const uploadResult = await new Promise(resolve => {
          upload_file(`cover-${Date.now()}.png`, coverImageData, Keypub, Keypriv, (result) => {
                  
              const { code, fileUrl, taskId } = result[2];
              if (code === 200) {
                resolve(result);
              } else if (code === 202) {
                
              } else {
                reject(new Error("封面上传失败")); // 其他状态码直接reject
              }
            });
        }); // Promise;
        if (uploadResult[2]?.code === 200) {
          blogData.coverUrl = uploadResult[2].fileUrl;
        }  

      } catch (error) {
        showNotification("封面处理出错", 2000, "error");
        return;
      }
    }

    if (getBlogId() ) { blogData.blogId = getBlogId();};
    // 提交博客
   
    blogData.isPublished = isPublish;
    blogData.updatedAt = new Date().toISOString();
    create_blog(JSON.stringify(blogData), Keypub, Keypriv, (message) => {
      if (message.code === 201 && !blogId) blogId = message.id ;
      
      if (message.code === 200) {
        showNotification(isPublish ? "文章发布成功" : "草稿保存成功", 2000, "success");
        blogData.id = blogId;
        onSaveSuccess(blogData);
      } else {
        showNotification("保存失败", 2000, "error");
      }
    });
  }

  $: if (initialBlog.content && initialBlog.content !== initialContent) {
    // 使用解构复制，避免直接引用导致的响应式问题
    
    initialContent = initialBlog.content;
    blogData = { ...initialBlog };
    if (simplemde){
      simplemde.value(blogData.content);
      setTimeout(() => {
        if (simplemde?.codemirror) {
          // 触发CodeMirror重绘
          simplemde.codemirror.refresh();
          // 手动调整高度（确保内容完全显示）
          const contentHeight = simplemde.codemirror.getScrollInfo().height;
          simplemde.codemirror.setSize(null, contentHeight);
        }
    }, 300);
    }
    
  }

  // 优化图片显示的响应式逻辑
  $: if (previewImage) {
    // 当有封面图URL时显示图片
    if (blogData.coverUrl) {
      previewImage.src = uploadpath + blogData.coverUrl;
      previewImage.classList.remove('hidden');
    } 
    // 当有本地选择的图片时显示图片
    else if (coverImageData) {
      previewImage.classList.remove('hidden');
    } 
    // 否则隐藏图片
    else {
      previewImage.classList.add('hidden');
    }
  }
</script>

<style>
  /* 核心容器样式 */
  .editor-container {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .editor-head {
    border-bottom: 1px solid #E5E7EB;
    padding: 1rem 1.5rem;
  }

  .editor-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1F2937;
  }

  .editor-subtitle {
    color: #6B7280;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .editor-content {
    padding: 1.5rem;
  }

  /* 表单样式 */
  .form-group {
    margin-bottom: 1.5rem;
    position: relative; /* 用于提示框定位 */
    padding-top: 1.5rem; /* 预留提示框空间 */
  }

  .form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #4B5563;
    margin-bottom: 0.5rem;
  }

  .form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #D1D5DB;
    border-radius: 0.375rem;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #4F46E5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
  }

  /* 封面上传区域 */
  .upload-area {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .upload-preview {
    position: relative; /* 为内部元素定位提供基准 */
    width: 4rem;
    height: 4rem;
    background: #F3F4F6;
    border: 2px dashed #D1D5DB;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9CA3AF;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .upload-preview:hover,
  .upload-preview--active {
    border-color: #4F46E5;
    background-color: #EEF2FF;
    color: #4F46E5;
  }

  /* 预览图片样式修复 */
  #previewImage {
    width: 100%;
    height: 100%;
    object-fit: cover; /* 确保图片填满容器且不变形 */
    display: none; /* 初始隐藏 */
  }

  /* 移除 .hidden 类时显示图片（提高优先级） */
  #previewImage:not(.hidden) {
    display: block !important; /* 强制显示 */
    z-index: 1; /* 确保图片在图标上方 */
  }

  /* 图片显示时隐藏图标（优化选择器优先级） */
  .upload-preview #previewImage:not(.hidden) ~ i.fas.fa-image {
    display: none !important;
  }

  /* 上传按钮 */
  .upload-btn {
    padding: 0.5rem 1rem;
    background: #F3F4F6;
    color: #4B5563;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    border: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .upload-btn:hover {
    background: #E5E7EB;
  }

  /* 提示框样式（核心修复） */
  .upload-tooltip {
    position: absolute;
    top: 20px; /* 显示在"文章封面"标题下方 */
    left: 0;
    background: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  /* 提示框显示控制 */
  .upload-tooltip.show-tooltip {
    opacity: 1 !important;
  }

  /* 提示框箭头 */
  .upload-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 2rem;
    border-width: 4px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }

  /* 编辑器样式 */
  .CodeMirror {
    min-height: 300px !important;
    border: 1px solid #E5E7EB !important;
    border-radius: 0.375rem !important;
  }

  .editor-toolbar {
    background: #F9FAFB !important;
    border-radius: 0.375rem 0.375rem 0 0 !important;
  }

  /* 按钮区域 */
  .editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-outline {
    border: 1px solid #D1D5DB;
    background: transparent;
    color: #4B5563;
  }

  .btn-outline:hover {
    background: #F3F4F6;
  }

  .btn-primary {
    background: linear-gradient(to right, #4F46E5, #8B5CF6);
    color: white;
  }

  .btn-primary:hover {
    opacity: 0.9;
    box-shadow: 0 4px 6px rgba(79, 70, 229, 0.1);
  }

  /* 分类样式 */
  .categories {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .category-tag {
    padding: 0.25rem 0.75rem;
    background: #EFF6FF;
    color: #2563EB;
    border-radius: 999px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .category-tag:hover {
    background: #DBEAFE;
  }

  .add-category {
    color: #4F46E5;
    font-size: 0.75rem;
    cursor: pointer;
    align-self: center;
    border: none;
    background: none;
    padding: 0;
  }

  .add-category:hover {
    text-decoration: underline;
  }

  /* 隐藏文件输入 */
  #coverFileInput {
    display: none;
  }

    /* 新增标签输入框样式 */
  .tag-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .tag-input {
    width: auto !important; /* 强制覆盖 100% 宽度 */
    min-width: 120px;
    padding: 0.25rem 0.5rem;
    border: 1px solid #D1D5DB;
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }   
  .tag-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border-radius: 0.25rem;
    cursor: pointer;
    border: none;
  }
  
  .tag-remove-btn {
    margin-left: 0.25rem;
    border: none;
    background: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    font-size: 0.75rem;
  }
  
  .tag-remove-btn:hover {
    opacity: 1;
  }
</style>

<!-- 编辑器主体 -->
<div class="editor-container">
  <!-- 头部 -->
  <div class="editor-head">
    <h2 class="editor-title">创作新博客</h2>
    <p class="editor-subtitle">撰写并发布新的博客文章</p>
  </div>

  <!-- 内容区 -->
  <div class="editor-content">
    <!-- 文章标题 -->
    <div class="form-group">
      <label class="form-label">文章标题</label>
      <input 
        type="text" 
        class="form-input" 
        placeholder="输入文章标题..." 
        bind:value={blogData.title}
      >
    </div>

    <!-- 文章标签区域 -->
    <div class="form-group">
        <label class="form-label">文章标签</label>
        <div class="categories">
        <!-- 显示已选标签（前5个） -->
        {#each blogData.labels.slice(0, 5) as label, index}
            <span class="px-3 py-1 rounded-full text-sm flex items-center {colorPool[index].bgClass} {colorPool[index].textClass}">
            {label}
            <!-- 移除标签按钮 -->
            <button 
                class="tag-remove-btn"
                on:click={(e) => {
                e.stopPropagation(); // 防止事件冒泡
                // 从数组中移除当前标签
                blogData.labels = blogData.labels.filter((_, i) => i !== index);
                }}
            >
                <i class="fas fa-times"></i>
            </button>
            </span>
        {/each}

        <!-- 显示超出数量提示 -->
        {#if blogData.labels.length > 5}
            <span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
            +{blogData.labels.length - 5}
            </span>
        {/if}

        <!-- 添加标签按钮/输入框切换 -->
        {#if !showAddTagInput}
            <button class="add-category" on:click={() => showAddTagInput = true}>
            <i class="fas fa-plus mr-1"></i> 添加标签
            </button>
        {:else}
            <!-- 新增标签输入框 -->
            <div class="tag-input-group">
            <input
                type="text"
                class="form-input tag-input" 
                placeholder="输入标签..."
                bind:value={newTagName}
                on:keydown={(e) => {
                if (e.key === 'Enter') addTag();
                if (e.key === 'Escape') showAddTagInput = false;
                }}
                autofocus
            >
            <button class="tag-btn bg-primary text-white" on:click={addTag}>
                确认
            </button>
            <button class="tag-btn bg-gray-100 text-gray-600" on:click={() => showAddTagInput = false}>
                取消
            </button>
            </div>
        {/if}
        </div>
    </div>

    <!-- 文章封面 -->
    <div class="form-group">
      <!-- 标题 -->
      <label class="form-label">文章封面</label>
      
      <!-- 提示框：在"文章封面"标题下方左侧显示 -->
      <div 
        class="upload-tooltip"
        class:show-tooltip={isMouseInArea}
      >
        点击粘贴截图
      </div>
      
      <!-- 上传区域 -->
      <div class="upload-area">
        <!-- 预览区 -->
        <div 
          class="upload-preview" 
          id="imageUploadArea"
          on:mouseenter={() => isMouseInArea = true}
          on:mouseleave={() => isMouseInArea = false}
          class:upload-preview--active={isMouseInArea}
        >
          {#if coverImageData === null && !blogData.coverUrl} 
            <i class="fas fa-image text-xl"></i>
          {/if}
          <img id="previewImage" class="hidden" alt="封面预览" bind:this={previewImage}>
        </div>
        
        <!-- 上传按钮 -->
        <label for="coverFileInput" class="upload-btn">
          <i class="fas fa-upload mr-1"></i> 上传封面
        </label>
        
        <!-- 隐藏输入框 -->
        <input 
          id="coverFileInput" 
          type="file" 
          accept="image/*" 
          bind:this={fileInput}
          on:change={(e) => {
            const file = e.target.files[0];
            if (file?.type.includes('image')) handleImageFile(file);
            e.target.value = '';
          }}
        >
      </div>
    </div>

    <!-- 编辑器 -->
    <div class="form-group">
      <textarea id="blogEditor" class="hidden"></textarea>
    </div>

    <!-- 操作按钮 -->
    <div class="editor-actions">
      <button class="btn btn-outline" on:click={() => saveBlog(false)}>
        保存草稿
      </button>
      <button class="btn btn-primary" on:click={() => saveBlog(true)}>
        发布文章
      </button>
    </div>
  </div>
</div>

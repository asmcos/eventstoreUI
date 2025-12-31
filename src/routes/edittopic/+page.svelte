<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getKey } from "$lib/getkey";
  import { showNotification } from "$lib/message";
  import { create_topic } from "$lib/esclient";
  
  let Keypriv;
  let Keypub;
  let simplemde;
  let isLoading = false;
  let editorReady = false;

  // 话题数据
  let topicData = {
    title: "",
    content: "",
    labels: []
  };

  let inputLabel = "";
  let isSubmitting = false;

  // 标签颜色方案 - 统一为单一配色
  const unifiedLabelStyle = {
    bg: '#4f46e5',
    icon: 'fa-tag'
  };

  // 基础快捷标签
  const baseSuggestedLabels = [
    { text: "技术分享", color: "blue" },
    { text: "问题讨论", color: "purple" },
    { text: "经验求助", color: "orange" },
    { text: "资源分享", color: "green" },
    { text: "教程指导", color: "indigo" },
    { text: "行业新闻", color: "red" },
    { text: "观点交流", color: "teal" },
    { text: "学习笔记", color: "pink" }
  ];

  // 用户常用标签（从本地存储加载）
  let userSuggestedLabels = [];

  // 合并后的快捷标签（用户标签在前，最多8个，然后基础标签）
  let suggestedLabels = [];

  // 初始化用户常用标签
  function initUserLabels() {
    const savedUserLabels = localStorage.getItem('user-topic-labels');
    if (savedUserLabels) {
      try {
        userSuggestedLabels = JSON.parse(savedUserLabels);
        if (userSuggestedLabels.length > 8) {
          userSuggestedLabels = userSuggestedLabels.slice(0, 8);
          localStorage.setItem('user-topic-labels', JSON.stringify(userSuggestedLabels));
        }
      } catch (e) {
        console.error("加载用户标签失败:", e);
        userSuggestedLabels = [];
      }
    }
    updateSuggestedLabels();
  }

  // 更新合并后的快捷标签
  function updateSuggestedLabels() {
    suggestedLabels = [
      ...userSuggestedLabels.slice(0, 8),
      ...baseSuggestedLabels.filter(baseLabel => 
        !userSuggestedLabels.some(userLabel => userLabel.text === baseLabel.text)
      )
    ];
  }

  // 保存用户标签到本地（最多8个）
  function saveUserLabel(labelText) {
    const existingIndex = userSuggestedLabels.findIndex(l => l.text === labelText);
    
    if (existingIndex >= 0) {
      const existingLabel = userSuggestedLabels[existingIndex];
      userSuggestedLabels.splice(existingIndex, 1);
      userSuggestedLabels.unshift(existingLabel);
    } else {
      const newLabel = {
        text: labelText,
        color: getNextAvailableColor()
      };
      userSuggestedLabels.unshift(newLabel);
      
      if (userSuggestedLabels.length > 8) {
        userSuggestedLabels = userSuggestedLabels.slice(0, 8);
      }
    }
    
    localStorage.setItem('user-topic-labels', JSON.stringify(userSuggestedLabels));
    updateSuggestedLabels();
  }

  // 获取下一个可用的颜色
  function getNextAvailableColor() {
    const colors = ["blue", "purple", "orange", "green", "indigo", "red", "teal", "pink"];
    const colorCount = {};
    userSuggestedLabels.forEach(label => {
      colorCount[label.color] = (colorCount[label.color] || 0) + 1;
    });
    
    let minColor = colors[0];
    let minCount = colorCount[colors[0]] || 0;
    
    for (const color of colors) {
      const count = colorCount[color] || 0;
      if (count < minCount) {
        minColor = color;
        minCount = count;
      }
    }
    
    return minColor;
  }

  // 初始化编辑器
  function initEditor() {
    if (!window.SimpleMDE) return;

    simplemde = new SimpleMDE({
      element: document.getElementById("topic-content"),
      placeholder: "在这里写下你的想法...支持 Markdown 语法、图片上传和代码高亮",
      spellChecker: false,
      autosave: {
        enabled: true,
        uniqueId: `topic-${Date.now()}`,
        delay: 1000
      },
      toolbar: [
        {
          name: "bold",
          action: SimpleMDE.toggleBold,
          className: "fa fa-bold",
          title: "加粗"
        },
        {
          name: "italic",
          action: SimpleMDE.toggleItalic,
          className: "fa fa-italic",
          title: "斜体"
        },
        {
          name: "heading",
          action: SimpleMDE.toggleHeadingSmaller,
          className: "fa fa-heading",
          title: "标题"
        },
        "|",
        {
          name: "quote",
          action: SimpleMDE.toggleBlockquote,
          className: "fa fa-quote-left",
          title: "引用"
        },
        {
          name: "code",
          action: SimpleMDE.toggleCodeBlock,
          className: "fa fa-code",
          title: "代码块"
        },
        {
          name: "link",
          action: SimpleMDE.drawLink,
          className: "fa fa-link",
          title: "链接"
        },
        {
          name: "image",
          action: SimpleMDE.drawImage,
          className: "fa fa-image",
          title: "图片"
        },
        "|",
        {
          name: "unordered-list",
          action: SimpleMDE.toggleUnorderedList,
          className: "fa fa-list-ul",
          title: "无序列表"
        },
        {
          name: "ordered-list",
          action: SimpleMDE.toggleOrderedList,
          className: "fa fa-list-ol",
          title: "有序列表"
        },
        "|",
        "preview",
        "side-by-side",
        "fullscreen",
        "|",
        {
          name: "guide",
          action: () => window.open('https://www.markdownguide.org/', '_blank'),
          className: "fa fa-question-circle",
          title: "Markdown 指南"
        }
      ],
      status: ["autosave", "lines", "words"],
      forceSync: true,
      indentWithTabs: false,
      tabSize: 2,
      renderingConfig: {
        singleLineBreaks: false,
        codeSyntaxHighlighting: true
      }
    });

    const savedDraft = localStorage.getItem('topic-draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        topicData.title = draft.title || "";
        topicData.content = draft.content || "";
        topicData.labels = draft.labels || [];
        if (simplemde) {
          simplemde.value(topicData.content);
        }
      } catch (e) {
        console.error("恢复草稿失败:", e);
      }
    }

    simplemde.codemirror.on("change", () => {
      topicData.content = simplemde.value();
      saveDraft();
    });

    setTimeout(styleEditor, 150);
    editorReady = true;
  }

  // 美化编辑器样式
  function styleEditor() {
    const toolbar = document.querySelector('.editor-toolbar');
    if (toolbar) {
      toolbar.style.border = 'none';
      toolbar.style.padding = '14px 16px';
      toolbar.style.background = '#ffffff';
      toolbar.style.borderRadius = '12px 12px 0 0';
      toolbar.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    }

    const editor = document.querySelector('.CodeMirror');
    if (editor) {
      editor.style.border = '1px solid #e5e7eb';
      editor.style.borderTop = 'none';
      editor.style.borderRadius = '0 0 12px 12px';
      editor.style.fontSize = '15px';
      editor.style.lineHeight = '1.6';
    }

    const statusbar = document.querySelector('.editor-statusbar');
    if (statusbar) {
      statusbar.style.border = 'none';
      statusbar.style.padding = '10px 16px';
      statusbar.style.background = '#fafafa';
      statusbar.style.borderRadius = '0 0 12px 12px';
      statusbar.style.fontSize = '13px';
      statusbar.style.color = '#6b7280';
    }

    const buttons = document.querySelectorAll('.editor-toolbar button');
    buttons.forEach(btn => {
      btn.style.border = 'none';
      btn.style.padding = '6px 8px';
      btn.style.borderRadius = '6px';
      btn.style.margin = '0 2px';
      btn.style.transition = 'all 0.2s ease';
      
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f3f4f6';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });
    });
  }

  // 保存草稿
  function saveDraft() {
    const draft = {
      title: topicData.title,
      content: topicData.content,
      labels: topicData.labels,
      timestamp: Date.now()
    };
    localStorage.setItem('topic-draft', JSON.stringify(draft));
  }

  // 标签处理函数
  function addLabel() {
    const label = inputLabel.trim();
    if (!label) {
      showNotification("请输入标签内容", 1500, "warning");
      return;
    }
    
    if (label.length > 20) {
      showNotification("标签长度不能超过20个字符", 1500, "warning");
      return;
    }
    
    if (topicData.labels.length >= 5) {
      showNotification("最多添加 5 个标签", 1500, "warning");
      return;
    }
    
    if (topicData.labels.includes(label)) {
      showNotification("标签已存在", 1500, "warning");
      inputLabel = "";
      return;
    }
    
    topicData.labels = [...topicData.labels, label];
    inputLabel = "";
    saveDraft();
    saveUserLabel(label);
    
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  }

  function removeLabel(index) {
    topicData.labels = topicData.labels.filter((_, i) => i !== index);
    saveDraft();
  }

  function handleLabelKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addLabel();
    }
  }

  // 添加快捷标签
  function addSuggestedLabel(label) {
    if (topicData.labels.includes(label.text)) {
      showNotification("标签已存在", 1500, "warning");
      return;
    }
    
    if (topicData.labels.length >= 5) {
      showNotification("最多添加 5 个标签", 1500, "warning");
      return;
    }
    
    topicData.labels = [...topicData.labels, label.text];
    saveDraft();
    saveUserLabel(label.text);
  }

  // 清空草稿
  function clearDraft() {
    if (topicData.title || topicData.content || topicData.labels.length > 0) {
      if (confirm("确定要清空当前草稿吗？")) {
        localStorage.removeItem('topic-draft');
        topicData = { title: "", content: "", labels: [] };
        if (simplemde) simplemde.value("");
        inputLabel = "";
        showNotification("草稿已清空", 2000, "success");
      }
    } else {
      showNotification("当前没有草稿内容", 2000, "info");
    }
  }

  // 提交话题
  async function submitTopic() {
    if (!topicData.title.trim()) {
      showNotification("请输入话题标题", 2000, "warning");
      document.getElementById('topic-title').focus();
      return;
    }
    
    if (!topicData.content.trim()) {
      showNotification("请输入话题内容", 2000, "warning");
      if (simplemde) simplemde.codemirror.focus();
      return;
    }
    
    if (!Keypriv || !Keypub) {
      showNotification("请先登录", 2000, "warning");
      setTimeout(() => goto('/login'), 1500);
      return;
    }

    isSubmitting = true;
    try {
      const result = await new Promise((resolve, reject) => {
        create_topic(
          JSON.stringify({
            title: topicData.title.trim(),
            content: topicData.content.trim(),
            labels: topicData.labels
          }),
          Keypub,
          Keypriv,
          (response) => {
            console.log(response)
            if (response == "EOSE" || response.code > 300) {
              resolve({
                success: false,
                message: response.message || "发布失败"
              });
            }
            // 根据您的 create_topic 函数，成功时返回 code: 200
            if (response.code === 200) {
              resolve({
                success: true,
                topicId: response.id,
                message: "发布成功"
              });
            } 
          }
        );
      });


      if (result && result.success) {
        showNotification("🎉 话题发布成功", 3000, "success");
        localStorage.removeItem('topic-draft');
        setTimeout(() => {
          goto(  `/viewtopics` );
        }, 2000);
      } else {
        showNotification(result?.message || "发布失败，请重试", 3000, "error");
      }
    } catch (error) {
      console.error("发布话题错误：", error);
      showNotification("网络异常，请稍后重试", 3000, "error");
    } finally {
      isSubmitting = false;
    }
  }

  // 组件挂载
  onMount(() => {
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;
    
    if (!Keypriv) {
      showNotification("请先登录", 3000, "warning");
      setTimeout(() => goto('/login'), 2000);
      return;
    }

    initUserLabels();

    $: if (topicData.title) {
      saveDraft();
    }

    isLoading = true;
    const checkEditor = () => {
      if (window.SimpleMDE) {
        initEditor();
        isLoading = false;
      } else {
        setTimeout(checkEditor, 100);
      }
    };
    checkEditor();

    return () => {
      if (simplemde) {
        simplemde.toTextArea();
        simplemde = null;
      }
    };
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="/lib/simplemde/simplemde.min.css">
  <script src="/lib/simplemde/simplemde.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</svelte:head>

<style>
  :global(body) {
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    min-height: 100vh;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .main-container {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
  }

  .title-input {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid #e5e7eb;
    background: linear-gradient(white, white) padding-box,
                linear-gradient(135deg, transparent 0%, transparent 100%) border-box;
  }

  .title-input:hover {
    border-color: #9ca3af;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .title-input:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    outline: none;
    transform: translateY(-1px);
  }

  .label-chip {
    position: relative;
    overflow: hidden;
    animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    backdrop-filter: blur(10px);
    margin: 0 0.25rem 0.5rem 0;
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.5rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
  }

  .label-chip:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2);
  }

  .label-chip .delete-btn {
    width: 1rem;
    height: 1rem;
    font-size: 0.625rem;
  }

  .label-chip .tag-icon {
    font-size: 0.625rem;
    margin-right: 0.25rem;
  }

  .suggested-label {
    border: 1px solid rgba(229, 231, 235, 0.8);
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0.35rem 0.75rem !important;
    height: 32px;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 4px 8px 4px !important;
    font-size: 0.875rem !important;
    line-height: 1.2 !important;
  }

  .suggested-label:hover {
    transform: translateY(-1px);
    border-color: #6366f1;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
  }
  
  .suggested-label.blue { color: #2563eb; }
  .suggested-label.purple { color: #7c3aed; }
  .suggested-label.orange { color: #ea580c; }
  .suggested-label.green { color: #16a34a; }
  .suggested-label.indigo { color: #4f46e5; }
  .suggested-label.red { color: #dc2626; }
  .suggested-label.teal { color: #0d9488; }
  .suggested-label.pink { color: #db2777; }

  .suggested-labels-container {
    padding: 0 4px;
    display: flex;
    flex-wrap: wrap;
  }

  .label-input-container {
    background: rgba(249, 250, 251, 0.8);
    border: 1.5px dashed #d1d5db;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
    width: 280px;
    min-height: 2.5rem;
    display: flex;
    align-items: center;
  }

  .label-input-container:hover {
    border-color: #9ca3af;
    background: rgba(255, 255, 255, 0.95);
  }

  .label-input-container:focus-within {
    border-color: #6366f1;
    border-style: solid;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    transform: translateY(-1px);
  }

  .label-input {
    background: transparent;
    border: none;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    height: 100%;
    flex: 1;
  }

  .label-input:focus {
    outline: none;
    box-shadow: none;
  }

  .custom-label-input {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .selected-labels-container {
    flex: 1;
  }

  .editor-wrapper {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
    transition: all 0.3s ease;
    border: 1px solid rgba(229, 231, 235, 0.8);
  }

  .editor-wrapper:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
    border-color: #d1d5db;
  }

  .feature-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(249,250,251,0.9));
    border: 1px solid rgba(229, 231, 235, 0.6);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }

  .feature-card:hover {
    transform: translateY(-2px);
    border-color: #9ca3af;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .primary-btn {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
    position: relative;
    overflow: hidden;
  }

  .primary-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transition: left 0.7s;
  }

  .primary-btn:hover:not(:disabled)::before {
    left: 100%;
  }

  .primary-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
  }

  .primary-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .secondary-btn {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(229, 231, 235, 0.8);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }

  .secondary-btn:hover {
    background: rgba(249, 250, 251, 0.95);
    border-color: #9ca3af;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .guide-card {
    background: linear-gradient(135deg, rgba(239, 246, 255, 0.9), rgba(238, 242, 255, 0.9));
    border: 1px solid rgba(219, 234, 254, 0.8);
  }

  .spinner {
    border: 2px solid rgba(99, 102, 241, 0.2);
    border-top-color: #6366f1;
    animation: spin 0.8s linear infinite;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-20px) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  @media (max-width: 768px) {
    .main-container {
      margin: 0;
      border-radius: 0;
      border: none;
      box-shadow: none;
    }
    
    .editor-wrapper {
      margin: 0 -16px;
      border-radius: 0;
    }
    
    .custom-label-input {
      flex-direction: column;
      gap: 1rem;
    }
    
    .label-input-container {
      width: 100%;
    }
  }
</style>

<div class="min-h-screen p-4 md:p-6 lg:p-8">
  <div class="main-container max-w-4xl mx-auto rounded-[20px] overflow-hidden">
    <div class="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
    
    <div class="p-6 md:p-8 lg:p-10">
      <div class="flex items-center justify-between mb-10">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-indigo-500">
            <i class="fas fa-feather-alt mr-3 text-indigo-500"></i>
            发布新话题
          </h1>
        </div>
      </div>

      <div class="mb-10">
        <div class="flex items-center mb-4">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-100 to-indigo-100 flex items-center justify-center mr-3 border border-blue-200">
            <i class="fas fa-heading text-sm text-blue-600"></i>
          </div>
          <div>
            <label class="block text-base font-semibold text-gray-800">标题</label>
          </div>
        </div>
        
        <div class="relative">
          <input
            type="text"
            bind:value={topicData.title}
            maxlength="100"
            placeholder="输入标题..."
            class="title-input w-full px-4 py-3.5 text-base rounded-xl focus:outline-none focus:ring-0 placeholder-gray-400"
            id="topic-title"
          />
          <div class="absolute right-4 top-1/2 transform -translate-y-1/2">
            <span class="text-xs font-medium {topicData.title.length > 80 ? 'text-orange-500' : 'text-gray-400'}">
              {topicData.title.length}/100
            </span>
          </div>
        </div>
      </div>

      <div class="mb-10">
        <div class="flex items-center mb-5">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-100 to-pink-100 flex items-center justify-center mr-3 border border-purple-200">
            <i class="fas fa-tags text-sm text-purple-600"></i>
          </div>
          <div>
            <label class="block text-base font-semibold text-gray-800">标签</label>
            <span class="text-xs text-gray-500">为话题添加合适的标签，便于分类和搜索</span>
          </div>
        </div>

        <div class="custom-label-input">
          <div class="selected-labels-container mb-6">
            {#if topicData.labels.length > 0}
              <div class="flex flex-wrap gap-2 mb-4">
                {#each topicData.labels as label, index}
                  <div class="label-chip flex items-center text-white font-medium cursor-pointer transition-all duration-300 z-10"
                       style="background: {unifiedLabelStyle.bg}">
                    <i class="fas {unifiedLabelStyle.icon} tag-icon opacity-90"></i>
                    <span class="mr-2">{label}</span>
                    <button
                      on:click={() => removeLabel(index)}
                      class="delete-btn rounded-full bg-white/30 hover:bg-white/40 flex items-center justify-center transition-colors backdrop-blur-sm"
                      aria-label="删除标签"
                    >
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="mb-6 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 text-center">
                <i class="fas fa-tag text-gray-300 text-xl mb-2"></i>
                <p class="text-gray-500 text-xs">暂无标签，可在右侧添加</p>
              </div>
            {/if}

            <div class="flex justify-between items-center mb-6">
              <span class="text-sm text-gray-600">
                已添加 <span class="font-semibold text-indigo-600">{topicData.labels.length}</span>/5 个标签
              </span>
            </div>

            <div class="mb-7">
              <div class="flex items-center mb-3">
                <i class="fas fa-bolt text-xs text-yellow-500 mr-2"></i>
                <span class="text-sm font-medium text-gray-700">常用标签</span>
              </div>
              <div class="suggested-labels-container">
                {#each suggestedLabels as label}
                  {#if !topicData.labels.includes(label.text)}
                    <button
                      on:click={() => addSuggestedLabel(label)}
                      class="suggested-label {label.color} rounded-lg font-medium transition-all duration-300"
                    >
                      {label.text}
                    </button>
                  {/if}
                {/each}
              </div>
            </div>
          </div>

          <div class="custom-input-container">
            <div class="flex items-center mb-3">
              <i class="fas fa-pen text-xs text-green-500 mr-2"></i>
              <span class="text-sm font-medium text-gray-700">添加标签</span>
            </div>
            
            <div class="label-input-container rounded-xl p-1 transition-all duration-300">
              <div class="flex items-center px-2 w-full">
                <div class="w-8 h-8 flex items-center justify-center">
                  <i class="fas fa-plus text-gray-400 text-xs"></i>
                </div>
                <input
                  type="text"
                  bind:value={inputLabel}
                  on:keydown={handleLabelKeydown}
                  placeholder="输入标签，按回车添加"
                  class="label-input"
                  maxlength="20"
                />
                <button
                  on:click={addLabel}
                  disabled={!inputLabel.trim()}
                  class="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
                  title="添加标签"
                >
                  <i class="fas fa-check text-xs"></i>
                </button>
              </div>
            </div>
            
            <p class="text-xs text-gray-500 mt-2">
              标签建议使用 2-4 个汉字
            </p>
          </div>
        </div>
      </div>

      <div class="mb-10">
        <div class="flex items-center mb-5">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-100 to-teal-100 flex items-center justify-center mr-3 border border-emerald-200">
            <i class="fas fa-edit text-sm text-emerald-600"></i>
          </div>
          <div>
            <label class="block text-base font-semibold text-gray-800">话题内容</label>
            <span class="text-xs text-gray-500">详细描述你的想法，支持丰富的格式</span>
          </div>
        </div>

 
          <div class="editor-wrapper">
            <div class="p-1">
              <textarea
                id="topic-content"
                bind:value={topicData.content}
                class="hidden"
              ></textarea>
            </div>
          </div>
       
      </div>

      <div class="flex flex-col md:flex-row justify-between gap-4 pt-8 border-t border-gray-200">
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            on:click={clearDraft}
            class="secondary-btn px-5 py-3 rounded-xl text-sm font-medium flex items-center justify-center transition-all duration-300"
          >
            <i class="fas fa-trash-alt text-gray-500 mr-2 text-sm"></i>
            清空草稿
          </button>
          <button
            on:click={() => goto('/topics')}
            class="secondary-btn px-5 py-3 rounded-xl text-sm font-medium flex items-center justify-center transition-all duration-300"
          >
            <i class="fas fa-arrow-left text-gray-500 mr-2 text-sm"></i>
            返回列表
          </button>
        </div>

        <button
          on:click={submitTopic}
          disabled={isSubmitting || !topicData.title.trim() || !topicData.content.trim()}
          class="primary-btn px-6 py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px] transition-all duration-300"
        >
          {#if isSubmitting}
            <div class="spinner w-4 h-4 rounded-full mr-2"></div>
            发布中...
          {:else}
            <i class="fas fa-paper-plane mr-2 text-sm"></i>
            发布话题
          {/if}
        </button>
      </div>

      <div class="mt-8 p-4 rounded-xl guide-card">
        <div class="flex items-start">
          <i class="fas fa-info-circle text-indigo-500 mt-0.5 mr-3 text-sm"></i>
          <div class="text-sm">
            <p class="font-medium text-gray-800 mb-1">发布小贴士</p>
            <ul class="space-y-1 text-gray-600">
              <li class="flex items-start">
                <i class="fas fa-check text-green-500 mr-2 mt-0.5 text-xs"></i>
                <span>确保内容清晰明了，便于他人理解</span>
              </li>
              <li class="flex items-start">
                <i class="fas fa-check text-green-500 mr-2 mt-0.5 text-xs"></i>
                <span>使用合适的标签，提高话题可见性</span>
              </li>
              <li class="flex items-start">
                <i class="fas fa-check text-green-500 mr-2 mt-0.5 text-xs"></i>
                <span>内容将自动保存，不用担心丢失</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if isSubmitting}
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm transition-all duration-300">
      <div class="bg-white rounded-2xl p-6 max-w-sm mx-4 text-center animate-float">
        <div class="w-12 h-12 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <i class="fas fa-paper-plane text-xl text-white"></i>
        </div>
        <h3 class="text-lg font-bold text-gray-800 mb-2">正在发布</h3>
        <p class="text-gray-600 text-sm">请稍候，我们正在处理你的话题...</p>
        <div class="mt-4 flex justify-center">
          <div class="spinner w-6 h-6"></div>
        </div>
      </div>
    </div>
  {/if}
</div>
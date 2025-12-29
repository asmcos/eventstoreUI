<script>
  import { onMount } from 'svelte';
  import NestedTree from '$lib/NestedTree.svelte';
  import "$lib/editbook.css";
  
  import {
    get_user_by_email,
    get_user_by_pubkeys,
    upload_file,
    create_book,
    update_book,
    create_chapter,
    get_book_id,
    get_chapter_update_logs,
    get_event,
    get_chapter
  } from "$lib/esclient";
  import { epubDecode } from "eventstore-tools/src/key";
  import { getKey } from "$lib/getkey";
  import { uploadpath } from "$lib/config";

  // 用户认证
  let Keypriv, Keypub;
  
  // 书籍信息
  let bookId = "";
  let bookLabels = [];
  let coAuthors = [];
  
  // 大纲相关
  let initialOutline = [
    { id: 1, title: "前言", type: "chapter" },
    { id: 2, title: "第一部分：基础知识", type: "folder", expanded: true, children: [] }
  ];
  let globalClickId = null;
  let nextId = 3;
  let draggedItem = null;
  let dragOverItem = null;
  let dragOverPosition = null;
  
  // 编辑相关
  let currentEditId = null;
  let currentChapterTitle = "";
  let isUnsaved = false;
  let simplemde = null;
  
  // 模态框状态
  let showRawOutlineModal = false;
  let showConfirmModal = false;
  let showSavedModal = false;
  let rawOutlineContent = '';
  let jsonFormatError = '';
  let confirmMessage = "";
  let confirmCallback = "";
  let savedMessage = "";
  let savedCallback = "";
  
  // 更新日志相关
  let updateLogs = [];
  let updateLogsLoading = false;
  let userEmailCache = new Map();
  let viewingHistoryChapter = null;
  let historyContent = "";
  
  // UI 状态 - 使用 display 控制显示
  let showOutline = false; // 控制大纲显示
  let showEditor = false; // 控制编辑器显示
  let showUpdateLogs = true; // 默认显示更新日志
  let showAddCoAuthorInput = false;
  let showAddTagInput = false;
  let newCoAuthor = "";
  let newTagName = "";
  let codeMirrorEditor = null;

  // 工具函数
  function getTagValue(tags, t) {
    const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
    return dTag ? dTag[1] : null;
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function isValidPubKey(pubKey) {
    if (pubKey.startsWith('epub1')) return epubDecode(pubKey);
    if (/^[0-9a-fA-F]{64}$/.test(pubKey)) return pubKey;
    return false;
  }

  function shortenPubkey(pubkey) {
    if (!pubkey) return "未知用户";
    return pubkey.length <= 16 ? pubkey : pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
  }

  async function getUserEmail(pubkey, callback) {
    if (userEmailCache.has(pubkey)) {
      callback(userEmailCache.get(pubkey));
      return;
    }
    
    await get_user_by_pubkeys([pubkey], function(user) {
      if (user == "EOSE") return;
      if (user.email) {
        userEmailCache.set(pubkey, user.email);
        callback(user.email);
      } else {
        callback(shortenPubkey(pubkey));
      }
    });
  }

  // 通知系统
  let showing = false;
  function showNotification(message, type = 'success') {
    if (showing) return;
    showing = true;
    
    const notification = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-amber-500' : 'bg-primary';
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.remove('translate-x-full'), 100);
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => document.body.removeChild(notification), 300);
      showing = false;
    }, 3000);
  }

  // 模态框处理
  function handleConfirm(confirmed) { confirmCallback(confirmed); }
  function handleSavedConfirm(confirmed) { savedCallback(confirmed); }

  // 显示控制函数
  function showUpdateLogsView() {
    showUpdateLogs = true;
    showOutline = false;
    showEditor = false;
  }

  function showOutlineView() {
    showUpdateLogs = false;
    showOutline = true;
    showEditor = false;
  }

  function showEditorView() {
    showUpdateLogs = false;
    showOutline = false;
    showEditor = true;
  }

  function handleChapterSelect(item) {
    currentEditId = item.id;
    currentChapterTitle = item.title;
    showEditorView();

    if (simplemde) simplemde.value("");
    isUnsaved = false;
    
    get_chapter(bookId, item.id, function(message) {
      if (message != "EOSE" && simplemde) {
        simplemde.value(message.data);
        isUnsaved = false;
      }
    });
  }

  // 大纲操作
  function addFolder() {
    const newFolder = {
      id: nextId++,
      title: "新建文件夹",
      type: "folder",
      expanded: true,
      children: []
    };
    initialOutline = [...initialOutline, newFolder];
  }

  function addChapter() {
    const newChapter = {
      id: nextId++,
      title: "新建章节",
      type: "chapter"
    };
    initialOutline = [...initialOutline, newChapter];
  }

  function findItemById(items, id) {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function findItemParentAndIndex(items, id, parent = null) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === id) return { parent: parent || items, index: i };
      if (items[i].children) {
        const result = findItemParentAndIndex(items[i].children, id, items[i].children);
        if (result.index !== -1) return result;
      }
    }
    return { parent: null, index: -1 };
  }

  function handleDragEnd(draggedItem, targetItem, position) {
    const updatedOutline = JSON.parse(JSON.stringify(initialOutline));
    const { parent: draggedParent, index: draggedIndex } = findItemParentAndIndex(updatedOutline, draggedItem.id);
    const [removedItem] = draggedParent.splice(draggedIndex, 1);
    const { parent: targetParent, index: targetIndex } = findItemParentAndIndex(updatedOutline, targetItem.id);

    if (!draggedParent || draggedIndex === -1 || !targetParent) return;

    if (position === 'inside' && targetItem.type === 'folder') {
      const targetFolder = findItemById(updatedOutline, targetItem.id);
      if (targetFolder) {
        if (!targetFolder.children) targetFolder.children = [];
        targetFolder.children.push(removedItem);
        targetFolder.expanded = true;
      }
    } else {
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      targetParent.splice(insertIndex, 0, removedItem);
    }
    
    initialOutline = updatedOutline;
  }

  // 更新日志功能
  function formatTimestamp(timestamp) {
    if (!timestamp) return "未知时间";
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    
    return date.toLocaleDateString('zh-CN');
  }

  function shortenEventId(eventId) {
    return eventId ? eventId.substring(0, 8) + "..." : "";
  }

  function findChapter(id, items = initialOutline) {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findChapter(id, item.children);
        if (found) return found;
      }
    }
    return null;
  }

  async function fetchUpdateLogs() {
    if (!bookId) {
      showNotification("请先完善书籍信息!", "warning");
      return;
    }
    
    updateLogsLoading = true;
    updateLogs = [];
    
    await get_chapter_update_logs(bookId, 0, 50, async function(message) {
      if (message === "EOSE") {
        updateLogsLoading = false;
        return;
      }
      
      try {
        let c_name = getTagValue(message.tags, 'n');
        let c_item = findChapter(c_name);
        
        const logEntry = {
          chapterId: c_name,
          chapterTitle: c_item ? c_item.title : c_name,
          timestamp: message.created_at,
          content: message.data,
          eventId: message.id,
          chapterEventid:message.data.chapterEventid,
          author: message.user,
          authorEmail: "加载中..."
        };
        
        updateLogs = [...updateLogs, logEntry];
        
        await getUserEmail(message.user, (email) => {
          updateLogs = updateLogs.map(log => 
            log.eventId === message.id ? { ...log, authorEmail: email } : log
          );
        });
      } catch (error) {
        console.error("处理更新日志时出错:", error);
        updateLogsLoading = false;
      }
    });
  }

  function approveContent(){
    if(viewingHistoryChapter.chapterId === "outline.md"){
      submitOutline()
    } else {
      saveCurrentChapter();
    }

  }
  async function loadHistoryChapter(logEvent) {
    if (!bookId) return;
    
    // 根据章节ID决定显示什么
    if (logEvent.chapterId === "outline.md") {
      // 显示大纲
      viewingHistoryChapter = logEvent;

      showOutlineView();
      let showLogs = 1;
      get_event(logEvent.chapterEventid,showLogs,function(message){
          if (message == "EOSE") return ;

          try {
            initialOutline = JSON.parse(message.data);
            nextId = Math.max(...initialOutline.flatMap(item => 
              [item.id, ...(item.children || []).map(child => child.id)]
            )) + 1;
          } catch (e) {
            console.error("解析大纲失败:", e);
          }

      })

    } else {
      // 显示编辑器
      viewingHistoryChapter = logEvent;
      showEditorView();

      let showLogs = 1;

      get_event(logEvent.chapterEventid,showLogs,function(message){
          if (message == "EOSE") return ;
          
          historyContent = message.data;
          if (simplemde) {
            simplemde.value(historyContent);
          }
          
          currentEditId = logEvent.chapterId;
          currentChapterTitle = logEvent.chapterTitle ;
          isUnsaved = false;
          

      })

    }
  }

  function mergeHistoryContent() {
    if (!viewingHistoryChapter || !simplemde) return;
    
    const currentContent = simplemde.value();
    const mergedContent = currentContent + "\n\n---\n\n## 合并的历史内容\n\n" + historyContent;
    simplemde.value(mergedContent);
    isUnsaved = true;
    
    showNotification("历史内容已合并到当前编辑器中");
    exitHistoryView();
  }

  function exitHistoryView() {
    viewingHistoryChapter = null;
    historyContent = "";
    
    if (simplemde) simplemde.value("");
    currentEditId = null;
    currentChapterTitle = "";
    
    showNotification("已退出历史版本查看");
    showUpdateLogsView();
  }

  async function handleSetClickId(item) {
    if (globalClickId == item.id) return true;

    if (isUnsaved) {
      const userChoice = await new Promise((resolve) => {
        savedMessage = `内容已经改变是否保存？\n`;
        showSavedModal = true;
        savedCallback = function(result){
          resolve(result);
        }
      });
      savedMessage = "";
      showSavedModal = false;

      switch (userChoice) {
        case 1: // 取消操作：不切换章节
          return false; 
        case 2: // 不保存：直接切换章节（放弃未保存内容）
          if (simplemde) simplemde.value("");
          isUnsaved = false;
          break; 
        case 3: // 保存：先执行保存（异步操作），再切换章节
          await saveCurrentChapter();
          break;
      }
    }
    globalClickId = item.id;
    
    return true;
  }
 
  // 回调函数：更新拖动项
  function setDraggedItem(item) {
    draggedItem = item;
  }

  // 回调函数：更新拖动位置状态
  function setDragOverState(overItem, position) {
    dragOverItem = overItem;
    dragOverPosition = position;
  }
   
  // 保存功能
  function saveCurrentChapter() {
    if (currentEditId == null) {
      showNotification("请先选择要编辑的章节");
      return;
    }

    if (!simplemde) {
      showNotification("编辑器未初始化", "error");
      return;
    }

    create_chapter(bookId, simplemde.value(), currentEditId, Keypub, Keypriv, function(message) {
      if (message.code == 200) {
        isUnsaved = false;
        showNotification("内容保存成功");
        // 刷新更新日志
        fetchUpdateLogs();
      } else {
        showNotification("保存失败", "error");
      }
    });
  }

  function handleRename(item) {
    const newTitle = prompt('请输入新名称', item.title);
    if (!newTitle || newTitle.trim() === '') return;

    const updatedOutline = JSON.parse(JSON.stringify(initialOutline));
    const itemToUpdate = findItemById(updatedOutline, item.id);
    if (itemToUpdate) {
      itemToUpdate.title = newTitle.trim();
      initialOutline = updatedOutline;
    }
  }

  // 删除章节/文件夹
  function handleDelete(item) {
    if (!confirm(`确定要删除"${item.title}"吗？`)) return;

    const updatedOutline = JSON.parse(JSON.stringify(initialOutline));
    const { parent, index } = findItemParentAndIndex(updatedOutline, item.id);
    if (parent && index !== -1) {
      parent.splice(index, 1);
      initialOutline = updatedOutline;

      // 如果删除的是当前编辑项，重置编辑器
      if (globalClickId === item.id) {
        globalClickId = null;
        currentChapterTitle = "";
        if (simplemde) simplemde.value('');
      }
    }
  }
  
  function getBookId() {
    const url = new URL(window.location.href);
    return url.searchParams.get('bookid');
  }

  // 打开原始大纲编辑模态框
  function openRawOutlineEditor() {
    try {
      rawOutlineContent = JSON.stringify(initialOutline, null, 2);
      jsonFormatError = '';
      showRawOutlineModal = true;
      
      setTimeout(initCodeMirrorEditor, 100);
    } catch (error) {
      jsonFormatError = '无法加载大纲数据: ' + error.message;
      showRawOutlineModal = true;
    }
  }

  // 初始化CodeMirror编辑器
  function initCodeMirrorEditor() {
    const textarea = document.getElementById('json-editor');
    if (!textarea || codeMirrorEditor) return;

    codeMirrorEditor = CodeMirror.fromTextArea(textarea, {
      lineNumbers: true,
      mode: 'application/json',
      indentUnit: 2,
      indentWithTabs: false,
      lineWrapping: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      theme: 'default',
      viewportMargin: Infinity
    });

    codeMirrorEditor.setValue(rawOutlineContent);
    
    codeMirrorEditor.on('change', () => {
      rawOutlineContent = codeMirrorEditor.getValue();
    });
  }

  // 销毁CodeMirror编辑器实例
  function destroyCodeMirrorEditor() {
    if (codeMirrorEditor) {
      codeMirrorEditor.toTextArea();
      codeMirrorEditor = null;
    }
  }

  // 验证并应用原始大纲修改
  function applyRawOutlineChanges() {
    try {
      const content = codeMirrorEditor ? codeMirrorEditor.getValue() : rawOutlineContent;
      const parsed = JSON.parse(content);
      
      if (!Array.isArray(parsed)) {
        throw new Error('大纲必须是数组格式');
      }
      
      parsed.forEach(item => {
        if (!item.id || !item.title || !item.type) {
          throw new Error(`项目 "${item.title || '未知项目'}" 缺少必要字段(id/title/type)`);
        }
        if (item.type === 'folder' && item.children && !Array.isArray(item.children)) {
          throw new Error(`文件夹 "${item.title}" 的children必须是数组`);
        }
      });
      
      initialOutline = parsed;
      nextId = Math.max(...initialOutline.flatMap(item => [item.id, ...(item.children || []).map(child => child.id)])) + 1;
      jsonFormatError = '';
      showRawOutlineModal = false;
      destroyCodeMirrorEditor();
      
      showNotification('大纲已更新');
    } catch (error) {
      jsonFormatError = '格式错误: ' + error.message;
      if (error.message.includes('at position')) {
        const positionMatch = error.message.match(/at position (\d+)/);
        if (positionMatch && positionMatch[1]) {
          const pos = parseInt(positionMatch[1]);
          if (codeMirrorEditor) {
            const doc = codeMirrorEditor.getDoc();
            const line = doc.posFromIndex(pos).line + 1;
            jsonFormatError += `，大约在第 ${line} 行`;
          }
        }
      }
      setTimeout(() => {
        document.querySelector('.error-message')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  // 导出大纲为JSON文件
  function submitOutline() {
    try {
      if (!bookId){
        showNotification("请先完善书籍信息!");
        return;
      }
      
      const dataStr = JSON.stringify(initialOutline, null, 2);
      create_chapter(bookId, dataStr, "outline.md", Keypub, Keypriv, function(message) {
        if (message.code == 200) {
          showNotification("大纲上传成功");
        } else {
          showNotification("大纲上传失败", "error");
        }
      });
    } catch (error) {
      showNotification('导出失败: ' + error.message, 'error');
    }
  }

  // 初始化 SimpleMDE 编辑器
  function initSimpleMDE() {
    const editorElement = document.getElementById('editor');
    
    if (!editorElement) return null;

    const insertImageButton = {
      name: 'insertImage',
      action: function(editor) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async (event) => {
          const file = event.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
              const arrayBuffer = e.target.result;
              const uint8Array = new Uint8Array(arrayBuffer);
              
              upload_file(file.name, uint8Array, Keypub, Keypriv, function(message) {
                if (message[2].code == 200) {
                  let url = message[2].fileUrl;
                  const cm = editor.codemirror;
                  const cursor = cm.getCursor();
                  const imageMarkdown = `![图片](${uploadpath + url})\n`;
                  cm.replaceRange(imageMarkdown, cursor);
                  cm.setCursor(cursor.line + 1, 0);
                }
              });
            };
            reader.readAsArrayBuffer(file);
          }
        });
        input.click();
      },
      className: 'fa fa-image',
      title: '上传图片'
    };

    const simplemde = new SimpleMDE({ 
      element: editorElement,
      spellChecker: false,
      status: false,
      toolbar: [
        "bold", "italic", "heading", "|", 
        "code", "quote", "unordered-list", "ordered-list", "|", 
        "link", insertImageButton, "|",
        "preview", "side-by-side", "fullscreen", "|", 
        "guide"
      ],
      autosave: {
        enabled: false
      },
      autosize: false,
    });
    
    const cmElement = simplemde.codemirror.getWrapperElement();
    if (cmElement) {
      cmElement.style.minHeight = '400px';
    }
    
    simplemde.codemirror.on("change", function() {
      if (currentEditId !== null) {
        isUnsaved = true;
      }
    });
    
    return simplemde;
  }

  // 初始化
  onMount(async () => {
    // 加载用户密钥
    let Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;
    
    if (!Keypriv) {
      showNotification("请先登录", "warning");
      return;
    }
    
    // 获取书籍ID
    bookId = getBookId();
    if (bookId) {
      // 加载大纲
      await get_chapter(bookId, "outline.md", function(message) {
        if (message != "EOSE") {
          try {
            initialOutline = JSON.parse(message.data);
            nextId = Math.max(...initialOutline.flatMap(item => 
              [item.id, ...(item.children || []).map(child => child.id)]
            )) + 1;
          } catch (e) {
            console.error("解析大纲失败:", e);
          }
        }
      });
      
      // 加载更新日志
      fetchUpdateLogs();
    }

    // 加载 CodeMirror 库
    await Promise.all([
      new Promise(resolve => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css';
        link.onload = resolve;
        document.head.appendChild(link);
      }),
      new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js';
        script.onload = resolve;
        document.body.appendChild(script);
      }),
      new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/javascript/javascript.min.js';
        script.onload = resolve;
        document.body.appendChild(script);
      })
    ]);

    // 加载 SimpleMDE
    if (typeof SimpleMDE === 'undefined') {
      await new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/simplemde@1.11.2/dist/simplemde.min.css';
        document.head.appendChild(link);
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/simplemde@1.11.2/dist/simplemde.min.js';
        script.onload = resolve;
        document.body.appendChild(script);
      });
    }
    
    // 初始化编辑器
    simplemde = initSimpleMDE();
  });

  // 当模态框关闭时销毁编辑器
  $: if (!showRawOutlineModal && codeMirrorEditor) {
    destroyCodeMirrorEditor();
  }
</script>

<style>
  :global {
    /* 更新日志相关样式 */
    .update-log-item {
      transition: all 0.2s ease;
      border-left: 3px solid transparent;
      cursor: pointer;
    }
    
    .update-log-item:hover {
      border-left-color: #6366f1;
      background-color: #f8fafc;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .update-log-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: #6b7280;
    }
    
    .update-log-loading {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }
    
    .chapter-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.5rem;
      background-color: #eef2ff;
      color: #4f46e5;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
    }
    
    .timestamp-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.5rem;
      background-color: #f3f4f6;
      color: #6b7280;
      border-radius: 0.375rem;
      font-size: 0.75rem;
    }
    
    .author-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.5rem;
      background-color: #f0f9ff;
      color: #0369a1;
      border-radius: 0.375rem;
      font-size: 0.75rem;
    }
    
    .history-view-banner {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }
    
    .merge-button {
      background-color: #10b981;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .merge-button:hover {
      background-color: #059669;
    }
    
    .exit-history-button {
      background-color: #6b7280;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .exit-history-button:hover {
      background-color: #4b5563;
    }

    /* SimpleMDE 自定义样式 */
    .editor-wrapper .CodeMirror {
      height: 500px;
      min-height: 400px;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
    }
    
    .editor-wrapper .editor-toolbar {
      border: 1px solid #e5e7eb;
      border-bottom: none;
      border-radius: 0.5rem 0.5rem 0 0;
      padding: 0.5rem;
    }
    
    .editor-statusbar {
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 0.5rem 0.5rem;
    }

    /* 模态框样式 */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 800px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: between;
      align-items: center;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
    }

    .modal-body {
      padding: 1rem;
      flex: 1;
      overflow: auto;
    }

    .modal-footer {
      padding: 1rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .json-editor-container {
      height: 400px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }

    .error-message {
      color: #e53e3e;
      background-color: #fed7d7;
      padding: 0.5rem;
      border-radius: 4px;
      margin-top: 0.5rem;
    }

    /* 导航按钮样式 */
    .nav-button {
      background-color: #4f46e5;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .nav-button:hover {
      background-color: #4338ca;
    }
  }
</style>

<svelte:head>
  <title>RISCVBooks - 历史操作记录</title>
</svelte:head>

<main class="flex-grow flex flex-col max-w-7xl mx-auto px-4 py-6 w-full">
  <!-- 顶部导航 -->
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-gray-800 flex items-center">
      <i class="fa fa-book mr-3 text-primary"></i>
      书籍创作编辑器
    </h1>
    <div class="flex gap-2">
      <a href="/editbook?bookid={bookId}" class="rounded   flex items-center bg-blue-500 hover:bg-blue-700 text-white  py-2 px-4  ">
          <i class="fa fa-arrow-left mr-2"></i>
          返回
      </a>
      <button class="nav-button flex items-center" on:click={showUpdateLogsView}>
        <i class="fa fa-history mr-2"></i>
        更新日志
      </button>
    </div>
  </div>

        <!-- 历史版本查看横幅 -->
      {#if viewingHistoryChapter}
        <div class="history-view-banner">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-lg font-bold flex items-center">
                <i class="fa fa-history mr-2"></i>
                正在查看历史版本
              </h3>
              <p class="text-sm opacity-90 mt-1">
                章节: {viewingHistoryChapter.chapterTitle} | 
                更新时间: {formatTimestamp(viewingHistoryChapter.timestamp)} | 
                作者: {viewingHistoryChapter.authorEmail}
              </p>
            </div>
            <div class="flex gap-2">
              <button class="merge-button flex items-center" on:click={approveContent}>
                <i class="fa fa-code-fork mr-2"></i>
                确认提交
              </button>
              <button class="exit-history-button flex items-center" on:click={exitHistoryView}>
                <i class="fa fa-times mr-2"></i>
                退出历史查看
              </button>
            </div>
          </div>
        </div>
      {/if}

  <div class="seamless-container flex-grow">
    <!-- 左侧面板 - 大纲管理区 -->
    <div class="left-seamless flex flex-col w-80 bg-white rounded-lg shadow-sm border border-gray-200" style:display={showOutline ? 'flex' : 'none'}>
      <!-- 书籍大纲 -->
      <div class="flex-grow p-4 overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-md font-semibold text-gray-700 flex items-center">
            <i class="fa fa-sitemap mr-2"></i>书籍大纲
          </h3>
        </div>
        
        <!-- 大纲操作按钮 -->
        <div class="flex flex-wrap gap-2 mb-4">
          <button 
            class="btn btn-secondary flex items-center text-xs py-2 px-3"
            on:click={openRawOutlineEditor}
          >
            <i class="fa fa-code mr-1"></i>编辑大纲
          </button>
          <button 
            class="btn btn-primary flex items-center text-xs py-2 px-3"
            on:click={submitOutline}
          >
            <i class="fa fa-arrow-up mr-1"></i>上传
          </button>
          <button id="addFolder" class="folder-bg text-white rounded-lg w-8 h-8 flex items-center justify-center transition btn-hover text-xs" on:click={addFolder}>
            <i class="fas fa-folder-plus"></i>
          </button>
          <button id="addChapter" class="bg-primary hover:bg-indigo-700 text-white rounded-lg w-8 h-8 flex items-center justify-center transition btn-hover text-xs" on:click={addChapter}>
            <i class="fas fa-file-circle-plus"></i>
          </button>
        </div>
        
        <NestedTree 
          items={initialOutline}     
          onSetClickId={handleSetClickId}
          clickId={globalClickId}        
          onSelect={handleChapterSelect}
          draggedItem={draggedItem} 
          dragOverItem={dragOverItem}  
          dragOverPosition={dragOverPosition}
          onSetDraggedItem={setDraggedItem} 
          onSetDragOver={setDragOverState} 
          onDragEnd={handleDragEnd}
          onRename={handleRename}   
          onDelete={handleDelete}   
        />
      </div>
    </div>
    
    <!-- 分隔线 -->
    <div class="w-0.5 bg-gray-200 cursor-col-resize hover:bg-gray-300" style:display={showOutline ? 'block' : 'none'}></div>

    <!-- 右侧面板 - 内容显示区域 -->
    <div class="right-seamless flex flex-col flex-1">


      <!-- 章节编辑头部 -->
      <div class="editor-header" style:display={showEditor ? 'block' : 'none'}>
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-xl font-semibold flex items-center">
              <i class="fa fa-edit mr-2"></i>内容编辑
            </h2>
            <h3  class="text-lg font-medium mt-1">{currentChapterTitle? "当前章节: "+currentChapterTitle:"选择大纲项进行编辑"}</h3>
          </div>
 
        </div>
      </div>

      <!-- 编辑器区域 -->
      <div class="flex-grow flex flex-col editor-wrapper" style:display={showEditor ? 'block' : 'none'}>
        <div class="bg-gray-50 p-3 flex items-center justify-between border-b">
          <div class="flex items-center gap-4">
            <span class="text-sm text-gray-600 flex items-center">
              <i class="fa fa-file-text mr-1"></i> 
              {#if simplemde}
                {simplemde.value().length} 字
              {:else}
                0 字
              {/if}
            </span>
            <span class="text-sm text-gray-600 flex items-center">
              <i class="fa fa-clock-o mr-1"></i> 
              {#if simplemde}
                {Math.ceil(simplemde.value().length / 400)} 分钟阅读
              {:else}
                0 分钟阅读
              {/if}
            </span>
          </div>
          <span class="text-sm {isUnsaved ? 'text-orange-600' : 'text-gray-600'}">
            {isUnsaved ? '尚未保存' : '已保存'}
          </span>
        </div>
        
        <!-- SimpleMDE 编辑器 -->
        <div class="flex-grow p-4">
          <textarea id="editor"></textarea>
        </div>
      </div>

      <!-- 更新日志面板 -->
      <div class="content-panel flex-grow bg-white rounded-lg shadow overflow-y-auto" style:display={showUpdateLogs ? 'block' : 'none'}>
        <div class="p-6">
          <div class="max-w-4xl mx-auto">
            <div class="mb-6">
              <h2 class="text-2xl font-bold text-gray-800 flex items-center">
                <i class="fa fa-history mr-3 text-primary"></i>
                更新日志
              </h2>
              <p class="text-gray-600 mt-2">查看书籍章节的更新历史记录</p>
            </div>
            
            <!-- 操作栏 -->
            <div class="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg">
              <div class="text-sm text-gray-600">
                {#if updateLogsLoading}
                  正在加载更新日志...
                {:else if updateLogs.length > 0}
                  共 {updateLogs.length} 条更新记录
                {:else}
                  暂无更新记录
                {/if}
              </div>
              <button class="btn btn-primary flex items-center text-sm py-2 px-4" on:click={fetchUpdateLogs} disabled={updateLogsLoading}>
                <i class="fa fa-refresh mr-2 {updateLogsLoading ? 'animate-spin' : ''}"></i>
                {updateLogsLoading ? '加载中...' : '刷新'}
              </button>
            </div>
            
            <!-- 更新日志列表 -->
            <div class="space-y-4">
              {#if updateLogsLoading}
                <div class="update-log-loading">
                  <i class="fa fa-spinner fa-spin text-2xl mb-2"></i>
                  <p>正在加载更新日志...</p>
                </div>
              {:else if updateLogs.length === 0}
                <div class="update-log-empty">
                  <i class="fa fa-inbox text-4xl mb-4 opacity-50"></i>
                  <h3 class="text-lg font-medium mb-2">暂无更新记录</h3>
                  <p class="text-gray-500">当您对章节进行修改并保存后，更新记录将显示在这里。</p>
                </div>
              {:else}
                {#each updateLogs as log}
                  <div class="update-log-item bg-white border border-gray-200 rounded-lg p-4 shadow-sm" 
                       on:click={() => loadHistoryChapter(log)}>
                    <div class="flex justify-between items-start mb-3">
                      <div class="flex items-center gap-2">
                        <span class="chapter-badge">
                          <i class="fa fa-file-text mr-1"></i>
                          {log.chapterTitle}
                        </span>
                      </div>
                      <span class="timestamp-badge">
                        <i class="fa fa-clock-o mr-1"></i>
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                      <div class="flex items-center">
                        <i class="fa fa-user mr-2 text-gray-400"></i>
                        <span class="author-badge">
                          {log.authorEmail}
                        </span>
                      </div>
                      <div class="flex items-center">
                        <i class="fa fa-hashtag mr-2 text-gray-400"></i>
                        章节: {log.chapterId}
                      </div>
                      <div class="flex items-center">
                        <i class="fa fa-fingerprint mr-2 text-gray-400"></i>
                        事件: {shortenEventId(log.eventId)}
                      </div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>

<!-- 原始大纲编辑模态框 -->
{#if showRawOutlineModal}
  <div class="modal-overlay" on:click={() => showRawOutlineModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3 class="modal-title">编辑原始大纲 (JSON格式)</h3>
        <button class="modal-close" on:click={() => showRawOutlineModal = false}>&times;</button>
      </div>
      <div class="modal-body">
        <p class="text-sm text-gray-500 mb-3">
          您可以直接编辑大纲的JSON结构。编辑器已提供行号、语法高亮和括号匹配功能。
        </p>
        <!-- 隐藏的文本框，用于CodeMirror绑定 -->
        <textarea id="json-editor" class="hidden" bind:value={rawOutlineContent}></textarea>
        <!-- CodeMirror将在这里渲染 -->
        <div class="json-editor-container"></div>
        
        {#if jsonFormatError}
          <div class="error-message">{jsonFormatError}</div>
        {/if}
        <p class="text-xs text-gray-400 mt-3">
          提示：每个项目需包含id、title和type字段；文件夹类型(folder)可包含children数组。
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => showRawOutlineModal = false}>取消</button>
        <button class="btn btn-primary" on:click={applyRawOutlineChanges}>应用更改</button>
      </div>
    </div>
  </div>
{/if}

<!-- 保存确认模态框 -->
{#if showSavedModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
      <h3 class="text-xl font-bold mb-4 text-primary">提示</h3>
      <p class="text-gray-700 mb-6">{savedMessage}</p>
      <div class="flex justify-end gap-3">
        <button 
          class="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded hover:bg-gray-50 transition"
          on:click={() => handleSavedConfirm(1)}
        >
          取消
        </button>
        <button 
          class="px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded hover:bg-orange-100 transition"
          on:click={() => handleSavedConfirm(2)}
        >
          不保存
        </button>
        <button 
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          on:click={() => handleSavedConfirm(3)}
        >
          保存
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 页脚 -->
<footer class="bg-white border-t border-gray-200 py-4 mt-8">
  <div class="max-w-7xl mx-auto px-4">
    <div class="flex flex-col md:flex-row justify-between items-center">
      <div class="text-center md:text-left mb-3 md:mb-0">
        <p class="text-sm text-gray-500">© 2025 书籍创作编辑器专业版</p>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-500">章节数: {initialOutline.filter(item => item.type === 'chapter').length}</span>
        <span class="text-sm text-gray-500">更新记录: {updateLogs.length}</span>
      </div>
    </div>
  </div>
</footer>

<script>
  import { onMount } from 'svelte';
 
  import {create_user,get_events,
    get_users,
    get_permissions,
    add_permission,
    delete_user,
    delete_event,
    user_counts,
    event_counts,
  } from '$lib/esclient';
 
  import {WebStorage} from '$lib/WebStorage'
  import {getKey} from "$lib/getkey";
  import {getColorClass,getUserName} from "$lib/users";
  import {getPerm } from "$lib/permissions";
  import {selectRandomIcon} from "$lib/events";

  import EditDialog from "$lib/editdialog.svelte";
  import {PERMISSIONS} from "eventstore-tools/src/common";

  import {    
    generateSecretKey,
    getPublicKey,
    esecEncode,
    esecDecode,
  } from "eventstore-tools/src/key";
     

 

  let Keypriv ;
  let Keypub ;
   
  let isNewAccount = false;
  let emailInput;
  let privateKeyInput;
  let newpriv;
  let showLogin = false;
 

  let events      = [];
  let eventTotal = 0;
  let userTotal = 0;
  let users       = [];
  let permissions = [];

  let showToast = false;
  let toastMessage = '';
  let toastType = 'success'; // success, error, warning, info


  let isOpenEditDialog=false;
  let eventData;
  
  

  const showToastMessage = (message, type = 'success') => {
    toastMessage = message;
    toastType = type;
    showToast = true;
    
    // 3秒后自动隐藏
    setTimeout(() => {
      showToast = false;
    }, 3000);
  }

  function handle_events(e){
    let temp = events;
    e.icon = selectRandomIcon();
    temp.push(e)

    events = [...temp];
  
  }



  async function handle_users(e){
    let temp = users;
    if (e != "EOSE")
      temp.push(e)
    else {
      users = [...temp]
      let pubkeys = users.map(user => user.pubkey);
      permissions = []
      await get_permissions(pubkeys,message =>{
          let temp = permissions;
          temp.push(message)
          permissions  = [...temp]
      })
    }
  }

 

  function deleteUser (pubkey){
    let adminpubkey = Keypub;
    let adminprivkey = Keypriv;
    delete_user(pubkey,adminpubkey,adminprivkey,function(message) {
      
      showToastMessage(message.message);
      if (message.code == 200){
          setTimeout(() => {
             window.location.reload();
          }, 1000);
      }
    });
  }

  function deleteEvent (EventId){
    let adminpubkey = Keypub;
    let adminprivkey = Keypriv;
    delete_event(EventId,adminpubkey,adminprivkey,function(message) {
      
      showToastMessage(message.message);
      if (message.code == 200){
          setTimeout(() => {
             window.location.reload();
          }, 1000);
      }
    });
  }

let event_start_page = 1;
let event_current_page = 1;

async function get_events_page(page, ops) {
    let oldpage = event_current_page;
    const maxPage = eventTotal > 0 ? Math.ceil(eventTotal / 10) : 1;

    if (page) {
      // 校验page合法性：必须是正整数且不超过最大页码
      if (typeof page !== 'number' || page < 1 || page > maxPage) {
        console.warn('无效页码');
        return;
      }
      event_current_page = page;
    } else {
      // 下一页操作
      if (ops === 1) {
        // 当当前页超过显示的最大页码（start+2）时，起始页推进1
        // （因为按钮显示start、start+1、start+2，共3个页码）
        if (event_current_page > event_start_page + 2) {
          event_start_page += 1;
        }
        event_current_page += 1;
      }
      // 上一页操作
      else if (ops === -1) {
        // 当当前页小于显示的最小页码（start）时，起始页后退1
        if (event_current_page < event_start_page && event_start_page > 1) {
          event_start_page -= 1;
        }
        event_current_page -= 1;
      }
    }

    // 限制当前页在有效范围（1 ~ 最大页码）
    if (event_current_page > maxPage) {
      event_current_page = maxPage;
    } else if (event_current_page < 1) {
      event_current_page = 1;
    }

    // 页码变化且有数据时，重新加载
    if (oldpage !== event_current_page && eventTotal > 0) {
      events = [];
      await get_events(Keypub, Keypriv, (event_current_page - 1) * 10, 10, handle_events);
    } else if (eventTotal === 0) {
      events = [];
    }
  }

  // 分页状态变量（页码从1开始）
let userStartPage = 1;       // 起始显示页码
let userCurrentPage = 1;     // 当前页码
             
 
async function fetchUsersByPage(page = null, ops = 0) {
    const oldPage = userCurrentPage;
    
    // 处理直接指定页码的情况
    if (page !== null) {
 
        userCurrentPage = page;
    } 
    // 处理上下页操作
    else {
        // 下一页操作
        if (ops === 1) {
            // 当当前页与起始页差值≥3时，起始页同步推进
            if (userCurrentPage - userStartPage >= 3) {
                userStartPage++;
            }
            userCurrentPage++;
        }
        // 上一页操作
        else if (ops === -1) {
            // 当当前页小于起始页且起始页>1时，起始页同步后退
            if (userCurrentPage < userStartPage && userStartPage > 1) {
                userStartPage--;
            }
            userCurrentPage--;
        }
    }

    // 计算最大可访问页码（总用户数/每页条数，向上取整）
    const maxPage = Math.ceil(userTotal / 10) || 1;
    
    // 限制当前页在有效范围内（1 ~ 最大页码）
    if (userCurrentPage > maxPage) {
        userCurrentPage = maxPage;
    } else if (userCurrentPage < 1) {
        userCurrentPage = 1;
    }

    // 页码变化时重新加载数据
    if (oldPage !== userCurrentPage) {
        users = [];  // 清空当前页数据
        // 计算偏移量（MongoDB的skip参数从0开始，页码从1开始需减1）
        const offset = (userCurrentPage - 1) * 10;
        await get_users( offset, 10, handle_users);
    }
  }


  let saveCb = ()=>{} ;
  function saveEvent (data){
    
    saveCb(data);
  }
  function addPermission(pubkey){
    console.log(isOpenEditDialog)
    eventData = JSON.stringify({
      "userId": pubkey,
      "permissionValue":PERMISSIONS.CREATE_EVENTS|PERMISSIONS.UPLOAD_FILES,
    })

    saveCb = (data) =>  {
      let adminpubkey = Keypub;
      let adminprivkey = Keypriv;
       
      add_permission(JSON.parse(eventData),Keypub,Keypriv,function(message){
        showToastMessage(message.message);
        if (message.code == 200){
            setTimeout(() => {
              window.location.reload();
            }, 1000);
        }
      });
    }
    isOpenEditDialog = true;
  }

 function closeDialog(){
  eventData = "";
  saveCb = ()=>{};
  isOpenEditDialog = false;
 }

  const generateKey = () => {
    // 实际项目中应该使用加密库生成私钥
    const keyField = document.getElementById('esecKey');
    newpriv = generateSecretKey()
    keyField.value = esecEncode(newpriv);
    keyField.classList.add('border-green-300', 'bg-green-50');
    setTimeout(() => {return { code: 200, message: '用户创建成功' };
            keyField.classList.remove('border-green-300', 'bg-green-50');
    }, 2000);
    privateKeyInput = keyField.value;
  };

  const toggleCreate = () => {
    isNewAccount = !isNewAccount;
    
    privateKeyInput = ''; // 切换模式时清空输入
    emailInput = '';
  };

  const LoginorCreate = ()=>{
    console.log(privateKeyInput);

    if (!privateKeyInput.startsWith('esec1') || privateKeyInput.length < 48) {
        return alert('无效的私钥格式');
    }
         

    if (isNewAccount){//create

      create_user(emailInput,getPublicKey(newpriv),newpriv,function(message){
        showToastMessage(message[2].message);
        if (message[2].code == 200){
          let storage = new WebStorage(localStorage);
          Keypriv = esecDecode(privateKeyInput)['data']
        
          Keypub = getPublicKey(Keypriv) 
          storage.set("keyPriv", Keypriv);
          showToastMessage(message[2].message);
          setTimeout(() => {
             window.location.reload();
          }, 1000);
          
        } else {
          showToastMessage(message[2].message,"warning");
        }
 

      });
    } else { //login

 
      let storage = new WebStorage(localStorage);
      Keypriv = esecDecode(privateKeyInput)['data']
        
      Keypub = getPublicKey(Keypriv) 
      storage.set("keyPriv", Keypriv);
      showToastMessage("登录成功！")
      setTimeout(() => {
             window.location.reload();
          }, 1000);
    }



  }

  const userMenu =()=>{
    if (!Keypub) return ;
    
    const userDropdown = document.getElementById('userDropdown');

    userDropdown.classList.toggle('hidden');

  }

  const Logout = ()=> {
    let storage = new WebStorage(localStorage);
    storage.remove("keyPriv");
    window.location.reload();

  }

  function setupSidebar() {
    const sidebarLinks = document.querySelectorAll('#sidebar nav a');
     
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            
            e.preventDefault();
            
            // 移除所有激活状态
            sidebarLinks.forEach(l => {
                l.classList.remove('sidebar-active');
                l.classList.add('text-gray-700');
                l.querySelector('i').classList.add('text-gray-500');
                l.querySelector('i').classList.remove('text-primary');
            });
            
            // 添加当前激活状态
            link.classList.add('sidebar-active');
            link.classList.remove('text-gray-700');
            link.querySelector('i').classList.remove('text-gray-500');
            link.querySelector('i').classList.add('text-primary');
            
            // 获取链接目标
            const target = link.getAttribute('href').substring(1);
            
            // 更新标题
            if (target === 'users') {
                document.getElementById('usersSection').classList.remove('hidden'); 
                document.getElementById('eventsSection').classList.add('hidden');
                
            } else if (target === 'events') {
                document.getElementById('eventsSection').classList.remove('hidden');
                document.getElementById('usersSection').classList.add('hidden');  
                
            }
        });
    });
  }

  onMount(async() => {
  
    let Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;

    if (!Keypriv) {
      showLogin = true;
      document.getElementById('usersSection').classList.add('hidden');
    } else  {
      document.getElementById('usersSection').classList.remove('hidden');
      
      document.getElementById('adminContent').classList.remove('hidden');
    }

    await get_events(Keypub,Keypriv,0,10,handle_events);

    await get_users(0,10,handle_users);

  

    await user_counts( message=>{
      if (message != "EOSE")
        userTotal = message.counts;
    })

    await event_counts( message=>{
      if (message != "EOSE")
        eventTotal = message.counts;
    })

    setupSidebar();
     
  })

</script>



 
  
  <style>

    
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: rgba(241, 245, 249, 0.5);
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
    
    .sidebar-active {
      background: rgba(22, 93, 255, 0.08);
      color: #165DFF;
      border-left: 4px solid #165DFF;
    }
    
    .status-badge {
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    
    .card {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 12px;
      overflow: hidden;
      background: white;
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    }
    
    .gradient-header {
      background: linear-gradient(135deg, #165DFF 0%, #0e42b8 100%);
    }
    
    .pulse {
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(22, 93, 255, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(22, 93, 255, 0); }
      100% { box-shadow: 0 0 0 0 rgba(22, 93, 255, 0); }
    }
    
    .animate-float {
      animation: float 6s ease-in-out infinite;
    }
    
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    
    .tab-active {
      border-bottom: 2px solid #165DFF;
      color: #165DFF;
    }
    
    .event-image {
      height: 150px;
      object-fit: cover;
      width: 100%;
      border-radius: 8px;
    }
    
    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: white;
    }
    
    .role-badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    /* 新增：提示弹框样式 */
    .toast {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.9);
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: 9999;
        opacity: 0;
        transition: all 0.3s ease-in-out;
        display: flex;
        align-items: center;
        max-width: 300px;
        text-align: center;
        justify-content: center;
    }

    .toast.show {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
    }    
  
  .toast.success {
    background-color: #10B981;
    color: white;
  }
  
  .toast.error {
    background-color: #EF4444;
    color: white;
  }
  
  .toast.warning {
    background-color: #F59E0B;
    color: white;
  }
  
  .toast.info {
    background-color: #3B82F6;
    color: white;
  }
  
  .toast-icon {
    margin-right: 0.75rem;
    font-size: 1.25rem;
  }
  
  .toast-message {
    font-size: 0.9rem;
  }
  </style>
 
<svelte:head>
    <title>eventstore - Admin</title>
</svelte:head>

  <!-- 顶部导航栏 -->
  <header id="navbar" class="gradient-header shadow-lg fixed top-0 left-0 right-0 z-50 transition-all duration-300">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-white flex items-center">
            <i class="fa fa-shield mr-2"></i>
            <span>Admin Dashboard</span>
          </h1>
        </div>
        
        <div class="flex items-center space-x-4">
          <div class="relative">
            <button id="notificationBtn" class="p-2 rounded-full hover:bg-white/10 transition-colors text-white" aria-label="b">
              <i class="fa fa-bell-o"></i>
              <span class="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full border border-white"></span>
            </button>
          </div>
          
          <div id="userMenu" class="relative">
            <button class="flex items-center space-x-2 p-1 rounded-full hover:bg-white/10 transition-colors" on:click={userMenu}>
              <div class="relative">
                <!-- 管理员头像使用虚拟图标 -->
                <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <i class="fa fa-user"></i>
                </div>
              </div>
              <span id="usernameDisplay" class="hidden md:inline-block font-medium text-white">{Keypub ? 'Admin User' : '未登录'}</span>
              <i class="fa fa-chevron-down text-xs text-white/70"></i>
            </button>
            
            <div id="userDropdown" class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-1 hidden z-50 overflow-hidden">
              <a href="#a" id="profileLink" class="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center">
                <i class="fa fa-user mr-3 text-primary"></i>Profile
              </a>
              <a href="#b" id="settingsLink" class="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center">
                <i class="fa fa-cog mr-3 text-primary"></i>Settings
              </a>
              <div class="border-t border-gray-100 my-1"></div>
              <a href="#c" id="logoutLink" class="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center" on:click={Logout}>
                <i class="fa fa-sign-out mr-3 text-danger"></i>Logout
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>

  <div class="flex pt-16 min-h-screen">
    <!-- 侧边栏 -->
    <aside id="sidebar" class="w-64 bg-white shadow-lg fixed h-full left-0 top-16 transition-all duration-300 transform z-40 border-r border-gray-100">
      <nav class="py-6 px-4">
        <div class="space-y-1">
          <a href="#dashboard" class="flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <i class="fa fa-tachometer w-5 text-center mr-3 text-gray-500"></i>
            <span>Dashboard</span>
          </a>
          
          <a href="#users" class="sidebar-active flex items-center px-4 py-3 rounded-lg transition-colors">
            <i class="fa fa-users w-5 text-center mr-3 text-primary"></i>
            <span>Users</span>
            <span class="ml-auto bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">{userTotal}</span>
          </a>
          
          <a href="#events" class="flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <i class="fa fa-calendar w-5 text-center mr-3 text-gray-500"></i>
            <span>Events</span>
            <span class="ml-auto bg-warning/10 text-warning text-xs font-medium px-2 py-0.5 rounded-full">{eventTotal}</span>
          </a>
          
          <a href="#permissions" class="flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <i class="fa fa-lock w-5 text-center mr-3 text-gray-500"></i>
            <span>Permissions</span>
          </a>
          
          <a href="#analytics" class="flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <i class="fa fa-line-chart w-5 text-center mr-3 text-gray-500"></i>
            <span>Analytics</span>
          </a>
        </div>
        
        <div class="mt-8 pt-6 border-t border-gray-200">
          <div class="px-4 mb-4">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Settings</p>
          </div>
          
          <div class="space-y-1">
            <a href="#settings" class="flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <i class="fa fa-cog w-5 text-center mr-3 text-gray-500"></i>
              <span>System Settings</span>
            </a>
            
            <a href="#security" class="flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <i class="fa fa-shield w-5 text-center mr-3 text-gray-500"></i>
              <span>Security</span>
            </a>
            
            <a href="#help" class="flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <i class="fa fa-question-circle w-5 text-center mr-3 text-gray-500"></i>
              <span>Help & Support</span>
            </a>
          </div>
        </div>
      </nav>
      
      <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <i class="fa fa-moon text-primary"></i>
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium text-gray-900">Dark Mode</p>
            </div>
          </div>
          <div class="relative inline-block w-10 mr-2 align-middle select-none">
            <input type="checkbox" name="darkModeToggle" id="darkModeToggle" class="sr-only">
            <label for="darkModeToggle" class="block h-6 w-10 rounded-full bg-gray-300 cursor-pointer"></label>
            <span class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out"></span>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="flex-1 ml-64 p-6 transition-all duration-300">
      <!-- 登录表单 (初始显示) -->
      {#if showLogin }
        <div id="loginSection" class="max-w-md mx-auto mt-8">
          <div class="card bg-white shadow-xl overflow-hidden">
            <div class="gradient-header p-6 text-center">
              <div class="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-4 animate-float">
                <i class="fa fa-{isNewAccount ? 'user-plus' : 'sign-in'} text-white text-2xl"></i>
              </div>
              <h2 class="text-2xl font-bold text-white">
                {isNewAccount ? '创建新账号' : '已有账号登录'}
              </h2>
              <p class="text-white/80 mt-1">
                {isNewAccount 
                  ? '生成新的密钥对并注册账号' 
                  : '使用已有私钥登录'}
              </p>
            </div>
            
            <div class="p-6">
              <!-- 新建账号模式显示邮箱输入 -->
              {#if isNewAccount}
                <div class="mb-4">
                  <label for="email" class="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <i class="fa fa-envelope mr-2 text-primary"></i> 
                    <span>邮箱地址</span>
                  </label>
                  <input 
                    type="email" 
                    id="email" 
                    bind:value={emailInput}
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-sm" 
                    placeholder="your@email.com"
                  />
                  <p class="text-xs text-gray-500 mt-1 flex items-center">
                    <i class="fa fa-info-circle mr-1"></i> 
                    <span>用于接收重要通知和恢复账号</span>
                  </p>
                </div>
              {/if}
              
              <div class="mb-6">
                <label for="esecKey" class="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <i class="fa fa-key mr-2 text-primary"></i> 
                  <span>{isNewAccount ? '生成的私钥' : '已有私钥'}</span>
                </label>
                <div class="relative">
                  <textarea 
                    id="esecKey" 
                    bind:value={privateKeyInput}
                    rows="4" 
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-sm" 
                    placeholder={isNewAccount 
                      ? "生成新的私钥 (将自动填充)" 
                      : "粘贴您已有的 esec1... 私钥"}
                  ></textarea>
                  {#if isNewAccount}
                    <button 
                      on:click={generateKey} 
                      class="absolute right-3 bottom-3 text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center"
                    >
                      <i class="fa fa-refresh mr-1"></i> 生成新密钥对
                    </button>
                  {/if}
                </div>
                {#if isNewAccount}
                  <p class="text-xs text-gray-500 mt-2 flex items-center">
                    <i class="fa fa-info-circle mr-1"></i> 
                    <span>点击"生成新密钥对"自动创建安全的密钥对</span>
                  </p>
                {:else}
                  <p class="text-xs text-gray-500 mt-2 flex items-center">
                    <i class="fa fa-info-circle mr-1"></i> 
                    <span>从安全存储中粘贴您的私钥</span>
                  </p>
                {/if}
              </div>
              
              <div class="mb-4">
                <button 
                  on:click={LoginorCreate} 
                  class="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center shadow-md hover:shadow-lg"
                >
                  <i class="fa fa-{isNewAccount ? 'user-plus' : 'sign-in'} mr-2"></i> 
                  {isNewAccount ? '创建账号' : '登录'}
                </button>
              </div>
              
              <div class="text-center text-sm text-gray-500">
                <button 
                  type="button" 
                  on:click={toggleCreate} 
                  class="text-primary hover:underline font-medium bg-transparent border-none p-0"
                >
                  {isNewAccount 
                    ? '已有账号？点击登录' 
                    : '没有账号？创建一个'}
                </button>
              </div>
              
              <p class="text-warning text-xs mt-4 flex items-center justify-center">
                <i class="fa fa-exclamation-triangle mr-1"></i> 
                <span>私钥将存储在本地浏览器中，请确保您的设备安全</span>
              </p>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- 管理内容区 (默认隐藏) -->
      <div id="adminContent" class="hidden">
        <!-- 用户管理页面 -->
        <div id="usersSection">
          <!-- 页面标题和统计卡片 -->
          <div class="mb-6">
            <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h2 class="text-2xl font-bold text-gray-800">User Management</h2>
                <p class="text-gray-600 mt-1">Manage all system users and their permissions</p>
              </div>
              
              <div class="flex items-center space-x-3">
                <div class="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                  <div class="text-xs text-gray-500">Total Users</div>
                  <div class="text-xl font-bold text-primary">142</div>
                </div>
                <div class="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                  <div class="text-xs text-gray-500">Active</div>
                  <div class="text-xl font-bold text-success">128</div>
                </div>
                <div class="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                  <div class="text-xs text-gray-500">Pending</div>
                  <div class="text-xl font-bold text-warning">14</div>
                </div>
              </div>
            </div>
            
            <!-- 操作按钮和搜索 -->
            <div class="flex flex-wrap items-center justify-between mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm">
              <div class="relative flex-1 max-w-md">
                <input type="text" placeholder="Search users..." class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors">
                <i class="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              </div>
              
              <div class="flex space-x-3">
                <button class="bg-white text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center border border-gray-300">
                  <i class="fa fa-filter mr-2"></i> Filter
                </button>
                <button id="addUserBtn" class="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center shadow-md hover:shadow-lg">
                  <i class="fa fa-plus mr-2"></i> Add User
                </button>
              </div>
            </div>
          </div>
          
          <!-- 用户表格 -->
          <div class="card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Public Key</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <!--th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th-->
                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <!-- 用户行数据 -->
                   {#each users as user,index}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                      <div class="flex items-center">
                        <div class="user-avatar {getColorClass(index)} mr-3">{getUserName(user.email).initials}</div>
                        <div>
                          <div class="text-sm font-medium text-gray-900"></div>
                          <div class="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm text-gray-600">{user.pubkey?.substring(1,10)}...{user.pubkey?.substring(50,64)}</div>
                    </td>
                    <td class="px-6 py-4">
                      <span class="role-badge bg-primary/10 text-primary">{getPerm(permissions,user.pubkey)}</span>
                    </td>
 
                    <td class="px-6 py-4 text-right">
                      <div class="flex justify-end space-x-2">
                        <button class="w-8 h-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors" on:click={addPermission(user.pubkey)} aria-label="b">
                          <i class="fa fa-pencil"></i>
                        </button>
                        <button class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors" on:click={deleteUser(user.pubkey)} aria-label="b">
                          <i class="fa fa-trash-o"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                   {/each}
                  
                
                </tbody>
              </table>
            </div>
            
            <!-- 分页 -->
            <div class="bg-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200">
              <div class="mb-4 sm:mb-0">
                <p class="text-sm text-gray-700">
                  Showing <span class="font-medium">1</span> to <span class="font-medium">{Math.floor(userTotal/10) + 1}</span> of <span class="font-medium">{userTotal}</span> users
                </p>
              </div>
              <div class="flex items-center space-x-2">
                  <button class="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" 
                          aria-label="page" 
                          on:click={fetchUsersByPage(null, -1)}>
                    Previous
                  </button>

                  <button class="w-8 h-8 flex items-center justify-center rounded-lg {userCurrentPage == userStartPage + 1 ? "bg-primary text-white" : "text-gray-700"} text-sm font-medium" 
                          aria-label="page" 
                          on:click={fetchUsersByPage(userStartPage + 1)}>
                    {userStartPage + 1}
                  </button>

                  <button class="w-8 h-8 flex items-center justify-center rounded-lg {userCurrentPage == userStartPage + 2 ? "bg-primary text-white" : "text-gray-700"} hover:bg-gray-100 text-sm font-medium" 
                          aria-label="page" 
                          on:click={fetchUsersByPage(userStartPage + 2)}>
                    {userStartPage + 2}
                  </button>

                  <button class="w-8 h-8 flex items-center justify-center rounded-lg {userCurrentPage == userStartPage + 3 ? "bg-primary text-white" : "text-gray-700"} hover:bg-gray-100 text-sm font-medium" 
                          aria-label="page" 
                          on:click={fetchUsersByPage(userStartPage + 3)}>
                    {userStartPage + 3}
                  </button>

                  <button class="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50" 
                          aria-label="next" 
                          on:click={fetchUsersByPage(null, 1)}>
                    Next
                  </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Events 管理页面 -->
        <div id="eventsSection" class="hidden">
          <div class="mb-6">
            <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h2 class="text-2xl font-bold text-gray-800">User Events Management</h2>
                <p class="text-gray-600 mt-1">Manage events uploaded by users</p>
              </div>
              
              <div class="flex items-center space-x-3">
                <div class="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                  <div class="text-xs text-gray-500">Total Events</div>
                  <div class="text-xl font-bold text-primary">87</div>
                </div>
                <div class="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                  <div class="text-xs text-gray-500">Pending</div>
                  <div class="text-xl font-bold text-warning">12</div>
                </div>
                <div class="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                  <div class="text-xs text-gray-500">Published</div>
                  <div class="text-xl font-bold text-success">65</div>
                </div>
              </div>
            </div>
            
            <!-- 事件筛选 -->
            <div class="flex flex-wrap items-center justify-between mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm">
              <div class="flex space-x-2">
                <button class="tab-active px-4 py-2 text-sm font-medium">All Events</button>
                <button class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Pending</button>
                <button class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Published</button>
                <button class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Rejected</button>
              </div>
              
              <div class="flex space-x-3">
                <button class="bg-white text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center border border-gray-300" aria-label="b">
                  <i class="fa fa-calendar mr-2"></i> Date Range
                </button>
                <button class="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center shadow-md hover:shadow-lg" aria-label="b">
                  <i class="fa fa-plus mr-2"></i> New Event
                </button>
              </div>
            </div>
          </div>
 
        
   
 
  
          
          <!-- 事件表格 -->
          <div class="card overflow-hidden mt-6">
            <div class="p-5">
              <h3 class="font-medium text-gray-800 mb-4">Events List</h3>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>                     
                      <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">

                   {#each events as event }
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-4">
                        <div class="flex items-center">
                          <div class="flex-shrink-0 w-10 h-10 rounded-md {event.icon.bgClass} flex items-center justify-center">
                            <i class="fa {event.icon.iconClass} {event.icon.textClass}"></i>
                          </div>
                          <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">{JSON.stringify(event.data)?.substring(0, 20)}</div>
                            <div class="text-sm text-gray-500"> </div>
                          </div>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                       {event.code}

                      </td>
                      <td class="px-6 py-4">
                       
                        <div class="text-sm text-gray-500">{event.user?.substring(0,10)}...{event.user?.substring(54)}</div>
                      </td>
                      <td class="px-6 py-4">
                        <div class="text-sm text-gray-900">{event.servertimestamp?.split("T")[0]}</div>
                        <div class="text-sm text-gray-500">{event.servertimestamp?.split("T")[1]}</div>
                      </td>
                      <td class="px-6 py-4">
                         {event.status !=1 ? "open":"hidded"}
                      </td>
                   
                      <td class="px-6 py-4 text-right">
                        <div class="flex justify-end space-x-2">
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors" aria-label="b">
                            <i class="fa fa-eye"></i>
                          </button>
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-100 transition-colors" aria-label="b">
                            <i class="fa fa-check"></i>
                          </button>
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors" on:click={deleteEvent(event.id)} aria-label="b">
                            <i class="fa fa-trash-o"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/each}
           
                    
                    
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- 分页 -->
            <div class="bg-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200">
              <div class="mb-4 sm:mb-0">
                <p class="text-sm text-gray-700">
                  Showing <span class="font-medium">1</span> to <span class="font-medium">{Math.floor(eventTotal/10) + 1}</span> of <span class="font-medium">{eventTotal}</span> events
                </p>
              </div>
              <div class="flex items-center space-x-2">
                <button class="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" aria-label="page"  on:click={() => get_events_page(null, -1)}>
                  Previous
                </button>
                
                <button class="w-8 h-8 flex items-center justify-center rounded-lg {event_current_page == event_start_page   ? "bg-primary text-white":"text-gray-700"}  text-sm font-medium" aria-label="page" on:click={ () =>get_events_page(event_start_page)}>
                  {event_start_page  }
                </button>
                <button class="w-8 h-8 flex items-center justify-center rounded-lg  {event_current_page == event_start_page + 1   ? "bg-primary text-white":"text-gray-700"}  hover:bg-gray-100 text-sm font-medium" aria-label="page" on:click={() =>get_events_page(event_start_page+1)}>
                   {event_start_page + 1 }
                </button>
                <button class="w-8 h-8 flex items-center justify-center rounded-lg  {event_current_page == event_start_page + 2  ? "bg-primary text-white":"text-gray-700"}  hover:bg-gray-100 text-sm font-medium" aria-label="page" on:click={() =>get_events_page(event_start_page+2)}>
                   {event_start_page + 2 }
                </button>
                
                <button class="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50" aria-label="next"  on:click={() => get_events_page(null, 1)}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Permissions 列表页面 -->
        <div id="permissionsSection" class="hidden">
          <div class="mb-6">
            <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h2 class="text-2xl font-bold text-gray-800">Permissions Management</h2>
                <p class="text-gray-600 mt-1">Define and manage user access permissions</p>
              </div>
              
              <div class="flex items-center space-x-3">
                <div class="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                  <div class="text-xs text-gray-500">Total Roles</div>
                  <div class="text-xl font-bold text-primary">6</div>
                </div>
                <div class="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                  <div class="text-xs text-gray-500">Active Permissions</div>
                  <div class="text-xl font-bold text-success">42</div>
                </div>
                <div class="bg-white rounded-lg shadow-sm p-2 border border-gray-200">
                  <div class="text-xs text-gray-500">Custom Rules</div>
                  <div class="text-xl font-bold text-secondary">18</div>
                </div>
              </div>
            </div>
            
            <!-- 权限操作 -->
            <div class="flex flex-wrap items-center justify-between mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm">
              <div class="relative flex-1 max-w-md">
                <input type="text" placeholder="Search permissions..." class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors">
                <i class="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              </div>
              
              <div class="flex space-x-3">
                <button class="bg-white text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center border border-gray-300" aria-label="filter">
                  <i class="fa fa-filter mr-2"></i> Filter
                </button>
                <button class="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center shadow-md hover:shadow-lg" aria-label="add">
                  <i class="fa fa-plus mr-2"></i> Add Permission
                </button>
              </div>
            </div>
          </div>
          
          <!-- 权限卡片网格 -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- 管理员权限 -->
            <div class="card overflow-hidden">
              <div class="gradient-header p-4 flex items-center">
                <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <i class="fa fa-shield text-white"></i>
                </div>
                <div class="ml-3">
                  <h3 class="font-bold text-white">Administrator</h3>
                  <p class="text-white/80 text-xs">Full system access</p>
                </div>
              </div>
              <div class="p-4">
                <div class="flex justify-between items-center mb-4">
                  <span class="text-sm text-gray-600">Users: 3</span>
                  <span class="status-badge bg-green-100 text-green-800">Active</span>
                </div>
                
                <div class="space-y-3">
                  <div class="flex items-center">
                    <i class="fa fa-check-circle text-success mr-2"></i>
                    <span class="text-sm">Full system access</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-check-circle text-success mr-2"></i>
                    <span class="text-sm">User management</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-check-circle text-success mr-2"></i>
                    <span class="text-sm">Permission control</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-check-circle text-success mr-2"></i>
                    <span class="text-sm">System configuration</span>
                  </div>
                </div>
                
                <div class="mt-4 flex space-x-2">
                  <button class="flex-1 bg-primary/10 text-primary px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors" aria-label="edit">
                    Edit
                  </button>
                  <button class="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" aria-label="views">
                    View Users
                  </button>
                </div>
              </div>
            </div>
            
            <!-- 编辑权限 -->
            <div class="card overflow-hidden">
              <div class="bg-secondary p-4 flex items-center">
                <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <i class="fa fa-edit text-white"></i>
                </div>
                <div class="ml-3">
                  <h3 class="font-bold text-white">Editor</h3>
                  <p class="text-white/80 text-xs">Content management</p>
                </div>
              </div>
              <div class="p-4">
                <div class="flex justify-between items-center mb-4">
                  <span class="text-sm text-gray-600">Users: 8</span>
                  <span class="status-badge bg-green-100 text-green-800">Active</span>
                </div>
                
                <div class="space-y-3">
                  <div class="flex items-center">
                    <i class="fa fa-check-circle text-success mr-2"></i>
                    <span class="text-sm">Create and edit content</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-check-circle text-success mr-2"></i>
                    <span class="text-sm">Media management</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-times-circle text-gray-300 mr-2"></i>
                    <span class="text-sm">User management</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-times-circle text-gray-300 mr-2"></i>
                    <span class="text-sm">System configuration</span>
                  </div>
                </div>
                
                <div class="mt-4 flex space-x-2">
                  <button class="flex-1 bg-secondary/10 text-secondary px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary/20 transition-colors" aria-label="edit">
                    Edit
                  </button>
                  <button class="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" aria-label="views">
                    View Users
                  </button>
                </div>
              </div>
            </div>
            
            <!-- 查看权限 -->
            <div class="card overflow-hidden">
              <div class="bg-gray-700 p-4 flex items-center">
                <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <i class="fa fa-eye text-white"></i>
                </div>
                <div class="ml-3">
                  <h3 class="font-bold text-white">Viewer</h3>
                  <p class="text-white/80 text-xs">Read-only access</p>
                </div>
              </div>
              <div class="p-4">
                <div class="flex justify-between items-center mb-4">
                  <span class="text-sm text-gray-600">Users: 24</span>
                  <span class="status-badge bg-green-100 text-green-800">Active</span>
                </div>
                
                <div class="space-y-3">
                  <div class="flex items-center">
                    <i class="fa fa-check-circle text-success mr-2"></i>
                    <span class="text-sm">View all content</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-times-circle text-gray-300 mr-2"></i>
                    <span class="text-sm">Edit content</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-times-circle text-gray-300 mr-2"></i>
                    <span class="text-sm">User management</span>
                  </div>
                  <div class="flex items-center">
                    <i class="fa fa-times-circle text-gray-300 mr-2"></i>
                    <span class="text-sm">System configuration</span>
                  </div>
                </div>
                
                <div class="mt-4 flex space-x-2">
                  <button class="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors" aria-label="edit">
                    Edit
                  </button>
                  <button class="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" aria-label="views">
                    View Users
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 权限表格 -->
          <div class="card overflow-hidden mt-6">
            <div class="p-5">
              <h3 class="font-medium text-gray-800 mb-4">Detailed Permission List</h3>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permission</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-4">
                        <div class="flex items-center">
                          <i class="fa fa-user text-primary mr-2"></i>
                          <span class="text-sm font-medium text-gray-900">user.create</span>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <div class="text-sm text-gray-600">Create new users</div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="status-badge bg-primary/10 text-primary">Admin</span>
                      </td>
                      <td class="px-6 py-4">
                        <span class="status-badge bg-green-100 text-green-800">Active</span>
                      </td>
                      <td class="px-6 py-4 text-right">
                        <div class="flex justify-end space-x-2"> 
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors" aria-label="修改">
                            <i class="fa fa-pencil"></i>
                          </button>
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors" aria-label="删除">
                            <i class="fa fa-trash-o"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-4">
                        <div class="flex items-center">
                          <i class="fa fa-lock text-warning mr-2"></i>
                          <span class="text-sm font-medium text-gray-900">permission.manage</span>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <div class="text-sm text-gray-600">Manage permissions</div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="status-badge bg-primary/10 text-primary">Admin</span>
                      </td>
                      <td class="px-6 py-4">
                        <span class="status-badge bg-green-100 text-green-800">Active</span>
                      </td>
                      <td class="px-6 py-4 text-right">
                        <div class="flex justify-end space-x-2">
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors" aria-label="修改">
                            <i class="fa fa-pencil"></i>
                          </button>
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors" aria-label="删除">
                            <i class="fa fa-trash-o"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-4">
                        <div class="flex items-center">
                          <i class="fa fa-file-text text-secondary mr-2"></i>
                          <span class="text-sm font-medium text-gray-900">content.edit</span>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <div class="text-sm text-gray-600">Edit system content</div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="status-badge bg-secondary/10 text-secondary">Editor</span>
                        <span class="status-badge bg-primary/10 text-primary ml-1">Admin</span>
                      </td>
                      <td class="px-6 py-4">
                        <span class="status-badge bg-green-100 text-green-800">Active</span>
                      </td>
                      <td class="px-6 py-4 text-right">
                        <div class="flex justify-end space-x-2">
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors" aria-label="修改">
                            <i class="fa fa-pencil"></i>
                          </button>
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors" aria-label="删除">
                            <i class="fa fa-trash-o"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-4">
                        <div class="flex items-center">
                          <i class="fa fa-cog text-purple-600 mr-2"></i>
                          <span class="text-sm font-medium text-gray-900">system.configure</span>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <div class="text-sm text-gray-600">Configure system settings</div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="status-badge bg-primary/10 text-primary">Admin</span>
                      </td>
                      <td class="px-6 py-4">
                        <span class="status-badge bg-yellow-100 text-yellow-800">Pending Review</span>
                      </td>
                      <td class="px-6 py-4 text-right">
                        <div class="flex justify-end space-x-2">
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors" aria-label="修改">
                            <i class="fa fa-pencil"></i>
                          </button>
                          <button class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors" aria-label="删除">
                            <i class="fa fa-trash-o"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 底部信息 -->
        <div class="mt-8 text-center text-sm text-gray-500">
          <p>© 2025 eventstore Admin Dashboard. All rights reserved.</p>
          <p class="mt-1"> </p>
        </div>
      </div>
    </main>
  </div>
  
 
<!-- 新增：提示弹框组件 -->
{#if showToast}
 
  <div class="toast {toastType} show">
    <div class="toast-icon">
      {#if toastType === 'success'}
        <i class="fa fa-check-circle"></i>
      {:else if toastType === 'error'}
        <i class="fa fa-times-circle"></i>
      {:else if toastType === 'warning'}
        <i class="fa fa-exclamation-triangle"></i>
      {:else if toastType === 'info'}
        <i class="fa fa-info-circle"></i>
      {/if}
    </div>
    <div class="toast-message">{toastMessage}</div>
  </div>
  
{/if} 



  <EditDialog 
    isOpenEditDialog = {isOpenEditDialog} 
    {eventData}
    onClose = {closeDialog} 
    onOK={saveEvent}
  >
    <!-- 设置标题 -->
    <svelte:fragment slot="textarea">
        <textarea 
            id="eventText" 
            bind:value={eventData}
            rows="7"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"          
        ></textarea>
    </svelte:fragment>
  </EditDialog>
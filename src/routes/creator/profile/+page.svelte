<script>
  import { onMount } from 'svelte';
    
  import { upload_file,save_user_profile ,
    get_user_profile,
    get_user_by_pubkeys} from "$lib/esclient";

  import { getKey } from "$lib/getkey";
  import { uploadpath } from "$lib/config";
  import { showNotification } from "$lib/message";
  import {    
    esecEncode,
    esecDecode,
    epubEncode,
    epubDecode,
 } from "eventstore-tools/src/key";
 import  { bytesToHex, hexToBytes } from '@noble/hashes/utils';


  let Keypriv;
  let Keypub;
  let avatarUrl;
  let avatarImgData = '';
  let isAvatarContainerActive = false; 
  let username = "";
  let email = "";  
  let title = "机器人开发";  
  let bio = "我是   , 一位热爱技术和写作的开发者。\n专注 ，\n喜欢分享知识和经验。";

  let user_profile;
  let showMoreHint = true; // 控制"下面还有信息"提示的显示状态
  
  // 密钥相关变量
  let showPrivateKey = false; // 控制私钥显示状态
  let keyprivBin; // 私钥-普通二进制格式
  let keyprivBech32; // 私钥-bech32格式
  let keypubBin; // 公钥-普通二进制格式
  let keypubBech32; // 公钥-bech32格式

  onMount(async () => {
    // 加载用户密钥
    const Key = getKey();
    Keypriv = Key.Keypriv;
    Keypub = Key.Keypub;
    
    // 解析密钥格式
    keyprivBin = bytesToHex(Keypriv)  
    keyprivBech32 = esecEncode(Keypriv)  
    keypubBin = Keypub 
    keypubBech32 = epubEncode(Keypub) 
    
    if (!Keypriv) {
      showNotification("请先登录。", 'warning');
      return;
    }

    const avatarContainer = document.querySelector('.avatar-container');

    await get_user_profile(Keypub,message =>{
      if (message.code == 200){
        user_profile = JSON.parse(message.data);
        title = user_profile.title || title;
        bio = user_profile.bio || bio;
        username = user_profile.displayName || username;
        avatarUrl = user_profile.avatarUrl;
        const avatarImg = avatarContainer.querySelector('img');
        if (avatarUrl) avatarImg.src = uploadpath + avatarUrl;
      }
    }) 

    await get_user_by_pubkeys([Keypub],message=>{
      if (message == "EOSE") return;
      email = message.email;
    })
    // 鼠标事件监听
    avatarContainer.addEventListener('mouseenter', () => {
      isAvatarContainerActive = true;
    });
    
    avatarContainer.addEventListener('mouseleave', () => {
      isAvatarContainerActive = false;
    });

    // 粘贴事件监听
    document.addEventListener('paste', async function(e) {
      if (isAvatarContainerActive) {
        e.preventDefault();
        const items = e.clipboardData.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              const blob = items[i].getAsFile();
              const imgUrl = URL.createObjectURL(blob);
              const avatarImg = avatarContainer.querySelector('img');
              avatarImg.src = imgUrl;
              
              const reader = new FileReader();
              reader.onload = function(event) {
                const arrayBuffer = event.target.result;
                avatarImgData = new Uint8Array(arrayBuffer);
              };
              reader.readAsArrayBuffer(blob);
              break;
            }
          }
        }
      }
    });

    // 文件选择事件
    const fileInput = document.getElementById('avatarInput');
    fileInput.addEventListener('change', function(e) {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        if (file.type.indexOf('image') !== -1) {
          const reader = new FileReader();
          reader.onload = function(e) {
            const imgUrl = e.target.result;
            const avatarImg = avatarContainer.querySelector('img');
            avatarImg.src = imgUrl;
            
            const base64Data = imgUrl.split(',')[1];
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const uint8Array = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              uint8Array[i] = binaryString.charCodeAt(i);
            }
            avatarImgData = uint8Array;
          };
          reader.readAsDataURL(file);
        } else {
          showNotification('请选择图片文件', 'error');
        }
      }
    });

    fileInput.addEventListener('click', function() {
      this.value = '';
    });
  });

  // 触发文件选择
  function triggerFileUpload() {
    document.getElementById('avatarInput').click();
  }

  // 上传文件Promise
  function uploadFilePromise(path, data, key) {
    return new Promise((resolve, reject) => {
      upload_file("user-avatar.png",avatarImgData,Keypub,Keypriv, (message) => {
        if (message[2].code == 202){
        }else if (message[2].code == 200){
          avatarUrl = message[2].fileUrl;
          resolve(message[2].code);
        } else {
          showNotification(message[2].message,2000,"warning");
        }
        
      });
    });
  }

  // 保存头像
  async function saveAvatar() {
    if (!avatarImgData) {
      showNotification('请先选择或粘贴头像图片', 'warning');
      return;
    }
    
    if (!Keypriv) {
      showNotification('请先登录', 'error');
      return;
    }
    
    const result = await uploadFilePromise( avatarImgData );
    return result;
  }

  // 保存所有设置
  async function saveAllSettings() {
    if (avatarImgData) {
      let result =  await saveAvatar();
      if (result != 200){        
        return ;
      }
    }
    let user_profile = {
      displayName : username,
      title : title,   
      bio : bio,
      avatarUrl:avatarUrl,  
    }
    save_user_profile(user_profile,Keypub,Keypriv, (message) => {
      if (message.code){
        if (message.code == 200) {
          showNotification('所有设置已保存');
          // 保存成功后显示"下面还有信息"提示
          showMoreHint = true;
          // 2秒后自动隐藏提示（可选）
         setTimeout(() => {
          window.location.reload();
          }, 2000);

        } else {
          showNotification(message.message);
        }
      }
    })
  }

  // 复制到剪贴板功能
  function copyToClipboard(text, type) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification(`${type}已复制到剪贴板`);
    }).catch(err => {
      showNotification('复制失败，请手动复制', 'error');
      console.error('复制失败:', err);
    });
  }

  // 切换私钥显示状态
  function togglePrivateKey() {
    showPrivateKey = !showPrivateKey;
  }

  // 滚动到密钥信息区域
  function scrollToKeyInfo() {
    const keySection = document.querySelector('.key-info-section');
    if (keySection) {
      keySection.scrollIntoView({ behavior: 'smooth' });
      // 滚动后隐藏提示
      showMoreHint = false;
    }
  }
</script>
<svelte:head>
    <title>个人信息</title>
</svelte:head>

<!-- 页面设置 -->
<div class="mt-8 bg-white rounded-xl shadow-sm overflow-hidden">
  <div class="border-b border-gray-200 px-6 py-4">
    <h2 class="text-xl font-bold text-gray-800">个人页面设置</h2>
    <p class="text-gray-600 text-sm">自定义您的个人主页展示</p>
  </div>

  <div class="p-6">
    <div class="max-w-3xl mx-auto">
      <!-- 头像区域 -->
      <div class="flex flex-col items-center mb-8">
        <div class="avatar-container w-40 h-40 rounded-full bg-gray-200 border-2 border-dashed overflow-hidden mb-4 cursor-pointer hover:border-primary transition-colors duration-200"
             on:click={triggerFileUpload}>
          <img src={avatarUrl ? `${uploadpath}${avatarUrl}` : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='30' r='20' fill='%23cce5ff'/%3E%3Cpath d='M10 90C10 65 30 55 50 55C70 55 90 65 90 90' fill='%23b8daff'/%3E%3C/svg%3E"} 
               alt="个人头像" 
               class="w-full h-full object-cover">
        </div>
        
        <input type="file" id="avatarInput" accept="image/*" class="hidden">
        
        <div class="flex gap-3 mb-2">
          <button on:click={triggerFileUpload} class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
            <i class="fas fa-upload mr-2"></i> 选择图片
          </button>
        </div>
        
        <p class="text-xs text-gray-500 text-center">
          支持 JPG、PNG 格式 | 建议尺寸 400×400 像素 | 可直接粘贴图片
        </p>
      </div>

      <!-- 个人信息区域 -->
      <div class="space-y-6 mb-10">
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            @
          </div>
          <div>
            <p class="text-sm text-gray-500">欢迎用户</p>
            <p class="text-base font-medium text-gray-800">{email}</p>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">用户名</label>
          <input 
            type="text" 
            bind:value={username}
            class="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" 
            maxlength="10"  
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">职业</label>
          <input 
            type="text" 
            bind:value={title}
            class="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" 
            maxlength="20"  
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">个人简介</label>
          <textarea 
            bind:value={bio}
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" 
            rows="4" 
            placeholder="介绍一下自己，让读者更了解您..."
          ></textarea>
        </div>
        
        <div class="mt-8 flex justify-end relative">
          <button on:click={saveAllSettings} class="px-6 py-2.5 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg">
            保存所有设置
          </button>
          
          <!-- 保存成功后的提示 -->
          {#if showMoreHint}
            <div class="absolute -bottom-0 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg flex items-center animate-fade-in">
              <button 
                on:click={scrollToKeyInfo}
                class="mr-2 text-primary hover:text-primary/80 transition-colors"
              >
                <i class="fas fa-chevron-down animate-bounce"></i>
              </button>
              <span> 下面还有密钥信息</span>
              <button 
                on:click={scrollToKeyInfo}
                class="ml-2 text-primary hover:text-primary/80 transition-colors"
              >
                <i class="fas fa-chevron-down animate-bounce"></i>
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- 密钥信息区域 - 添加标识类用于滚动定位 -->
      <div class="mb-10 p-5 border border-gray-200 rounded-xl bg-gray-50 key-info-section">
        <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <i class="fas fa-key text-primary mr-2"></i> 密钥信息
        </h3>
        
        <!-- 公钥区域 -->
        <div class="mb-6">
          <h4 class="text-sm font-medium text-gray-700 mb-3">公钥信息</h4>
          <div class="space-y-4">
            <!-- 公钥-普通二进制 -->
            <div class="grid grid-cols-12 gap-3 items-center">
              <div class="col-span-3 text-sm text-gray-600">普通二进制：</div>
              <div class="col-span-7 break-all text-sm bg-white p-2 rounded border border-gray-200">
                {keypubBin}
              </div>
              <div class="col-span-2">
                <button 
                  on:click={() => copyToClipboard(keypubBin, '公钥（二进制）')}
                  class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  复制
                </button>
              </div>
            </div>
            
            <!-- 公钥-bech32格式 -->
            <div class="grid grid-cols-12 gap-3 items-center">
              <div class="col-span-3 text-sm text-gray-600">Bech32格式：</div>
              <div class="col-span-7 break-all text-sm bg-white p-2 rounded border border-gray-200">
                {keypubBech32}
              </div>
              <div class="col-span-2">
                <button 
                  on:click={() => copyToClipboard(keypubBech32, '公钥（Bech32）')}
                  class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  复制
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 私钥区域 -->
        <div>
          <h4 class="text-sm font-medium text-gray-700 mb-3 flex items-center">
            私钥信息 
            <span class="ml-2 text-xs text-amber-600">
              <i class="fas fa-exclamation-circle"></i> 请妥善保管
            </span>
          </h4>
          <div class="space-y-4">
            <!-- 私钥-普通二进制 -->
            <div class="grid grid-cols-12 gap-3 items-center">
              <div class="col-span-3 text-sm text-gray-600">普通二进制：</div>
              <div class="col-span-5 break-all text-sm bg-white p-2 rounded border border-gray-200">
                {showPrivateKey ? keyprivBin : '*******************************'}
              </div>
              <div class="col-span-2">
                <button 
                  on:click={togglePrivateKey}
                  class="text-xs px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors"
                >
                  {showPrivateKey ? '隐藏' : '显示'}
                </button>
              </div>
              <div class="col-span-2">
                <button 
                  on:click={() => copyToClipboard(keyprivBin, '私钥（二进制）')}
                  class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  disabled={!showPrivateKey}
                >
                  复制
                </button>
              </div>
            </div>
            
            <!-- 私钥-bech32格式 -->
            <div class="grid grid-cols-12 gap-3 items-center">
              <div class="col-span-3 text-sm text-gray-600">Bech32格式：</div>
              <div class="col-span-5 break-all text-sm bg-white p-2 rounded border border-gray-200">
                {showPrivateKey ? keyprivBech32 : '*******************************'}
              </div>
              <div class="col-span-2">
                <button 
                  on:click={togglePrivateKey}
                  class="text-xs px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors"
                >
                  {showPrivateKey ? '隐藏' : '显示'}
                </button>
              </div>
              <div class="col-span-2">
                <button 
                  on:click={() => copyToClipboard(keyprivBech32, '私钥（Bech32）')}
                  class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  disabled={!showPrivateKey}
                >
                  复制
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

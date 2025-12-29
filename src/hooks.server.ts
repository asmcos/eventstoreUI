import { get_books, get_blogs, get_users_profile } from "$lib/esclient";
import type { Handle } from '@sveltejs/kit';

// 全局缓存
let cachedBooks: any[] = [];
let cachedBlogs: any[] = [];
let users_profile: Record<string, any> = {};

// 控制变量
let lastUpdatedTime = 0; // 最后更新时间（时间戳）
let isUpdating = false; // 更新锁：防止并发更新
const UPDATE_INTERVAL = 5000; // 最小更新间隔（5秒）

// 工具函数：从tags中提取值
function getTagValue(tags: any[], key: string) {
  const targetTag = tags.find(tag => Array.isArray(tag) && tag[0] === key);
  return targetTag ? targetTag[1] : null;
}

// 包装回调式API为Promise，便于异步控制
function getBooksPromise(start: number, limit: number) {
  return new Promise<any[]>((resolve) => {
    const temp: any[] = [];
    get_books(null, start, limit, (e: any) => {
      if (e === "EOSE") {
        resolve(temp); // 结束时返回收集的数据
      } else if (e) {
        // 处理单条数据
        if (getTagValue(e.tags, 'd')) {
          e.id = getTagValue(e.tags, 'd');
        }
        temp.push(e);
      }
    });
  });
}

function getBlogsPromise(start: number, limit: number) {
  return new Promise<{ blogs: any[], userPubkeys: string[] }>((resolve) => {
    const tempBlogs: any[] = [];
    const userPubkeys: string[] = [];
    get_blogs(null, 0, start, limit, (message: any) => {
      if (message === "EOSE") {
        resolve({ blogs: tempBlogs, userPubkeys });
      } else if (message) {
        message.data = JSON.parse(message.data);
        if (getTagValue(message.tags, 'd')) {
          message.id = getTagValue(message.tags, 'd');
        }
        // 收集不重复的用户pubkey
        if (message.user && !userPubkeys.includes(message.user)) {
          userPubkeys.push(message.user);
        }
        tempBlogs.push(message);
      }
    });
  });
}

function getUsersProfilePromise(pubkeys: string[]) {
  return new Promise<Record<string, any>>((resolve) => {
    const profiles: Record<string, any> = {};
    if (pubkeys.length === 0) {
      resolve(profiles);
      return;
    }
    get_users_profile(pubkeys, (message: any) => {
      if (message === "EOSE") {
        resolve(profiles);
      } else if (message) {
        message.data = JSON.parse(message.data);
        profiles[message.user] = message;
      }
    });
  });
}

// 安全的更新函数：带锁和节流
async function safeUpdateDatas() {
  const now = Date.now();
  // 检查是否正在更新或未到更新时间
  if (isUpdating || (now - lastUpdatedTime < UPDATE_INTERVAL)) {
    return; // 直接退出，不执行更新
  }
 
  isUpdating = true; // 上锁
  try {
    console.log("开始更新数据...");

    // 1. 并行加载书籍和博客（提高效率）
    const [newBooks, { blogs: newBlogs, userPubkeys }] = await Promise.all([
      getBooksPromise(0, 4),
      getBlogsPromise(0, 3)
    ]);

    // 2. 加载用户资料（依赖博客中的用户pubkey）
    const newProfiles = await getUsersProfilePromise(userPubkeys);

    // 3. 原子更新全局缓存（一次性替换，避免中间状态）
    cachedBooks = newBooks;
    cachedBlogs = newBlogs;
    users_profile = newProfiles;

    // 4. 更新最后更新时间
    lastUpdatedTime = now;
    console.log("数据更新完成");
    

  } catch (error) {
    console.error("数据更新失败：", error);
    // 失败时不更新缓存，保留旧数据
  } finally {
  }
  isUpdating = false; // 解锁（无论成功失败都要释放）
}

// 初始化：服务启动时执行一次
safeUpdateDatas();

export const handle: Handle = async ({ event, resolve }) => {
  // 每次请求时尝试更新（会被节流控制）
  safeUpdateDatas(); // 非阻塞调用，不影响请求响应速度

  // 将缓存数据挂载到locals，供页面使用
  event.locals.books = cachedBooks;
  event.locals.blogs = cachedBlogs;
  event.locals.users_profile = users_profile;

  const response = await resolve(event);
  return response;
};

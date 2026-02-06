import { get_blogs, get_users_profile, blog_counts, get_browselog_count } from "$lib/esclient";

let cachedBlogs = [];
let users_profile = {};

// 控制变量
let lastUpdatedTime = 0; // 最后更新时间（时间戳）
let isUpdating = false; // 更新锁：防止并发更新
const UPDATE_INTERVAL = 5000; // 最小更新间隔（5秒）
let pageSize = 10;

// 工具函数：从tags中提取值
function getTagValue(tags, key) {
  const targetTag = tags.find(tag => Array.isArray(tag) && tag[0] === key);
  return targetTag ? targetTag[1] : null;
}

function getBlogsPromise(start, limit) {
  return new Promise((resolve) => {
    const tempBlogs = [];
    const userPubkeys = [];
    get_blogs(null, 0, start, limit, (message) => {
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

function getUsersProfilePromise(pubkeys) {
  return new Promise((resolve) => {
    const profiles = {};
    if (pubkeys.length === 0) {
      resolve(profiles);
      return;
    }
    get_users_profile(pubkeys, (message) => {
      if (message === "EOSE") {
        resolve(profiles);
      } else if (message) {
        message.data = JSON.parse(message.data);
        profiles[message.user] = message;
      }
    });
  });
}

function getBrowselogsPromise(ids) {
  return new Promise((resolve) => {
    const Logs = {};
    if (ids.length === 0) {
      resolve(Logs);
      return;
    }
    get_browselog_count(ids, (message) => {
      if (message === "EOSE") {
        resolve(Logs);
      } else if (message) {
        if (message.code == 200) {
          message.counts.map(count => {
            Logs[count.targetId] = count.count;
          });
        }
      }
    });
  });
}

function getTotalPages(){
  return new Promise((resolve) => {
    blog_counts("",(message) =>{
      let blogTotalCount;
      let totalPages;
      
      if (message.code == 200) {
        blogTotalCount = message.counts;
        totalPages =  Math.ceil(blogTotalCount / pageSize) || 1;
        resolve(totalPages);
      }
      if (message === "EOSE") {
        resolve(0);
      }
    })
  })
}

export async function load({ url }) {

  const currentPage = parseInt(url.searchParams.get('page')) || 1;

  
  const [blogsResult] = await Promise.all([
    getBlogsPromise((currentPage - 1) * pageSize, currentPage * 10)
  ]);
  const { userPubkeys } = blogsResult; // 从结果中提取userPubkeys

  const newProfiles = await getUsersProfilePromise(userPubkeys);
  const totalPages  = await getTotalPages();

  const ids = blogsResult.blogs.map(b => b.id);
  const browselogs = ids.length ? await getBrowselogsPromise(ids) : {};
  
  return {
    blogs: blogsResult.blogs,
    users_profile: newProfiles,
    currentPage: currentPage,
    totalPages: totalPages,
    browselogs,
  };
}

 
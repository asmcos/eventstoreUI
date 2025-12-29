import { get_blogs, get_users_profile } from "$lib/esclient";

let cachedBlogs = [];
let users_profile = {};

// 控制变量
let lastUpdatedTime = 0; // 最后更新时间（时间戳）
let isUpdating = false; // 更新锁：防止并发更新
const UPDATE_INTERVAL = 5000; // 最小更新间隔（5秒）

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

export async function load({ url }) {

  const [blogsResult] = await Promise.all([
    getBlogsPromise(0, 10)
  ]);
  const { userPubkeys } = blogsResult; // 从结果中提取userPubkeys

  const newProfiles = await getUsersProfilePromise(userPubkeys);


  return {
    // 可根据需要返回数据，例如：
     blogs: blogsResult.blogs,
     users_profile: newProfiles
  };
}

 
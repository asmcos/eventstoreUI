import { get_users_profile } from "./esclient";
import { WebStorage } from "./WebStorage";


let store ; 
//4 天
const DEFAULT_PROFILE_EXPIRE =  4 * 24 * 60 * 60 * 1000;
const PROFILE_KEY_PREFIX = "user_profile_";

function save_user_profile(pubkey, profile, expireTime = DEFAULT_PROFILE_EXPIRE) {
  if (!pubkey || !profile) return;

  const cacheData = {
    profile: profile,
    expireAt: Date.now() + expireTime,
    saveAt: Date.now()
  };

  const finalKey = `${PROFILE_KEY_PREFIX}${pubkey}`;
  store.set(finalKey, JSON.stringify(cacheData));
}

function get_user_profile(pubkey) {
  if (!pubkey) return null;

  const finalKey = `${PROFILE_KEY_PREFIX}${pubkey}`;
  let cacheData = store.get(finalKey);

 
  if (!cacheData) return null;

 
  cacheData = JSON.parse(cacheData);
  const now = Date.now();
  if (now > cacheData.expireAt) {
    store.remove(finalKey);
    return null;
  }

  return cacheData.profile;
}

function clear_expired_user_profiles() {
  try {
    const allKeys = store.keys ? store.keys() : Object.keys(localStorage);

    allKeys.forEach(key => {
      if (!key.startsWith(PROFILE_KEY_PREFIX)) return;

      const cacheData = store.get(key);
      if (!cacheData || !cacheData.expireAt) return;

      if (Date.now() > cacheData.expireAt) {
        store.remove(key);
      }
    });
  } catch (error) {
    console.error("清理过期用户Profile失败：", error);
  }
}

function clear_exceed_user_profiles(maxCount = 100) {
  try {
    const allKeys = store.keys ? WebStostorerage.keys() : Object.keys(localStorage);
    const profileKeys = [];

    allKeys.forEach(key => {
      if (!key.startsWith(PROFILE_KEY_PREFIX)) return;

      const cacheData = store.get(key);
      if (cacheData && cacheData.saveAt) {
        profileKeys.push({
          key: key,
          saveAt: cacheData.saveAt
        });
      }
    });

    if (profileKeys.length <= maxCount) return;

    profileKeys.sort((a, b) => a.saveAt - b.saveAt);
    const needDeleteKeys = profileKeys.slice(0, profileKeys.length - maxCount);

    needDeleteKeys.forEach(item => {
        store.remove(item.key);
    });
  } catch (error) {
    console.error("清理超出数量的用户Profile失败：", error);
  }
}

function store_get_users_profile(pubkeys, callback) {
    
  if (!Array.isArray(pubkeys) || pubkeys.length === 0) {
    callback("EOSE");
    return;
  }

  if (!store) store = new WebStorage(localStorage);

  let needRemotePubkeys = [];

  pubkeys.forEach(pubkey => {
    const localProfile = get_user_profile(pubkey);
    
    if (localProfile) {
      callback({
        pubkey: pubkey,
        data: localProfile,
      });
    } else {
      needRemotePubkeys.push(pubkey);
    }
  });

  if (needRemotePubkeys.length === 0) {
    callback("EOSE");
    return;
  }

 
  get_users_profile(needRemotePubkeys, (remoteMessage) => {
    if (remoteMessage === "EOSE") {
      callback("EOSE");
      return;
    }

    remoteMessage.data = JSON.parse(remoteMessage.data);

    const userPubkey  =  remoteMessage.user;
    const userProfile =  remoteMessage.data  
   
    save_user_profile(userPubkey, userProfile);
    callback({
        pubkey: userPubkey,
        data: userProfile,
    });
    
  });
}

export {
 
  store_get_users_profile,
  clear_expired_user_profiles,
  clear_exceed_user_profiles
};
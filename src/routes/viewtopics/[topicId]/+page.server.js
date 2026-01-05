import { get_topic_id, get_topic_shortid, get_topic_posts } from "$lib/esclient";
import { createRenderer } from "$lib/render";

let md;
let rawtopicId = null;
let users_pubkey = [];

function getTagValue(tags, t) {
  const dTag = tags.find(tag => Array.isArray(tag) && tag[0] === t);
  return dTag ? dTag[1] : null;
}

export async function load({ params }) {

  
  try {
    const { topicId } = params;
    let s_userid = null, s_topicid = null;
    rawtopicId = null;
    
    
    
    if (topicId.includes('-')) {
      [s_userid, s_topicid] = topicId.split('-');
       
    } else {
      rawtopicId = topicId;
       
    } 
     
    md = await createRenderer();

    let topicData = null;
    let postsData = [];
    
    // 使用Promise包装异步操作，等待topic内容返回
    if (rawtopicId) {
      // 使用完整ID获取topic
      topicData = await new Promise((resolve, reject) => {
        get_topic_id(
          rawtopicId,
          (message) => {
             
            if (message && message.code === 200) {
              resolve(parseTopicData(message));
            } else if (message === "EOSE") {
              // EOSE表示流结束，如果还没收到数据，可能topic不存在
              if (!topicData) {
                resolve(null);
              }
            } else if (message === "ERROR") {
              reject(new Error('获取topic失败'));
            }
          }
        );
      });
    } else if (s_userid && s_topicid) {
      // 使用短ID获取topic
      topicData = await new Promise((resolve, reject) => {
        get_topic_shortid(
          s_userid,
          s_topicid,
          (message) => {
           
            if (message && message.code === 200) {
              resolve(parseTopicData(message));
            } else if (message === "EOSE") {
              if (!topicData) {
                resolve(null);
              }
            } else if (message === "ERROR") {
              reject(new Error('获取topic失败'));
            }
          }
        );
      });
    }
    
    if (!topicData) {
      return {
        status: 404,
        error: 'Topic not found'
      };
    }
    

 
    // 获取topic的posts/replies
    const posts = await new Promise( (resolve) => {
      const postsList = [];
      get_topic_posts(
        topicData.id,
        0,10,
        async (message) => {
          console.log('get_topic_posts返回:', message);
          if (message && message.code === 200) {
            const post = await  parsePostData(message);
            if (post) {
              postsList.push(post);
            }
          } else if (message === "EOSE") {
            // 按时间排序，最新的在前面
            postsList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            resolve(postsList);
          }
        }
      );
    });
    


    
    // 渲染topic内容
    let renderedContent = '';
    if (topicData.content && md) {
      try {
        renderedContent = await md.render(topicData.content || '');
      } catch (error) {
        console.error('渲染markdown失败:', error);
        renderedContent = topicData.content || '';
      }
    } else {
      renderedContent = topicData.content || '';
    }

    
    return {
 
        topic: {
          ...topicData,
          renderedContent,
          tags: topicData.tags || []
        },
        posts: posts,
        topicId:rawtopicId,
        users_pubkey,
        
    };
    
  } catch (error) {
    console.error('加载topic详情失败:', error);
    return {
      status: 500,
      error: error.message || 'Failed to load topic'
    };
  }
}

// 解析topic数据
async function parseTopicData(event) {
  try {
    let data = {};
    try {
      data = JSON.parse(event.data || '{}');
    } catch (e) {
      console.warn('解析topic data失败:', e);
    }
    
    if (!users_pubkey.includes(event.user)) {
        users_pubkey.push(event.user);
        
    }
    const tags = event.tags || [];
    rawtopicId = getTagValue(event.tags,'d');
    return {
      id: rawtopicId,
      
      user: event.user,
      title: data.title || '无标题',
      content: data.content || '',
      labels:event.labels,
      is_sticky: getTagValue(tags, 'sticky') === 'true',
      created_at: event.created_at ? new Date(event.created_at * 1000).toISOString() : new Date().toISOString(),
      tags: tags,
      rawEvent: event
    };
  } catch (error) {
    console.error('解析topic数据失败:', error);
    return null;
  }
}

// 解析post/reply数据
async function parsePostData(event) {
  try {
 
    const tags = event.tags || [];
    
    if (!users_pubkey.includes(event.user)) {
        users_pubkey.push(event.user);   
    }
    let content = await md.render(event.data);
    return {
      id: event.id,
      
      user: event.user,
      content: content,
      reply_to: getTagValue(tags, 'pid'), // 回复的event id
      reply_root: getTagValue(tags, 'topicid'), // 根主题id
      created_at: event.created_at ? new Date(event.created_at * 1000).toISOString() : new Date().toISOString(),
      tags: tags,
      rawEvent: event
    };
  } catch (error) {
    console.error('解析post数据失败:', error);
    return null;
  }
}
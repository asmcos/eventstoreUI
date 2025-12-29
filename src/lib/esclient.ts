import {esserver} from "./config"

import {    
    generateSecretKey,
    getPublicKey,
    verifyEvent,
    esecEncode,
    esecDecode,
    epubEncode,
    epubDecode,
    secureEvent,
    hashMessage} from "eventstore-tools/src/key";





import {WebSocketClient } from "eventstore-tools/src/WebSocketClient";

let client =  new WebSocketClient(esserver);

function getId(tempEvent){
  return hashMessage(JSON.stringify(tempEvent))
}

export async function get_event(eventid,showLogs=0,callback){
  await client.connect().catch(error => {});

  let event = {    
      "ops": "R",
      "code": 203,
      showLogs:showLogs,
      eventid,
    }
    
    client.subscribe( event ,function(message){
       
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      else callback(message[2])
    });      
}

export async function create_user(email,pubkey,privkey,callback){
    await client.connect().catch(error => {});

    let event = {
    
        "ops": "C",
        "code": 100,
        "user": pubkey,
        "data": {
          "email": email,
        }
      }
    client.publish(secureEvent(event,privkey),function(message){
        callback(message);
    });  
}

export async function get_events(pubkey,privkey,offset,limit,callback){
    await client.connect().catch(error => {});

    let event = {    
        "ops": "R",
        "code": 203,
        "user": pubkey,
        "status":0,
        "eventcode":0,
        'offset':offset,
        'limit':limit,
      }
      client.subscribe(secureEvent(event,privkey),function(message){
         
        if (message[2] == "EOSE") client.unsubscribe(message[1]);
        else callback(message[2])
      });      
}

export async function get_users(offset,limit,callback){
    await client.connect().catch(error => {});

    let event = {    
        "ops": "R",
        "code": 103,
        offset,
        limit
      }
      client.subscribe(event,function(message){
         
        if (message[2] == "EOSE") client.unsubscribe(message[1]);
        
        callback(message[2])
      });      
}


export async function get_user_by_email(email,callback){
  await client.connect().catch(error => {});

  let event = {    
      "ops": "R",
      "code": 103,
      email      
    }
    client.subscribe(event,function(message){
       
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
     
      callback(message[2])
 
      
    });      
}

export async function get_user_by_pubkeys(pubkeys,callback){
  await client.connect().catch(error => {});

  let event = {    
      "ops": "R",
      "code": 103,
      "data":{"pubkeys":pubkeys}      
    }
    client.subscribe(event,function(message){
       
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      
      callback(message[2])
       
    });      
}

export async function get_permissions(pubkeys,callback){
    await client.connect().catch(error => {});

    let event = {    
        "ops": "R",
        "code": 303,
        "data":{"pubkeys":pubkeys}
      }
      client.subscribe(event,function(message){
         
        if (message[2] == "EOSE") client.unsubscribe(message[1]);
        else callback(message[2])
      });      
}

export async function add_permission(data,adminpubkey,adminprivkey,callback){
  await client.connect().catch(error => {});

  let event = {
    
    "ops": "C",
    "code": 300,
  }
  event.data = data;  
  event.user = adminpubkey;

  client.publish(secureEvent(event,adminprivkey),function(message){

      if (message[2] != "EOSE") callback(message[2]);
      
  });      
}

export async function delete_user(user,adminpubkey,adminprivkey,callback){
  await client.connect().catch(error => {});

  let event = {    
    "ops": "D",
    "code": 102,
  }
  event.user = adminpubkey;
  event.data = {pubkey:user}
  client.publish(secureEvent(event,adminprivkey),function(message){     
        if (message[2] != "EOSE") callback(message[2])
  }); 
}

export async function delete_event(eventid,adminpubkey,adminprivkey,callback){
  await client.connect().catch(error => {});

  let event = {    
    "ops": "D",
    "code": 202,
  }
  event.user = adminpubkey;
  event.data = {eventid:eventid}
  client.publish(secureEvent(event,adminprivkey),function(message){     
        if (message[2] != "EOSE") callback(message[2])
  }); 
}

function asyncPublish(client, sevent) {
  return new Promise((resolve, reject) => {
    client.publish(sevent, function (message) {
      resolve(message);  // 等待服务器回包
    });
  });
}

export async function upload_file(filename,fileData,pubkey,privkey,callback){
  await client.connect().catch(error => {});

   
  const event = {
    "ops": "C",
    "code": 400,
    "user": pubkey,
    "data": {
        fileName: filename,  // 生成一个临时文件名
    },
    "tags": [['t','upload_file']]
  };
  const sevent = secureEvent(event,privkey);

  const DATATYPE =  {
      START: 1,      // 开始（元数据）
      CHUNK: 2,      // 中间数据块
      END: 4,        // 结束
      
  };

  const CHUNK_SIZE = 65536 * 10; // 每片大小，例如640KB
  const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);
   
  sevent.data.fileData = {
    type:DATATYPE.START,
  }
 
  await asyncPublish(client,sevent) ;

 
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileData.length);
      const chunk = fileData.slice(start, end);

      sevent.data.fileData = {
            type:DATATYPE.CHUNK,
            buffer: chunk};
      
      await asyncPublish(client,sevent) ;
      callback([0,1,{code:202,message:`${chunkIndex}/${totalChunks}`}] );

  }

  sevent.data.fileData = {
    type:DATATYPE.END,
  }
 
  client.publish(sevent,function(message){
    callback(message);
  });

}
/*
* book 操作区域
*
*/

export async function create_book(bookInfo,pubkey,privkey,callback){
  await client.connect().catch(error => {});

  let bookId = getId({pubkey,time:Math.floor(Date.now())})
 

  let event = {
  
      "ops": "C",
      "code": 200,
      "user": pubkey,
      "data": bookInfo,
      "tags":[ ['t','create_book'],['web','esbook'],['d',bookId]]
    }
  
  if (bookInfo.labels) event.labels = bookInfo.labels;
  if (bookInfo.coAuthors) event.coAuthors = bookInfo.coAuthors;

  let sevent = secureEvent(event,privkey);


  callback({code:201,id:bookId})
  client.publish(sevent,function(message){
      callback(message[2]);
  });  
}

export async function book_counts(pubkey,callback){
  await client.connect().catch(error => {});

  let event = { 
    "ops": "R",
    "code": 204,

    "tags":[['t','create_book'], ]
  }
  
  if (pubkey) event.eventuser = pubkey;

  client.subscribe(event,function(message){
    if (message[2] == "EOSE") client.unsubscribe(message[1]);
    
    callback(message[2])
  });  
}

function get_book_id(bookid,callback);

export async function update_book(bookInfo,bookid,pubkey,privkey,callback){
  await client.connect().catch(error => {});

  get_book_id(bookid,async function(msg){

    if (msg == "EOSE") return ;

    if (msg.user != pubkey){
      callback({"code":403,"message":"只有原作者才有权限修改"});
    }

    await delete_event(bookid,pubkey,privkey,function(e){});

    let event = {
    
        "ops": "C",
        "code": 200,
        "user": pubkey,
        "data": bookInfo,
        "tags":[ ['t','create_book'],['web','esbook'],['d',bookid]]
      }
    if (bookInfo.labels) event.labels = bookInfo.labels; 
    if (bookInfo.coAuthors) event.coAuthors = bookInfo.coAuthors; 
    
    let sevent = secureEvent(event,privkey);
   
    client.publish(sevent,function(message){
        callback(message[2]);
    });  

  }) 


}

export async function get_books(pubkey,offset=0,limit=10,callback){
  
  await client.connect().catch(error => {});
  
 

  let event = {
  
      "ops": "R",
      "code": 203,
      "limit":limit,
      "offset":offset,
      "tags":[ ['t','create_book'],['web','esbook']]
    }

  if (pubkey) event.eventuser = pubkey;

  client.subscribe(event,function(message){
         
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      
      callback(message[2])
    }); 
}

export async function get_book_id(bookid,callback){
  
  await client.connect().catch(error => {});
  
 

  let event = 
    {
  
      "ops": "R",
      "code": 203,
      "tags":[ ['t','create_book'],['web','esbook'],['d',bookid]],
    }
  client.subscribe(event,function(message){
         
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      
      callback(message[2])
    }); 
}

export async function get_book_shortid(s_userid,s_bookid,callback){
  
  await client.connect().catch(error => {});
  

  let event = 
    {
  
      "ops": "R",
      "code": 203,
      "eventuser": { "$regex": `^${s_userid}` },
      "tags": 
          [
              { $elemMatch: { "0": "d", "1":  { "$regex": `^${s_bookid}` } } },
              { $elemMatch: { "0": "t", "1": "create_book" } },
              { $elemMatch: { "0": "web", "1": "esbook" } }
          ]
      ,
    }

  client.subscribe(event,function(message){
         
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      
      callback(message[2])
    }); 
}



export async function create_chapter_log(bookId,content,name,pubkey,privkey,callback){
  await client.connect().catch(error => {});

  let event = {
  
      "ops": "C",
      "code": 200,
      "user": pubkey,
      "data": content,
      "tags":[ ['t','create_chapter_log'],['web','esbook'],['bid',bookId],['n',name]]
    }
  let sevent = secureEvent(event,privkey);
  client.publish(sevent,function(message){
      callback(message[2]);
  });  
}

export async function create_chapter(bookId,content,name,pubkey,privkey,callback){
  await client.connect().catch(error => {});

  let event = {
  
      "ops": "C",
      "code": 200,
      "user": pubkey,
      "data": content,
      "tags":[ ['t','create_chapter'],['web','esbook'],['bid',bookId],['d',bookId+'_'+name]]
    }
  let sevent = secureEvent(event,privkey);
  client.publish(sevent,function(message){
      callback(message[2]);
  }); 
  
  await create_chapter_log(bookId,{chapterEventid:sevent.id},name,pubkey,privkey,function(message){

  })
}




export async function get_chapter(bookId,name,callback){
  await client.connect().catch(error => {});

  let event = { 
      "ops": "R",
      "code": 203,
      "tags":[ ['t','create_chapter'],['web','esbook'],['bid',bookId]]
    }
  if (name){
    event.tags.push(['d',bookId+'_'+name])
  }

  
  client.subscribe(event,function(message){
         
    if (message[2] == "EOSE") client.unsubscribe(message[1]);
    
    callback(message[2])
  });  
}

export async function get_chapter_author(bookId,name,author_pubkey,callback){
  await client.connect().catch(error => {});

  let event = { 
      "ops": "R",
      "eventuser": author_pubkey,
      "code": 203,
      "tags":[ ['t','create_chapter'],['web','esbook'],['bid',bookId]]
    }
  if (name){
    event.tags.push(['d',bookId+'_'+name])
  }

  
  client.subscribe(event,function(message){
         
    if (message[2] == "EOSE") client.unsubscribe(message[1]);
    
    callback(message[2])
  });  
}

export async function get_chapter_update_logs(bookId,offset=0,limit=10,callback){
  await client.connect().catch(error => {});

  let event = { 
      "ops": "R",
      "code": 203,
      limit,
      offset,
      "tags":[ ['t','create_chapter_log'],['web','esbook'],['bid',bookId]],
    }
 
  
  client.subscribe(event,function(message){
         
    if (message[2] == "EOSE") client.unsubscribe(message[1]);
    
    callback(message[2])
  });  
}

export async function like_book(bookId,pubkey,privkey,callback){
  await client.connect().catch(error => {});

  let event = {
  
      "ops": "C",
      "code": 600,
      "user": pubkey,
      "data": '',
      "tags":[ ['t','like_book'],['bid',bookId]]
    }
  let sevent = secureEvent(event,privkey);
  client.publish(sevent,function(message){
      callback(message[2]);
  }); 
}

export async function get_book_like(bookId,pubkey,callback){
  await client.connect().catch(error => {});

  let event = {
  
      "ops": "R",
      "code": 603,
      "eventuser": pubkey,
      "tags":[ ['t','like_book'],['bid',bookId]]
    }
  
  client.subscribe(event,function(message){
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      callback(message[2]);
  }); 
}

export async function get_book_like_counts(bookId,callback){
  await client.connect().catch(error => {});

  let event = {
  
      "ops": "R",
      "code": 604,
      "tags":[ ['t','like_book'],['bid',bookId],["liked",1]]
    }
  
  client.subscribe(event,function(message){
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      callback(message[2]);
  }); 
}


export async function comment_book(bookId,pubkey,privkey,content,callback){
  await client.connect().catch(error => {});

  let event = {
  
      "ops": "C",
      "code": 500,
      "user": pubkey,
      "data": content,
      "tags":[ ['t','comment_book'],['bid',bookId], ]
    }
  let sevent = secureEvent(event,privkey);
  client.publish(sevent,function(message){
      callback(message[2]);
  }); 
}

export async function get_book_comments(bookId,callback){
  await client.connect().catch(error => {});

  let event = {
  
      "ops": "R",
      "code": 503,
      "tags":[ ['t','comment_book'],['bid',bookId]]
    }
  
  client.subscribe(event,function(message){
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      callback(message[2]);
  }); 
}

export async function get_book_comment_counts(bookId,callback){
  await client.connect().catch(error => {});

  let event = {
  
      "ops": "R",
      "code": 504,
      "tags":[ ['t','comment_book'],['bid',bookId]]
    }
  
  client.subscribe(event,function(message){
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      callback(message[2]);
  }); 
}


export async function user_counts(callback){
  await client.connect().catch(error => {});

  let event = { 
    "ops": "R",
    "code": 104,
  }
  client.subscribe(event,function(message){
    if (message[2] == "EOSE") client.unsubscribe(message[1]);
    
    callback(message[2])
  });  
}

export async function event_counts(callback){
  await client.connect().catch(error => {});

  let event = { 
    "ops": "R",
    "code": 204,
  }
  client.subscribe(event,function(message){
    if (message[2] == "EOSE") client.unsubscribe(message[1]);
    
    callback(message[2])
  });  
}

/*
 * 用户 profile操作区域
 */
export async function save_user_profile(profile,pubkey,privkey,callback){
  await client.connect().catch(error => {});

  let event = {
  
    "ops": "C",
    "code": 200,
    "user": pubkey,
    "data": JSON.stringify(profile),
    "tags":[ ['d','profile'] ]
  }
  let sevent = secureEvent(event,privkey);
  client.publish(sevent,function(message){
      if (message[2] != "EOSE")
        callback(message[2]);
  });

}

export async function get_user_profile(pubkey,callback){
  await client.connect().catch(error => {console.log(error)});
 
 
  let event = {
  
    "ops": "R",
    "code": 203,
    "eventuser": pubkey,
    "tags":[ ['d','profile'] ]
  }
  
  client.subscribe(event,function(message){
  
    if (message[2] == "EOSE") client.unsubscribe(message[1]);
    else callback(message[2])
  });

}

export async function get_users_profile(pubkeys,callback){
  await client.connect().catch(error => {});

  let event = {    
      "ops": "R",
      "code": 203,
      "data":{"pubkeys":pubkeys},
      "tags":[ ['d','profile'] ]
    }
    client.subscribe(event,function(message){
       
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      
      callback(message[2])
    });      
}


/*
 *
 * blog  操作区域
 *  
 */
export async function create_blog(blogData,pubkey,privkey,callback){
  await client.connect().catch(error => {});

  let isDraft = false;

  let blogId ;
  blogData = JSON.parse(blogData);

  if (blogData.blogId) { 
    blogId = blogData.blogId;
    delete blogData.blogId;

  } else {
    blogId =  getId({pubkey,time:Math.floor(Date.now())})
  }


  let event = {
  
      "ops": "C",
      "code": 200,
      "user": pubkey,
      "data": JSON.stringify(blogData),
      "tags":[ ['t','create_blog'], ['d',blogId],
               ['s', isDraft ? 'draft' : 'published']  // 新增状态标签
            ]
    }
  if (blogData.labels) event.labels = blogData.labels; 

  
  let sevent = secureEvent(event,privkey);
  callback({code:201,id:blogId})

  client.publish(sevent,function(message){
      callback(message[2]);
  });  
}

export async function get_blog_id(blogid,callback){
  
  await client.connect().catch(error => {});
  
  let event = {
      "ops": "R",
      "code": 203,
      "tags":[ ['t','create_blog'], ['d',blogid]],
      
    }
 
  client.subscribe(event,function(message){
         
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      
      callback(message[2])
    }); 
}


export async function get_blog_shortid(s_userid,s_blogid,callback){
  
  await client.connect().catch(error => {});
  

  let event = 
    {
  
      "ops": "R",
      "code": 203,
      "eventuser": { "$regex": `^${s_userid}` },
      "tags": 
           [
              { $elemMatch: { "0": "d", "1":  { "$regex": `^${s_blogid}` } } },
              { $elemMatch: { "0": "t", "1": "create_blog" } }    
          ]
       ,
    }

  client.subscribe(event,function(message){
         
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      
      callback(message[2])
    }); 
}


export async function get_blogs(pubkey,isDraft=1,offset=0,limit=10,callback){
  
  await client.connect().catch(error => {});
  
  let event = {
      "ops": "R",
      "code": 203,
      "limit":limit,
      "offset":offset,
      "tags":[ ['t','create_blog'], ],
    };
  if (isDraft == 1)
    event.tags.push(['s', 'draft'])
  
  if (isDraft == 2)
    event.tags.push(['s', 'published'])

  // isDraft 是其他值，就不填写 status标志，也就是查询所有的。例如 isDraft=0;

  if (pubkey) event['eventuser'] = pubkey;

  
  client.subscribe(event,function(message){
         
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      
      callback(message[2])
    }); 
}

export async function blog_counts(pubkey,callback){
  await client.connect().catch(error => {});

  let event = { 
    "ops": "R",
    "code": 204,
    "tags":[['t','create_blog'], ]
  }
  if (pubkey) event.eventuser = pubkey;

  client.subscribe(event,function(message){
    if (message[2] == "EOSE") client.unsubscribe(message[1]);
    
    callback(message[2])
  });  
}

/*
 * blog 点赞和评论操作区域
 */
export async function like_blog(blogId, pubkey, privkey, callback) {
  await client.connect().catch(error => {});

  let event = {
      "ops": "C",
      "code": 600,
      "user": pubkey,
      "data": '',
      "tags": [['t', 'like_blog'], ['bid', blogId]]
    }
  let sevent = secureEvent(event, privkey);
  client.publish(sevent, function(message) {
      callback(message[2]);
  }); 
}

export async function get_blog_like(blogId, pubkey, callback) {
  await client.connect().catch(error => {});

  let event = {
      "ops": "R",
      "code": 603,
      "eventuser": pubkey,
      "tags": [['t', 'like_blog'], ['bid', blogId]]
    }
  
  client.subscribe(event, function(message) {
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      callback(message[2]);
  }); 
}

export async function get_blog_like_counts(blogId, callback) {
  await client.connect().catch(error => {});

  let event = {
      "ops": "R",
      "code": 604,
      "tags": [['t', 'like_blog'], ['bid', blogId], ["liked", 1]]
    }
  
  client.subscribe(event, function(message) {
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      callback(message[2]);
  }); 
}

export async function comment_blog(blogId, pubkey, privkey, content, callback) {
  await client.connect().catch(error => {});

  let event = {
      "ops": "C",
      "code": 500,
      "user": pubkey,
      "data": content,
      "tags": [['t', 'comment_blog'], ['bid', blogId]]
    }
  let sevent = secureEvent(event, privkey);
  client.publish(sevent, function(message) {
      callback(message[2]);
  }); 
}

export async function get_blog_comments(blogId, callback) {
  await client.connect().catch(error => {});

  let event = {
      "ops": "R",
      "code": 503,
      "tags": [['t', 'comment_blog'], ['bid', blogId]]
    }
  
  client.subscribe(event, function(message) {
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      callback(message[2]);
  }); 
}

export async function get_blog_comment_counts(blogId, callback) {
  await client.connect().catch(error => {});

  let event = {
      "ops": "R",
      "code": 504,
      "tags": [['t', 'comment_blog'], ['bid', blogId]]
    }
  
  client.subscribe(event, function(message) {
      if (message[2] == "EOSE") client.unsubscribe(message[1]);
      callback(message[2]);
  }); 
}
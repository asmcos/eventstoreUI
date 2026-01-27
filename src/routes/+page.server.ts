 
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // 从 locals 中获取 hooks 中设置的数据
  return {
    books: locals.books, // 
    blogs: locals.blogs, //
    users_profile:locals.users_profile,  
    browselogs:locals.browselogs,
  };
};
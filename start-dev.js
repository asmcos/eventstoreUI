// build.js - 支持 targets 数组配置的静态资源复制脚本
import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, basename, join, extname } from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径（ES 模块兼容）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. 定义需要复制的静态资源配置
const staticCopyTargets = [
  {
    src: 'node_modules/simplemde/dist/simplemde.min.css',
    dest: 'static/lib/simplemde',  // 复制到 static/lib/simplemde/simplemde.min.css
  },
  {
    src: 'node_modules/simplemde/dist/simplemde.min.js',
    dest: 'static/lib/simplemde',   // 复制到 static/lib/simplemde/simplemde.min.js
  },
  // 支持整个目录复制
  {
    src: 'node_modules/font-awesome/css',
    dest: 'static/font-awesome/css',
  },
  {
    src: 'node_modules/font-awesome/fonts',
    dest: 'static/font-awesome/fonts',
  }
];

// 2. 辅助函数：检查是否为 glob 模式
function isGlobPattern(path) {
  return path.includes('*') || path.includes('?') || path.includes('[') || path.includes(']');
}

// 3. 辅助函数：解析 glob 模式并返回文件列表
function expandGlobPattern(pattern, baseDir = __dirname) {
  const files = [];
  
  try {
    const parts = pattern.split('/');
    let currentDir = baseDir;
    let remainingPattern = pattern;
    
    // 简单处理 * 通配符
    if (pattern.includes('*')) {
      const dirPart = dirname(pattern);
      const filePattern = basename(pattern);
      const fullDir = resolve(baseDir, dirPart);
      
      if (existsSync(fullDir)) {
        const dirFiles = readdirSync(fullDir);
        
        // 简单通配符匹配
        const patternRegex = new RegExp(
          '^' + 
          filePattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') + 
          '$'
        );
        
        for (const file of dirFiles) {
          if (patternRegex.test(file)) {
            const fullPath = resolve(fullDir, file);
            if (statSync(fullPath).isFile()) {
              files.push(fullPath);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[WARNING] 解析 glob 模式失败 ${pattern}:`, err.message);
  }
  
  return files;
}

// 4. 核心函数：根据 targets 配置复制文件
function copyStaticFiles(targets) {
  console.log('[INFO] 开始复制静态文件...');
  let totalCopied = 0;
  let totalFailed = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const srcPath = resolve(__dirname, target.src);
    const destPath = resolve(__dirname, target.dest);

    try {
      // 检查源路径是否存在
      if (!existsSync(srcPath)) {
        // 如果是 glob 模式，尝试扩展
        if (isGlobPattern(target.src)) {
          const expandedFiles = expandGlobPattern(target.src, __dirname);
          
          if (expandedFiles.length === 0) {
            console.warn(`[WARNING] ${i + 1}/${targets.length}: 源路径不存在且未匹配到文件: ${target.src}`);
            totalFailed++;
            continue;
          }
          
          // 处理每个匹配的文件
          for (const filePath of expandedFiles) {
            let finalDestPath = destPath;
            const fileName = basename(filePath);
            
            // 如果目标路径不是目录（包含文件名），使用目标路径作为最终路径
            if (extname(destPath)) {
              finalDestPath = destPath;
            } else {
              // 否则将文件复制到目标目录下，保持原文件名
              finalDestPath = resolve(destPath, fileName);
            }
            
            // 确保目标目录存在
            mkdirSync(dirname(finalDestPath), { recursive: true });
            
            // 复制文件
            copyFileSync(filePath, finalDestPath);
            console.log(`[SUCCESS] ${i + 1}/${targets.length}: ${target.src} -> ${finalDestPath.replace(__dirname + '/', '')}`);
            totalCopied++;
          }
          continue;
        }
        
        console.warn(`[WARNING] ${i + 1}/${targets.length}: 源路径不存在: ${target.src}`);
        totalFailed++;
        continue;
      }
      
      // 获取源路径信息
      const srcStat = statSync(srcPath);
      
      if (srcStat.isFile()) {
        // 处理单个文件
        let finalDestPath = destPath;
        
        // 如果目标路径是目录（没有扩展名），则在目标目录下保持原文件名
        if (!extname(destPath) || destPath.endsWith('/')) {
          finalDestPath = resolve(destPath, basename(srcPath));
        }
        
        // 确保目标目录存在
        mkdirSync(dirname(finalDestPath), { recursive: true });
        
        // 复制文件
        copyFileSync(srcPath, finalDestPath);
        console.log(`[SUCCESS] ${i + 1}/${targets.length}: ${target.src} -> ${finalDestPath.replace(__dirname + '/', '')}`);
        totalCopied++;
        
      } else if (srcStat.isDirectory()) {
        // 处理目录复制
        if (!extname(destPath)) {
          // 确保目标目录存在
          mkdirSync(destPath, { recursive: true });
          
          // 递归复制目录内容
          copyDirectory(srcPath, destPath);
          console.log(`[SUCCESS] ${i + 1}/${targets.length}: 目录 ${target.src} -> ${target.dest}`);
          totalCopied++;
        } else {
          console.warn(`[WARNING] ${i + 1}/${targets.length}: 源路径是目录但目标路径是文件: ${target.src}`);
          totalFailed++;
        }
      }
      
    } catch (err) {
      console.error(`[ERROR] ${i + 1}/${targets.length}: 复制失败 ${target.src}:`, err.message);
      totalFailed++;
    }
  }
  
  console.log(`[SUMMARY] 文件复制完成: ${totalCopied} 个成功, ${totalFailed} 个失败`);
  return { totalCopied, totalFailed };
}

// 5. 辅助函数：递归复制目录
function copyDirectory(srcDir, destDir) {
  // 创建目标目录
  mkdirSync(destDir, { recursive: true });
  
  // 读取源目录内容
  const items = readdirSync(srcDir);
  
  for (const item of items) {
    const srcPath = join(srcDir, item);
    const destPath = join(destDir, item);
    
    const stat = statSync(srcPath);
    
    if (stat.isDirectory()) {
      // 递归复制子目录
      copyDirectory(srcPath, destPath);
    } else {
      // 复制文件
      copyFileSync(srcPath, destPath);
    }
  }
}

// 6. 主构建流程
async function main() {
  try {
    console.log('[INFO] ========== 开始构建流程 ==========');
    
    // 步骤1：执行 Tailwind CSS 编译
    console.log('[INFO] 正在编译 Tailwind CSS...');
    execSync('npx @tailwindcss/cli  -i ./src/app.css -o ./static/css/main.css', {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });
    console.log('[SUCCESS] Tailwind CSS 编译完成！');
    
    // 步骤2：复制静态文件
    const copyResult = copyStaticFiles(staticCopyTargets);
    
    if (copyResult.totalFailed > 0) {
      console.warn(`[WARNING] ${copyResult.totalFailed} 个文件复制失败，但继续执行后续流程`);
    }
    
    // 步骤3：启动 Vite 开发服务
    console.log('[INFO] 正在启动 Vite 开发服务...');
    const viteProcess = spawn('vite', ['dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });
    
    // 监听进程退出
    viteProcess.on('exit', (code) => {
      console.log(`[INFO] Vite 进程退出，代码: ${code || 0}`);
      process.exit(code || 0);
    });
    
    // 监听信号终止
    process.on('SIGINT', () => {
      console.log('[INFO] 接收到终止信号，关闭 Vite 进程...');
      viteProcess.kill('SIGINT');
    });
    
  } catch (err) {
    console.error('[ERROR] 构建流程执行失败:', err.message);
    process.exit(1);
  }
}

// 7. 导出配置供其他脚本使用
export { staticCopyTargets, copyStaticFiles };

// 8. 如果是直接运行此脚本，则执行主函数
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

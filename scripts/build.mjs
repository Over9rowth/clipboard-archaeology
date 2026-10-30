import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');

// 递归确保目录存在
fs.mkdirSync(path.join(root, 'dist/main'), { recursive: true });
fs.mkdirSync(path.join(root, 'dist/preload'), { recursive: true });
fs.mkdirSync(path.join(root, 'dist/renderer'), { recursive: true });

// 复制 domain 算法文件到 dist/domain
fs.mkdirSync(path.join(root, 'dist/domain'), { recursive: true });
fs.copyFileSync(
  path.join(root, 'src/domain/clipboard-audit.cjs'),
  path.join(root, 'dist/domain/clipboard-audit.cjs')
);
fs.copyFileSync(
  path.join(root, 'src/domain/clipboard-audit.d.cts'),
  path.join(root, 'dist/domain/clipboard-audit.d.cts')
);

// 复制前端 HTML
fs.copyFileSync(
  path.join(root, 'src/renderer/index.html'),
  path.join(root, 'dist/renderer/index.html')
);

// 复制前端 CSS
fs.copyFileSync(
  path.join(root, 'src/renderer/style.css'),
  path.join(root, 'dist/renderer/style.css')
);

// 为渲染进程 Shim 掉 node 原生模块
const nodeBuiltinsShim = {
  name: 'node-builtins-shim',
  setup(build) {
    build.onResolve({ filter: /^node:(crypto|fs|path)$/ }, args => ({
      path: args.path,
      namespace: 'node-shim'
    }));
    build.onLoad({ filter: /.*/, namespace: 'node-shim' }, args => {
      if (args.path === 'node:crypto') {
        return {
          contents: `
            export function createHash() {
              return {
                update: () => ({ digest: () => 'sha256-mock-hash-' + Math.random().toString(16).slice(2) })
              };
            }
            export default { createHash };
          `,
          loader: 'js'
        };
      }
      return { contents: 'export default {};', loader: 'js' };
    });
  }
};

// 1. 构建 Main
await esbuild.build({
  entryPoints: [path.join(root, 'src/main/index.ts')],
  outfile: path.join(root, 'dist/main/index.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron']
});

// 2. 构建 Preload
await esbuild.build({
  entryPoints: [path.join(root, 'src/preload/index.ts')],
  outfile: path.join(root, 'dist/preload/index.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron']
});

// 3. 构建 Renderer
await esbuild.build({
  entryPoints: [path.join(root, 'src/renderer/index.tsx')],
  outfile: path.join(root, 'dist/renderer/index.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  plugins: [nodeBuiltinsShim],
  define: {
    'process.env.NODE_ENV': '"production"',
    'global': 'window'
  }
});

console.log('Build complete.');

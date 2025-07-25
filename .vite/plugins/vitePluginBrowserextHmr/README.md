# Vite 浏览器扩展开发工具

基于 Vite 构建的浏览器扩展开发环境，提供热更新功能，让扩展开发更加高效。

## ✨ 特性

- 🚀 基于 Vite 7.0+ 构建系统，享受极速开发体验
- 🔄 实时热更新，修改代码后自动刷新扩展
- 🌐 支持多种浏览器（Chrome、Edge、Firefox）
- 📦 自动注入热更新客户端，无需手动配置
- 🧩 支持所有扩展组件的热更新：
  - Popup 页面
  - Options 页面
  - DevTools 页面
  - Content Scripts
  - Background Service Worker
- 📁 智能依赖追踪，只更新变更的部分

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发命令

```bash
# 启动开发服务器
pnpm run dev

# 构建生产版本
pnpm run build
```

## 🔧 项目结构

```
vite-extend-chrome/
├── browserPlugin/          # 浏览器扩展源码
│   ├── background/         # 后台脚本
│   │   └── service-worker.ts
│   ├── content/            # 内容脚本
│   │   ├── content.ts
│   │   └── content-ass.ts
│   ├── devtools/           # 开发者工具页面
│   ├── icons/              # 图标资源
│   ├── options/            # 选项页面
│   └── popup/              # 弹出窗口
├── src/                    # 前端源码
├── manifest.json           # 扩展清单文件
└── vite.config.ts          # Vite 配置
```

## ⚙️ 配置说明

在 `vite.config.ts` 中配置 `vitePluginBrowserextHmr` 插件：

```typescript
export default defineConfig({
  ...
  plugins: [
    ...
    vitePluginBrowserextHmr({
      // HTML 页面配置
      htmlPaths: [
        {
          name: "devtools",
          path: path.resolve(__dirname, "browserPlugin/devtools/index.html"),
        },
        {
          name: "options",
          path: path.resolve(__dirname, "browserPlugin/options/index.html"),
        },
        {
          name: "popup",
          path: path.resolve(__dirname, "browserPlugin/popup/index.html"),
        },
      ],
      
      // JS 入口文件配置
      jsPaths: [
        {
          name: "content",
          path: path.resolve(__dirname, "browserPlugin/content/content.ts"),
        },
        {
          name: "content-ass",
          path: path.resolve(__dirname, "browserPlugin/content/content-ass.ts"),
        },
        {
          name: "service-worker",
          path: path.resolve(__dirname, "browserPlugin/background/service-worker.ts"),
        },
      ],
      
      // 清单文件路径
      manifestPath: path.resolve(__dirname, "manifest.json"),
      
      // 需要复制的静态资源
      copyPaths: [
        {
          src: path.resolve(__dirname, "browserPlugin/icons"),
          dest: path.resolve(__dirname, "dist/browserPlugin/icons"),
        },
      ],
      
      // 浏览器启动配置
      wxtUserConfig: {
        startUrls: ["http://baidu.com"],  // 启动时打开的网址
        binaries: {
          chromium: "浏览器输入 chrome://version/ 找到可执行文件路径复制到这里",  // 自定义浏览器路径
          edge: "浏览器输入 edge://version/ 找到可执行文件路径复制到这里",
        },
      },
    })]
})
```

## 📝 注意事项

- 确保 `manifest.json` 文件配置正确，特别是路径和权限部分
- 开发时需要在浏览器扩展管理页面加载 `dist` 目录
- 首次启动时会自动打开浏览器并加载扩展
- 使用 `web-ext-run` 库实现浏览器自动化启动

## 📚 技术栈

- Vite 7.0+
- TypeScript
- Vue 3 (可选)

## 📄 许可证

MIT

// 浏览器插件-自定义模式

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import { vitePluginBrowserextHmr } from "./.vite/plugins/vitePluginBrowserextHmr/dist";
// import { vitePluginBrowserextHmr } from "vite-plugin-browserext-hmr";
import UnoCSS from "unocss/vite";
import type { Plugin } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    // vue时这样处理，其余的没试过
    UnoCSS({
      // transformCSS: "pre",
      // mode: "vue-scoped",
    }),
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    // 开发环境用ws通知插件重新加载
    vitePluginBrowserextHmr({
      // @ts-ignore
      /**
       * 需要热更新的html文件
       * html的打包路径由path目录的相对路径决定，所以需要保持manifest.json在根目录
       */
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
      /**
       * 需要热更新的入口js文件
       * js的打包路径由path目录的相对路径决定，所以需要保持manifest.json在根目录
       * name需要和path的文件名（不是文件夹）一致
       */
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
          path: path.resolve(
            __dirname,
            "browserPlugin/background/service-worker.ts"
          ),
        },
      ],
      manifestPath: path.resolve(__dirname, "manifest.json"),
      //相对路径-需要手动移动的文件
      copyPaths: [
        {
          src: path.resolve(__dirname, "browserPlugin/icons"),
          dest: path.resolve(__dirname, "dist/browserPlugin/icons"),
        },
      ],

      wxtUserConfig: {
        startUrls: ["http://baidu.com"],
        binaries: {
          chromium: "C:\\Program Files\\ESBrowser\\ESBrowser.exe", // 使用Chrome Beta而不是普通Chrome
          // firefox: "firefoxdeveloperedition", // 使用Firefox开发者版本而不是普通Firefox
          edge: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", // 在运行"wxt -b edge"时打开微软Edge
        },
      },
    }) as Plugin,
  ],
  // build: {
  //   sourcemap: false,
  // },
});

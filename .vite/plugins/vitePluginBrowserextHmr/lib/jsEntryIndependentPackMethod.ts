import { relative } from "node:path";
import { existsSync } from "node:fs";
import { build, normalizePath } from "vite";
import { gray } from "colorette";
import {
  isItBackgroundUrl,
  generateHotReloadCode,
  arePathsSameFileSync,
} from "./viteUtils";
import type { PathLike } from "node:fs";
import type { InlineConfig, Plugin } from "vite";

const filterItem = (i: { name: string }) =>
  ![
    "vite-plugin-browserext-hmr",
    "vitePluginBrowserextHmr:manifestJsonProcessPlugin",
    "vitePluginBrowserextHmr:jsTypeEntryFileOutputPlugin",
    "vitePluginBrowserextHmr:fileCopyPlugin",
  ].includes(i.name);

function createBuilderWatch(jsItem: { path: PathLike; name: string }): Plugin {
  return {
    name: "vitePluginBrowserextHmr:createBuilderWatch",
    enforce: "post",
    config(config: any) {
      if (!config.plugins) config.plugins = [];
      if (!config.build) config.build = {};
      if (!config.build?.rollupOptions) config.build.rollupOptions = {};
      config.build.sourcemap =
        process.env.BUILD_CRX_NOTIFIER === "dev"
          ? true
          : config.build.sourcemap;
      config.plugins = config.plugins?.filter(filterItem);
      config.build.rollupOptions.input = undefined;
      config.build.lib = {
        entry: jsItem.path,
        formats: ["iife"],
        name: jsItem.name,
        fileName: jsItem.name,
      };
      config.build.rollupOptions.output = {
        extend: true,
        assetFileNames: (assetInfo: { name: string }) => {
          // 入口文件
          const findName =
            jsItem.name === assetInfo.name?.split?.(".")?.shift?.()
              ? jsItem
              : undefined;
          // 获取js文件的相对路径
          const relativePath = normalizePath(
            findName ? relative(process.cwd(), findName.path as string) : ""
          );
          const assetFileNames = `${relativePath?.split?.(".")?.shift?.()}.css`;
          global.__content_scripts_css[assetFileNames] = assetFileNames;
          return assetFileNames;
        },
        entryFileNames: (chunkInfo: { name: any }) => {
          // 入口文件
          const findName = jsItem.name === chunkInfo.name ? jsItem : undefined;
          // 获取js文件的相对路径
          const relativePath = normalizePath(
            findName ? relative(process.cwd(), findName.path as string) : ""
          );
          return `${relativePath?.split?.(".")?.shift?.()}.js`;
        },
      };
      if (config?.build?.rollupOptions?.plugins?.length) {
        config.build.rollupOptions.plugins =
          config.build.rollupOptions.plugins?.filter(filterItem);
      }
    },
    resolveId(id) {
      // 处理虚拟脚本
      if (
        process.env.BUILD_CRX_NOTIFIER === "dev" &&
        id.startsWith("virtualBuildCrxNotifierPluginHrm")
      ) {
        return id;
      }
    },
    async load(id) {
      // 处理虚拟脚本
      if (
        process.env.BUILD_CRX_NOTIFIER === "dev" &&
        id.startsWith("virtualBuildCrxNotifierPluginHrm")
      ) {
        const pathStr =
          typeof jsItem.path === "string"
            ? jsItem.path
            : (jsItem.path as any)?.toString?.();
        const hotReloadCode = await generateHotReloadCode(pathStr);

        return hotReloadCode;
      }
    },
    async transform(code: string, id: string) {
      const pathStr =
        typeof jsItem.path === "string"
          ? jsItem.path
          : (jsItem.path as any)?.toString?.();
      if (
        process.env.BUILD_CRX_NOTIFIER === "dev" &&
        arePathsSameFileSync(pathStr, id)
      ) {
        // 将热更新脚本用虚拟脚本的方式引入
        const codeStr = `import "virtualBuildCrxNotifierPluginHrm";\n` + code;
        return { code: codeStr, map: null };
      }
      return { code, map: null };
    },
    async renderChunk(code: string) {
      const pathStr =
        typeof jsItem.path === "string"
          ? jsItem.path
          : (jsItem.path as any)?.toString?.();
      const isBackground = isItBackgroundUrl(
        normalizePath(pathStr)
          ?.replace(normalizePath(process.cwd()), "")
          ?.replace(/.ts$/, ".js") || ""
      );
      if (process.env.BUILD_CRX_NOTIFIER === "dev" && isBackground) {
        return {
          code: `try{\n${code}\n}catch(e){console.log(e)}`,
          map: null,
        };
      }
      return { code, map: null };
    },
    async generateBundle() {
      if (Object.keys(global.__content_scripts_css || {})?.length) {
        const contentScripts = global.__finalManifests?.content_scripts ?? [];
        // 确保 jsItem.path 是字符串类型
        const pathStr =
          typeof jsItem.path === "string"
            ? jsItem.path
            : (jsItem.path as any)?.toString?.();
        // 当前入口js文件路径加文件名（不包含后缀）
        const path = normalizePath(pathStr)
          ?.replace(normalizePath(process.cwd()), "")
          ?.split(".")
          ?.shift?.()
          ?.replace(/^\//, "");

        contentScripts?.forEach((item: any, j: number) => {
          // 得到content_scripts的js文件路径（不包含后缀）
          const itemPath = item.js?.map((js: any) =>
            normalizePath(js)?.split(".")?.shift?.()?.replace(/^\//, "")
          );
          const match = itemPath.includes(path);
          if (match) {
            const css = [
              ...(contentScripts[j]?.css ?? []),
              ...Object.keys(global.__content_scripts_css || {}),
            ]?.reduce((previousValue: any, currentValue: any) => {
              if (!previousValue.includes(currentValue)) {
                previousValue.push(currentValue);
              }
              return previousValue;
            }, []);
            contentScripts[j].css = [...css];
          }
        });
        global.__content_scripts_css = {};
        const finalManifests = {
          ...(global.__finalManifests ?? {}),
          content_scripts: contentScripts,
        };
        const manifestContent = JSON.stringify(finalManifests, null, 2);
        // 使用emitFile将manifest.json写入到dist目录
        global.__finalManifests = finalManifests;

        // 开发环境不生成css的静态注入
        if (process.env.BUILD_CRX_NOTIFIER !== "dev") {
          (this as any).emitFile({
            type: "asset",
            fileName: "manifest.json",
            source: manifestContent,
          });
        } else {
          (this as any).emitFile({
            type: "asset",
            fileName: "manifest.map.json",
            source: manifestContent,
          });
        }
      }
    },
  };
}

export async function singlePackJsFileMethod(
  jsItem: { path: PathLike; name: string },
  inlineConfig: InlineConfig | undefined,
  configBuildConfig: { write?: boolean } | undefined = {
    write: false,
  }
) {
  const jsPathName = relative(process.cwd(), jsItem.path as string);
  if (!jsPathName || !existsSync(jsItem.path)) {
    console.log(gray(jsPathName + "文件不存在！"));
    return;
  }
  // 现在重新设置监听预设js、ts文件
  const builder = await build({
    ...inlineConfig,
    // mode: "production",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    plugins: [createBuilderWatch(jsItem)],
    build: configBuildConfig,
  });
  return builder;
}

// 单独监听和构建js入口部分-对应background和contentjs文件
export const batchPackJsFilesMethod = async (
  { jsPaths, inlineConfig }: any,
  configBuildConfig: { write?: boolean; watch?: {} } | undefined
) => {
  const builderArray = [];
  for (let index = 0; index < jsPaths.length; index++) {
    const jsItem = jsPaths[index];
    const builder = await singlePackJsFileMethod(
      jsItem,
      inlineConfig,
      configBuildConfig
    );
    if (builder) {
      builderArray.push({
        ...jsItem,
        builder,
      });
    }
  }
  return builderArray;
};

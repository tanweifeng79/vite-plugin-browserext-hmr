import { manifestJsonProcessPlugin } from "./manifestJsonProcessPlugin";
import { jsTypeEntryFileOutputPlugin } from "./jsTypeEntryFileOutputPlugin";
import { fileCopyPlugin } from "./fileCopyPlugin";
import { getHash } from "./viteUtils";
import type { UserConfig } from "vite";
import type { PlatformPath } from "node:path";

type resolveType = PlatformPath["resolve"] extends (...args: any[]) => infer R
  ? R
  : string;

interface ConfigPluginOptions {
  config: UserConfig;
  htmlPaths: {
    name: string;
    path: resolveType;
  }[];
  jsPaths: {
    name: string;
    path: resolveType;
  }[];
  manifestPath: resolveType;
  manifestData: Record<string, any>;
  inlineConfig: any;
  copyPaths?: {
    src: resolveType;
    dest: resolveType;
  }[];
}
/**
 * 配置插件
 * @param param0
 * @param config 配置
 * @param htmlPaths 需要监听/处理的 HTML 文件路径数组（默认：空数组）,用于插入接收热更新更新消息并重新加载插件
 * @param jsPaths 需要监听/处理的 JS 文件路径数组（默认：空数组）,用于插入接收热更新更新消息并重新加载插件
 * @param manifestPath 需要监听/处理的 manifest.json 文件路径（默认：空字符串）,用于插入接收热更新更新消息并重新加载插件
 * @param manifestData 需要写入到manifest.json的数据（默认：空对象）
 * @param copyPaths 需要写入到manifest.json的数据（默认：空对象）
 * @param inlineConfig 初始化配置
 * @returns
 */
export function configPlugin({
  config,
  htmlPaths,
  manifestPath,
  manifestData,
  jsPaths,
  copyPaths,
  inlineConfig,
}: ConfigPluginOptions) {
  if (process.env.BUILD_CRX_NOTIFIER === "dev") {
    config.base = "./";
  }
  if (!config.plugins) {
    config.plugins = [];
  }
  if (!config.build) {
    config.build = { rollupOptions: {} };
  }
  if (!config.build?.rollupOptions) {
    config.build.rollupOptions = {};
  }
  const rollupOptions: any = config.build?.rollupOptions;
  // 添加重置html路径的插件
  rollupOptions.plugins = [
    ...(rollupOptions.plugins || []),
    manifestJsonProcessPlugin({
      manifestPath,
      manifestData,
    }),
    jsTypeEntryFileOutputPlugin({
      jsPaths,
      inlineConfig,
    }),
    fileCopyPlugin(copyPaths),
  ];
  // 添加入口文件
  rollupOptions.input = {
    ...rollupOptions.input,
    ...htmlPaths?.reduce((acc: any, item: { name: string; path: string }) => {
      const uniqueKey = item.name || getHash(item.path);
      acc[uniqueKey] = item.path;
      return acc;
    }, {}),
  };
  // 添加输出路径
  rollupOptions.output = {
    assetFileNames: "assets/[name]-[hash].[ext]", // 静态资源
    // chunkFileNames: "js/[name]-[hash].js", // 代码分割中产生的 chunk
    // entryFileNames: (chunkInfo: any) => {
    //   return `[name]/${chunkInfo.name}.js`;
    // },
    // name: "[name].js",
    ...rollupOptions.output,
  };
  return config;
}

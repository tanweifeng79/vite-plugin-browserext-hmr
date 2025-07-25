import { outputFile } from "./viteUtils";
import { batchPackJsFilesMethod } from "./jsEntryIndependentPackMethod";
import type { PlatformPath } from "node:path";

type resolveType = PlatformPath["resolve"] extends (...args: any[]) => infer R
  ? R
  : string;
/**
 * 处理打包时的js入口文件
 * @param jsPaths  js入口文件集合
 * @param inlineConfig 打包的初始化配置
 * @returns
 */
export function jsTypeEntryFileOutputPlugin({
  jsPaths,
  inlineConfig,
}: {
  jsPaths: {
    name: string;
    path: resolveType;
  }[];
  inlineConfig: any;
}) {
  return {
    name: "vitePluginBrowserextHmr:jsTypeEntryFileOutputPlugin",
    enforce: "post",
    // 在打包结束后手动将js文件移到dist
    async closeBundle() {
      if (process.env.BUILD_CRX_NOTIFIER === "dev") return;
      const builderArray = await batchPackJsFilesMethod(
        { jsPaths, inlineConfig },
        { write: false }
      );
      const fileArray: any[] = [];
      builderArray?.forEach((item: any) => {
        item?.builder?.forEach?.((builderItem: any) => {
          builderItem?.output?.forEach?.((outputItem: any) => {
            const { fileName, type, code, source } = outputItem;
            fileArray.push({
              fileName,
              code: type === "chunk" ? code : source,
            });
          });
        });
      });
      await outputFile(fileArray);
    },
  };
}

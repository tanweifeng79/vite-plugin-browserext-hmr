import type { PlatformPath } from "node:path";

type resolveType = PlatformPath["resolve"] extends (...args: any[]) => infer R
  ? R
  : string;
/**
 * 拷贝文件
 * @param copyPaths  相对路径-需要手动移动的文件
 * @returns
 */
export function fileCopyPlugin(
  copyPaths?: {
    // 相对路径-需要手动移动的文件
    src: resolveType;
    dest: resolveType;
  }[]
) {
  return {
    name: "vitePluginBrowserextHmr:fileCopyPlugin",
    enforce: "post",
    // 在打包结束后手动将静态文件拷贝到dist
    async generateBundle() {
      if (copyPaths?.length) {
        // 拷贝静态文件
        const fs: any = await import("fs-extra");
        for (let index = 0; index < copyPaths?.length; index++) {
          const element = copyPaths[index];
          fs?.default?.copySync?.(element.src, element.dest);
        }
      }
    },
  };
}

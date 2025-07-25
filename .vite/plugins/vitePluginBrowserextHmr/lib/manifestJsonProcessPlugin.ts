import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { normalizePath } from "vite";
import { gray } from "colorette";
// import { fileURLToPath } from "node:url";
import { generateHotReloadCode } from "./viteUtils";
import type { PlatformPath } from "node:path";

// const __dirname = dirname(fileURLToPath(import.meta.url)); // 获取当前目录[5](@ref)
type resolveType = PlatformPath["resolve"] extends (...args: any[]) => infer R
  ? R
  : string;

/**
 * 处理manifest.json
 * @param manifestPath  manifest.json文件路径
 * @param manifestData 需要写入到manifest.json的数据
 * @returns
 */
export function manifestJsonProcessPlugin({
  manifestPath,
  manifestData,
}: {
  manifestPath: resolveType;
  manifestData: Record<string, any>;
}) {
  return {
    name: "vitePluginBrowserextHmr:manifestJsonProcessPlugin",
    enforce: "post",
    // 在生成bundle时写入manifest.json文件
    async generateBundle() {
      try {
        // 从manifestPath读取现有的manifest.json文件
        let baseManifest: any = {};
        let basePackage: any = {};

        const packagePath = resolve(process.cwd(), "package.json");
        if (existsSync(packagePath)) {
          try {
            const packageConent = readFileSync(packagePath, "utf-8");
            basePackage = JSON.parse(packageConent);
          } catch (err) {
            basePackage = {};
          }
        }
        if (manifestPath && existsSync(manifestPath)) {
          try {
            const manifestContent = readFileSync(manifestPath, "utf-8");
            baseManifest = JSON.parse(manifestContent);
          } catch (error) {
            console.error(`读取manifest文件失败: ${manifestPath}`, error);
            // 如果读取失败，使用默认的基础manifest
            baseManifest = {
              name: "Chrome Extension",
              version: "1.0.0",
              manifest_version: 3,
              description: "Chrome Extension built with Vite",
            };
          }
        } else {
          console.log(gray(`未找到manifest文件或未指定路径,使用默认配置`));
          // 使用默认的基础manifest
          baseManifest = {
            name: "Chrome Extension",
            version: "1.0.0",
            manifest_version: 3,
            description: "Chrome Extension built with Vite",
          };
        }
        // 合并用户提供的manifest数据
        const finalManifest =
          process.env.BUILD_CRX_NOTIFIER === "dev"
            ? {
                ...baseManifest,
                ...manifestData,
                host_permissions: ["*://*/*", "http://localhost/*"],
                content_security_policy: {
                  extension_pages: `script-src 'self' 'wasm-unsafe-eval' http://localhost:${
                    global.__server?.config?.server?.port || 3000
                  }; object-src 'self';`,
                  sandbox: `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:${
                    global.__server?.config?.server?.port || 3000
                  }; sandbox allow-scripts allow-forms allow-popups allow-modals; child-src 'self';`,
                },
                permissions: [
                  ...(baseManifest?.permissions || []),
                  "tabs",
                  "scripting",
                ],
              }
            : {
                ...baseManifest,
                ...manifestData,
              };

        const finalManifests = {
          ...finalManifest,
          name: basePackage.name || finalManifest.name,
          version: basePackage.version || finalManifest.version,
          description: basePackage.description || finalManifest.description,
        };
        // 没有service-worker.js的时候加一个来支持热更新
        if (
          !(
            finalManifests?.background?.service_worker ||
            finalManifests?.background?.scripts?.length
          ) &&
          process.env.BUILD_CRX_NOTIFIER === "dev"
        ) {
          finalManifests.background = { service_worker: "service-worker.js" };
          const source: any = await generateHotReloadCode(true);
          (this as any).emitFile({
            type: "asset",
            fileName: "service-worker.js",
            source,
          });
        }

        // 开发环境给content_scripts里面加webcomponents Polyfill
        if (
          finalManifests.content_scripts?.length &&
          process.env.BUILD_CRX_NOTIFIER === "dev"
        ) {
          for (
            let index = 0;
            index < finalManifests.content_scripts.length;
            index++
          ) {
            const item = finalManifests.content_scripts[index];
            if (item.js?.length) {
              item.js = [...new Set(["webcomponents-bundle.js", ...item.js])];
            }
          }
          (this as any).emitFile({
            type: "asset",
            fileName: "webcomponents-bundle.js",
            source: readFileSync(
              resolve(__dirname, "./webcomponents-bundle.js"),
              "utf-8"
            ),
          });
        }

        global.__manifestVersion = finalManifests.manifest_version;
        global.__finalManifests = finalManifests;
        // 给devtools_page生成devtools.js文件用以注册devtools面板
        if (finalManifests.devtools_page) {
          // 根据devtools_page生成devtools.js文件
          try {
            const devtoolsPage = resolve(
              process.cwd(),
              finalManifests.devtools_page
            );
            if (!existsSync(devtoolsPage)) {
              return;
            }
            (this as any).emitFile({
              type: "asset",
              fileName: `${
                normalizePath(
                  dirname(devtoolsPage.replace(process.cwd(), ""))
                )?.replace(/^\//, "") ?? ""
              }/devtools.js`,
              source: `chrome.devtools.panels.create("${finalManifests.name}", "","${finalManifests.devtools_page}",);`,
            });
          } catch (error) {
            console.error("devtools.js生成失败:", error);
          }
        }
        const finalManifestsCopy = JSON.parse(JSON.stringify(finalManifests));
        // 置空注入脚本为动态注册预留位置
        if (process.env.BUILD_CRX_NOTIFIER === "dev") {
          const manifestContent_Map = JSON.stringify(finalManifests, null, 2);
          (this as any).emitFile({
            type: "asset",
            fileName: "manifest.map.json",
            source: manifestContent_Map,
          });
          finalManifestsCopy.content_scripts = undefined;
        }
        // 将manifest对象转换为JSON字符串
        const manifestContent = JSON.stringify(finalManifestsCopy, null, 2);
        // 使用emitFile将manifest.json写入到dist目录
        (this as any).emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: manifestContent,
        });
        // console.log(cyan("\n✓ 已生成manifest.json文件"));
      } catch (error) {
        console.log(gray("\n生成manifest.json文件失败:"), error);
      }
    },
  };
}

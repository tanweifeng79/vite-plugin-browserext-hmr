import { dirname, relative, resolve } from "node:path";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { EventEmitter } from "node:events";
import { build, normalizePath } from "vite";
import { parseHTML } from "linkedom";
import { configPlugin } from "./configPlugin";
import { green, bold, cyan, gray } from "colorette";
import { webExtRunPlugin } from "./webExtRunPlugin";
import {
  minifyCode,
  arePathsSameFileSync,
  formatDevUrl,
  outputFile,
  getHash,
  prepareError,
  isItBackgroundUrl,
  debounce,
} from "./viteUtils";
import {
  batchPackJsFilesMethod,
  singlePackJsFileMethod,
} from "./jsEntryIndependentPackMethod";
import type { Plugin, UserConfig } from "vite";
import type { PlatformPath } from "node:path";

// 声明全局变量类型
declare global {
  var __buildInProgress: boolean;
  var __buildCompleted: boolean;
  var __server: any;
  var __inlineScriptContents: any;
  var __virtualInlineScript: string;
  var __eventEmitter: EventEmitter;
  var __runner: any;
  var __runnerNum: number;
  var __manifestVersion: number;
  var __finalManifests: any;
  var __config: any;
  var __jsCatch: Map<string, string>;
  var __builder: any;
  var __content_scripts_css: any;
  var __dependenciesMap: Map<string, any>;
  // 记录监听文件执行函数
  var __changeFuncArray: (() => Promise<any>)[];
  // 监听文件执行状态
  var __changeFuncArrayStatus: boolean;
  var __changeStartFunc: () => void;
  var __buildFuncArray: (() => Promise<any>)[];
  var __buildStateFunc: () => void;
  var __errorState: any;
}

// 优化全局变量初始化，使用一个对象批量处理
const globalDefaults = {
  __buildInProgress: false,
  __buildCompleted: false,
  __server: {},
  __inlineScriptContents: {},
  __virtualInlineScript: "virtual:crx-inline-script",
  __eventEmitter: new EventEmitter(),
  __runner: null,
  __runnerNum: 0,
  __manifestVersion: 3,
  __finalManifests: {},
  __config: {},
  __jsCatch: new Map(),
  __builder: null,
  __content_scripts_css: {},
  __dependenciesMap: new Map(),
  __changeFuncArray: [],
  __changeFuncArrayStatus: false,
  __changeStartFunc: () => {
    if (!global.__changeFuncArrayStatus) {
      global.__changeFuncArray?.pop?.()?.();
    }
  },
  __buildFuncArray: [],
  __buildStateFunc: () => {
    if (!global.__buildInProgress) {
      global.__buildFuncArray?.pop?.()?.();
    }
  },
  __errorState: null,
};

for (const [key, value] of Object.entries(globalDefaults)) {
  if ((global as any)[key] === undefined) {
    (global as any)[key] = value;
  }
}

const inlineConfig = {
  root: undefined,
  base: undefined,
  mode: "development",
  configFile: undefined,
  configLoader: undefined,
  logLevel: undefined,
  clearScreen: undefined,
  build: {},
};

type resolveType = PlatformPath["resolve"] extends (...args: any[]) => infer R
  ? R
  : string;

interface BuildCrxNotifierPluginOptions {
  htmlPaths?: {
    name: string;
    path: resolveType;
  }[];
  jsPaths?: {
    name: string;
    path: resolveType;
  }[];
  manifestPath: resolveType;
  manifestData?: Record<string, any>;
  // 相对路径-需要手动移动的文件
  copyPaths?: {
    src: resolveType;
    dest: resolveType;
  }[];

  wxtUserConfig?: {
    browser?: string;
    binaries?: {
      firefox?: string;
      chromium?: string;
      edge?: string;
    };
    chromiumProfile?: string;
    chromiumPref?: string;
    chromiumArgs?: string[];
    firefoxProfile?: string;
    firefoxPrefs?: string;
    firefoxArgs?: string[];
    openConsole?: boolean;
    openDevtools?: boolean;
    startUrls?: string[];
    keepProfileChanges?: boolean;
    outDir?: string;
  };
}

/**
 * 启动本地开发环境工具浏览器插件热更新，主动重新加载插件实现更新
 * 用于配置开发模式下的端口、文件监听路径及延迟行为
 *
 * @param param0
 * @param options.htmlPaths - 需要监听/处理的 HTML 文件路径数组（默认：空数组）,用于插入接收热更新更新消息并重新加载插件
 * @param options.jsPaths - 需要监听/处理的 JS 文件路径数组（默认：空数组）,用于插入接收热更新更新消息并重新加载插件
 * @param options.manifestPath - 需要监听/处理的 manifest.json 文件路径（默认：空字符串）,用于插入接收热更新更新消息并重新加载插件
 * @param options.copyPaths - 需要拷贝的文件路径
 * @param options.manifestData - 需要写入到manifest.json的数据（默认：空对象）
 * @param options.wxtUserConfig - 浏览器配置
 * @param options.wxtUserConfig.browser - 浏览器类型
 * @param options.wxtUserConfig.binaries - 浏览器二进制文件
 * @param options.wxtUserConfig.binaries.chrome - Chrome浏览器二进制文件
 * @param options.wxtUserConfig.binaries.firefox - Firefox浏览器二进制文件
 * @param options.wxtUserConfig.binaries.edge - Edge浏览器二进制文件
 * @param options.wxtUserConfig.chromiumProfile - 浏览器配置文件
 * @param options.wxtUserConfig.chromiumPref - 浏览器偏好设置
 * @param options.wxtUserConfig.chromiumArgs - 浏览器参数
 * @param options.wxtUserConfig.firefoxProfile - 火狐浏览器配置文件
 * @param options.wxtUserConfig.firefoxPrefs - 火狐浏览器偏好设置
 * @param options.wxtUserConfig.firefoxArgs - 火狐浏览器参数
 * @param options.wxtUserConfig.openConsole - 是否打开浏览器控制台
 * @param options.wxtUserConfig.openDevtools - 是否打开浏览器开发者工具
 * @param options.wxtUserConfig.startUrls - 启动URL
 * @param options.wxtUserConfig.keepProfileChanges - 是否保持浏览器配置
 * @param options.wxtUserConfig.outDir - 输出目录
 * @returns
 */
export function vitePluginBrowserextHmr({
  htmlPaths = [],
  jsPaths = [],
  manifestPath,
  manifestData = {}, // 需要写入到manifest.json的数据
  copyPaths,
  wxtUserConfig,
}: BuildCrxNotifierPluginOptions): Plugin {
  // 更新依赖和返回需要输出的文件
  const updateDependencies = (item: any): any[] => {
    const fileArray: any[] = [];
    item?.builder?.forEach?.((builderItem: any) => {
      const moduleIds = Object.keys(builderItem.output[0]?.modules);
      const name = item.name;
      const path = item.path;
      global.__dependenciesMap.set(
        name,
        moduleIds
          ?.filter((i: string) => {
            return !i
              .replace(normalizePath(process.cwd()), "")
              .startsWith("/node_modules");
          })
          ?.map((i: any) => {
            return {
              name,
              path,
              dependencies: i,
            };
          })
      );
      builderItem?.output?.forEach?.((outputItem: any) => {
        const { fileName, type, code, source } = outputItem;
        fileArray.push({
          fileName,
          code: type === "chunk" ? code : source,
        });
      });
    });
    return fileArray;
  };

  const updateFile = async (jsItem: any) => {
    const builder = await singlePackJsFileMethod(jsItem, inlineConfig, {
      write: false,
    });
    const fileArray: any[] = updateDependencies({ ...jsItem, builder });
    await outputFile(fileArray);
  };

  const buildJs = async () => {
    const builderArray: any = await batchPackJsFilesMethod(
      { jsPaths, inlineConfig },
      { write: false }
    );
    const fileArray: any[] = [];
    builderArray?.forEach((item: any) => {
      const fileItemArray: any[] = updateDependencies(item);
      fileArray.push(...fileItemArray);
    });
    await outputFile(fileArray);
  };

  // 执行build命令生成dist目录
  const runBuild = async () => {
    try {
      // 设置全局构建状态
      global.__buildInProgress = true;
      // 添加web-ext-run插件
      webExtRunPlugin({
        wxtUserConfig: {
          browser: "chromium",
          binaries: {
            chromium:
              "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          },

          openConsole: true,
          openDevtools: true,
          keepProfileChanges: true,
          outDir: global.__config.build?.outDir || "dist",
          ...wxtUserConfig,
        },
      } as any);
      const builder: any = await build({
        ...inlineConfig,
        build: { write: true },
      });
      // const fileArray: any[] = [];
      // builder?.output?.forEach?.((outputItem: any) => {
      //   const { fileName, type, code, source } = outputItem;
      //   fileArray.push({
      //     fileName,
      //     code: type === "chunk" ? code : source,
      //   });
      // });
      // await outputFile(fileArray);

      global.__builder = builder;
      await buildJs();
      console.log(cyan("✓ 构建结束"));
      // 标记构建已完成
      global.__buildCompleted = true;
      global.__buildInProgress = false;
      global.__errorState = null;
      global.__eventEmitter.emit("web-ext-run-start");
    } catch (err) {
      try {
        console.log(gray("构建失败:"), err);
        const errlog = prepareError(err as any);
        global.__errorState = errlog;
      } catch (err$1) {
        console.log(gray("构建失败:"), err$1);
      }
    } finally {
      // 无论成功还是失败，都重置构建进行中状态
      global.__buildInProgress = false;
      if (global.__buildFuncArray?.length > 0) {
        global.__eventEmitter.emit("buildStart");
      }
    }
  };

  return {
    name: "vite-plugin-browserext-hmr",
    configureServer(server) {
      process.env.BUILD_CRX_NOTIFIER = "dev";
      // 开发环境初始化的时候首先删除dist目录
      if (
        process.env.BUILD_CRX_NOTIFIER === "dev" &&
        !global.__buildCompleted
      ) {
        const distPath = resolve(process.cwd(), "dist");
        if (existsSync(distPath)) {
          rmSync(distPath, { recursive: true });
        }
      }
      const _printUrls = server.printUrls;
      const colorUrl = (url: string) =>
        cyan(
          url.replace(
            /:(\d+)\//,
            (_: any, port: string | number) => `:${bold(port)}/`
          )
        );
      server.printUrls = () => {
        _printUrls();
        for (const localUrl of server.resolvedUrls?.local ?? []) {
          const appUrl = localUrl.endsWith("/") ? localUrl : `${localUrl}/`;
          const serverUrl =
            server.config.base && appUrl.endsWith(server.config.base)
              ? appUrl.slice(0, -server.config.base.length)
              : appUrl.slice(0, -1);
          htmlPaths?.forEach((item) => {
            const path = normalizePath(item.path?.replace(process.cwd(), ""));
            const inspectorUrl = `${serverUrl}/${
              global.__config?.build?.outDir
            }${path.startsWith("/") ? "" : "/"}${path}`;
            console.log(
              `  ${green("\u279C")}  ${bold(
                "crx-notifier Inspector"
              )}: ${colorUrl(`${inspectorUrl}`)}`
            );
          });
        }
      };

      const connection = debounce(
        () => {
          if (global.__errorState) {
            global.__server.ws.send({
              type: "crx-error",
              err: global.__errorState,
            });
          }
          global.__server.ws.send({
            type: "custom",
            event: "crx-reload-content_scripts-register",
            data: global.__finalManifests.content_scripts?.map((i: any) => ({
              js: i.js,
              css: i.css,
              matches: i.matches,
              persistAcrossSessions: false,
            })),
          });
        },
        200,
        true
      );
      // 客户端链接时如果有错误就发送错误信息
      server?.ws?.on?.("connection", connection);

      global.__eventEmitter.off("buildStart", global.__buildStateFunc);
      // 监听构建完成
      global.__eventEmitter.on("buildStart", global.__buildStateFunc);

      const listeningFunc = async () => {
        global.__server = server;
        global.__buildFuncArray = [() => runBuild()];
        // 如果正在构建，则将任务添加到队列中
        if (!global.__buildInProgress) {
          global.__buildFuncArray?.pop?.()?.();
        }
        // await runBuild();
      };
      // 服务器启动后执行
      server.httpServer?.once("listening", listeningFunc);

      /**------------------------------添加文件监听功能------------------------------- */
      const changeFunc = async (changedPath: string) => {
        const dependencies = Array.from(global.__dependenciesMap.values())
          .flatMap((items: any) => items)
          .find((items: any) =>
            arePathsSameFileSync(items.dependencies, changedPath)
          );

        try {
          global.__changeFuncArrayStatus = true;
          // 检查变化的文件是否是我们监听的文件
          if (!dependencies || !dependencies.path || !existsSync(changedPath))
            return;
          const changedConent = readFileSync(changedPath, "utf-8");
          const conentKey = getHash(changedConent, null);
          // 内容变化判断
          if (global.__jsCatch?.get(changedPath) === conentKey) return;
          global.__jsCatch?.set(changedPath, conentKey);
          await updateFile(dependencies);
          const path =
            normalizePath(dependencies.path)
              ?.replace(normalizePath(process.cwd()), "")
              ?.replace(/^\//, "")
              ?.replace(/.ts$/, ".js") || "";
          const isBackground = isItBackgroundUrl(path);

          // 通知扩展重新加载
          if (isBackground) {
            global.__server.ws.send({
              type: "custom",
              event: "crx-reload",
            });
          } else {
            const contentScripts = global.__finalManifests.content_scripts;
            const scriptArray: any[] = [];
            contentScripts?.forEach((item: any) => {
              const itemPath = item.js?.map((js: any) =>
                normalizePath(js)?.replace(/^\//, "")
              );
              const match = itemPath.includes(path);
              if (match) {
                scriptArray.push(item);
              }
            });
            if (scriptArray.length) {
              global.__server.ws.send({
                type: "custom",
                event: "crx-reload-content_scripts",
                data: scriptArray?.map((i) => ({
                  js: i.js,
                  css: i.css,
                  matches: i.matches,
                  persistAcrossSessions: false,
                })),
              });
            }
          }
          global.__errorState = null;
        } catch (err) {
          try {
            console.log(
              gray(
                `构建文件 ${relative(process.cwd(), dependencies.path)} 失败:`
              ),
              err
            );
            const errlog = prepareError(err as any);
            global.__errorState = errlog;
            global.__server.ws.send({
              type: "crx-error",
              err: errlog,
            });
          } catch (err) {
            console.log(gray(`构建失败:`), err);
          }
        } finally {
          global.__changeFuncArrayStatus = false;
          if (global.__changeFuncArray?.length > 0) {
            global.__eventEmitter.emit("changeStart");
          }
        }
      };

      global.__eventEmitter.off("changeStart", global.__changeStartFunc);
      // 监听构建完成
      global.__eventEmitter.on("changeStart", global.__changeStartFunc);

      const changeFunc1 = async (changedPath: string) => {
        global.__changeFuncArray = [() => changeFunc(changedPath)];
        // 如果正在构建，则将任务添加到队列中
        if (!global.__changeFuncArrayStatus) {
          global.__changeFuncArray?.pop?.()?.();
        }
      };

      // 监听文件变化事件
      server.watcher.on("change", changeFunc1);
      /**------------------------------------------------------------------------ */
    },
    config(config: UserConfig) {
      const configPluginResult = configPlugin({
        config,
        htmlPaths,
        manifestPath,
        manifestData,
        jsPaths,
        copyPaths,
        inlineConfig,
      });
      return configPluginResult;
    },
    configResolved(resolvedConfig) {
      // 重置webSocketToken为固定的值
      (resolvedConfig as any).webSocketToken = "buildCrxNotifierPlugins";
      global.__config = resolvedConfig;
    },
    resolveId(id) {
      // 处理虚拟脚本
      if (
        process.env.BUILD_CRX_NOTIFIER === "dev" &&
        id.startsWith(global.__virtualInlineScript)
      ) {
        return id;
      }
    },
    load(id) {
      // 处理虚拟脚本
      if (
        process.env.BUILD_CRX_NOTIFIER === "dev" &&
        id.startsWith(global.__virtualInlineScript)
      ) {
        const key = id.substring(id.indexOf("?") + 1);
        return global.__inlineScriptContents[key as any];
      }
    },
    async transformIndexHtml(html: string, ctx: any) {
      const { document } = parseHTML(html) as any;
      const path = ctx.path;
      let baseManifest: any = {};
      if (existsSync(manifestPath)) {
        const manifestContent = readFileSync(manifestPath, "utf-8");
        baseManifest = JSON.parse(manifestContent);
      }
      // 给devtools_page生成devtools.js文件用以注册devtools面板
      if (baseManifest.devtools_page) {
        if (
          path.replace(process.cwd(), "").includes(baseManifest.devtools_page)
        ) {
          const devtoolsPanel = document.createElement("script");
          devtoolsPanel.src = `./devtools.js`;
          document.body.appendChild(devtoolsPanel);
        }
      }
      if (process.env.BUILD_CRX_NOTIFIER !== "dev") {
        // 处理内联脚本为外联脚本
        const inlineScripts = document.querySelectorAll("script:not([src])");
        for (let i = 0; i < inlineScripts.length; i++) {
          const script = inlineScripts[i];
          const textContent = script.textContent ?? "";
          const key: string = getHash(textContent);
          const pathDirname = dirname(path);
          const fileName = `${pathDirname.replace(/^\//, "")}/${key}.js`;
          const source: string = await minifyCode(textContent, {
            minify: false,
            format: "esm",
          });
          (this as any).emitFile({
            type: "asset",
            fileName,
            source,
          });
          const virtualScript = document.createElement("script");
          virtualScript.type = "module";
          virtualScript.src = `./${key}.js`;
          script.replaceWith(virtualScript);
        }
        return document.toString();
      }
      // 注入Vite客户端脚本，用于热更新
      const viteClientScript = document.createElement("script");
      viteClientScript.setAttribute("type", "module");
      viteClientScript.setAttribute(
        "src",
        `http://localhost:${
          global.__server?.config?.server?.port || 3000
        }/@vite/client`
      );
      document.head.insertBefore(viteClientScript, document.head.firstChild);

      // 处理内联脚本为虚拟脚本
      const inlineScripts = document.querySelectorAll("script:not([src])");
      for (let i = 0; i < inlineScripts.length; i++) {
        const script = inlineScripts[i];
        const textContent: string = await minifyCode(script.textContent ?? "", {
          minify: false,
          format: "esm",
        });
        const key: string = getHash(textContent);
        global.__inlineScriptContents[key] = textContent;
        const virtualScript = document.createElement("script");
        virtualScript.type = "module";
        virtualScript.src = `http://localhost:${
          global.__server?.config?.server?.port || 3000
        }/@id/${global.__virtualInlineScript}?${key}`;
        script.replaceWith(virtualScript);
      }

      return document.toString();
    },
    async transform(code: string, id: string) {
      if (process.env.BUILD_CRX_NOTIFIER !== "dev") {
        return { code, map: null };
      }
      // 开发模式-匹配中的html文件加sw监听
      if (
        htmlPaths.some((item: { name: string; path: string }) =>
          arePathsSameFileSync(item.path, id)
        )
      ) {
        // 处理html文件路径为开发环境路径
        const { document } = parseHTML(code) as any;
        document
          .querySelectorAll('script[type="module"]')
          .forEach((script: any) => {
            const src = script.getAttribute("src");
            if (
              !src ||
              src.startsWith("http") ||
              src.startsWith("/@vite/client")
            )
              return;
            script.setAttribute(
              "src",
              formatDevUrl(src, global.__server?.config?.server)
            );
          });
        return { code: document.toString(), map: null };
      }
      return { code, map: null };
    },
  };
}

import { resolve, basename, dirname } from "node:path";
import { statSync, readFileSync } from "node:fs";
import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { green, bold, black } from "colorette";
import { stripVTControlCharacters } from "node:util";
import { normalizePath } from "vite";
import type { BinaryLike } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url)); // 获取当前目录[5](@ref)

const ROLLUP_HOOKS = [
  "options",
  "buildStart",
  "buildEnd",
  "renderStart",
  "renderError",
  "renderChunk",
  "writeBundle",
  "generateBundle",
  "banner",
  "footer",
  "augmentChunkHash",
  "outputOptions",
  "renderDynamicImport",
  "resolveFileUrl",
  "resolveImportMeta",
  "intro",
  "outro",
  "closeBundle",
  "closeWatcher",
  "load",
  "moduleParsed",
  "watchChange",
  "resolveDynamicImport",
  "resolveId",
  "shouldTransformCachedModule",
  "transform",
  "onLog",
];
function injectEnvironmentToHooks(
  environment: any,
  plugin: { resolveId: any; load: any; transform: any }
) {
  const { resolveId, load: load$3, transform: transform$2 } = plugin;
  const clone$1: any = { ...plugin };
  for (const hook of Object.keys(clone$1))
    switch (hook) {
      case "resolveId":
        clone$1[hook] = wrapEnvironmentResolveId(environment, resolveId);
        break;
      case "load":
        clone$1[hook] = wrapEnvironmentLoad(environment, load$3);
        break;
      case "transform":
        clone$1[hook] = wrapEnvironmentTransform(environment, transform$2);
        break;
      default:
        if (ROLLUP_HOOKS.includes(hook))
          clone$1[hook] = wrapEnvironmentHook(environment, clone$1[hook]);
        break;
    }
  return clone$1;
}
function getHookHandler(hook: { handler: any }) {
  return typeof hook === "object" ? hook.handler : hook;
}
function wrapEnvironmentResolveId(environment: any, hook: any) {
  if (!hook) return;
  const fn = getHookHandler(hook);
  const handler = function (this: any, id: any, importer: any, options$1: any) {
    return fn.call(
      injectEnvironmentInContext(this, environment),
      id,
      importer,
      injectSsrFlag(options$1, environment)
    );
  };
  if ("handler" in hook)
    return {
      ...hook,
      handler,
    };
  else return handler;
}
function wrapEnvironmentLoad(environment: any, hook: any) {
  if (!hook) return;
  const fn = getHookHandler(hook);
  const handler = function (this: any, id: any, ...args: any[]) {
    return fn.call(
      injectEnvironmentInContext(this, environment),
      id,
      injectSsrFlag(args[0], environment)
    );
  };
  if ("handler" in hook)
    return {
      ...hook,
      handler,
    };
  else return handler;
}
function wrapEnvironmentTransform(environment: any, hook: any) {
  if (!hook) return;
  const fn = getHookHandler(hook);
  const handler = function (
    this: any,
    code: any,
    importer: any,
    ...args: any[]
  ) {
    return fn.call(
      injectEnvironmentInContext(this, environment),
      code,
      importer,
      injectSsrFlag(args[0], environment)
    );
  };
  if ("handler" in hook)
    return {
      ...hook,
      handler,
    };
  else return handler;
}
function wrapEnvironmentHook(environment: any, hook: any) {
  if (!hook) return;
  const fn = getHookHandler(hook);
  if (typeof fn !== "function") return hook;
  const handler = function (this: any, ...args: any[]) {
    return fn.call(injectEnvironmentInContext(this, environment), ...args);
  };
  if ("handler" in hook)
    return {
      ...hook,
      handler,
    };
  else return handler;
}
function injectEnvironmentInContext(
  context: { meta: { viteVersion: any }; environment: any },
  environment: any
) {
  //   context.meta.viteVersion ??= VERSION;
  context.environment ??= environment;
  return context;
}
function injectSsrFlag(
  options$1: any,
  environment: { config: { consumer: string } }
) {
  const ssr = environment ? environment.config.consumer === "server" : true;
  return {
    ...(options$1 ?? {}),
    ssr,
  };
}
// 使用esbuild压缩混淆代码
async function minifyCode(
  code: string,
  config: { minify: boolean; format: string } | any = {
    minify: true,
    format: "esm",
  }
): Promise<string> {
  try {
    const result = await esbuild.transform(code, {
      ...config,
    });
    return result.code;
  } catch (error) {
    console.error("代码压缩混淆失败:", error);
    return code; // 如果压缩失败，返回原始代码
  }
}
// 比较文件路径
function arePathsSameFileSync(path1: string, path2: string) {
  try {
    const stat1 = statSync(path1);
    const stat2 = statSync(path2);
    return stat1.dev === stat2.dev && stat1.ino === stat2.ino;
  } catch (error) {
    return false;
  }
}
function formatDevUrl(src: string, serverConfig: any) {
  const port = serverConfig?.port || 3000;
  const srcPath = src.startsWith("/") ? src : `/${src}`;
  return `http://localhost:${port}${srcPath}`;
}

function extractImports(content: string) {
  const importRegex = /import\s+.*?['"].*?['"];?/gs;
  const imports = content.match(importRegex) || [];
  const cleanedContent = content.replace(importRegex, "");
  return { imports, cleanedContent };
}

// 生成热更新客户端代码
const generateHotReloadCode = async (path: string | boolean) => {
  try {
    const port = global.__server?.config?.server?.port || 3000;
    const socketProtocol = global.__server?.config?.server?.https
      ? "wss"
      : "ws";
    const base = global.__server?.config?.base;
    const socketHost = `localhost:${port}${base}`;
    const wsToken = `${global.__server?.config?.webSocketToken}`;
    const overlay = global.__server?.config?.server?.hmr?.overlay !== false;
    const hmrConfigName = basename(
      global.__server?.config?.configFile || "vite.config.js"
    );
    const base$1 = global.__server?.config?.base || "/";
    const isItB =
      path === true
        ? true
        : path &&
          isItBackgroundUrl(
            normalizePath(path)
              ?.replace(normalizePath(process.cwd()), "")
              ?.replace(/^\//, "")
              ?.replace(/.ts$/, ".js") || ""
          );

    let backgroundEntrypoint = readFileSync(
      resolve(__dirname, "./background-entrypoint.js"),
      "utf-8"
    );
    let backgroundEntrypointClient =
      (!isItB &&
        readFileSync(
          resolve(__dirname, "./background-entrypoint-client.js"),
          "utf-8"
        )) ||
      "";

    if (backgroundEntrypoint) {
      backgroundEntrypoint = backgroundEntrypoint
        .replace("__socketProtocol__", `"${socketProtocol}"`)
        .replace("__socketHost__", `"${socketHost}"`)
        .replace("__overlay__", `${overlay}`)
        .replace("__wsToken__", `"${wsToken}"`);
    }

    if (backgroundEntrypointClient) {
      backgroundEntrypointClient = backgroundEntrypointClient
        .replace("__hmrConfigName__", `"${hmrConfigName}"`)
        .replace("__base$1__", `"${base$1}"`);
    }

    // 取import和内容
    const { imports: imports1, cleanedContent: content1 } =
      extractImports(backgroundEntrypoint);
    const { imports: imports2, cleanedContent: content2 } = extractImports(
      backgroundEntrypointClient
    );

    const mergedImports = [...new Set([...imports1, ...imports2])].join("\n");
    const code = `${mergedImports}\n(function(){\n${content1}\n${content2}\n})()`;

    return code;
  } catch (err) {
    console.log(err);
    return "";
  }
};

const numberFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const displaySize = (bytes: number) => {
  return `${numberFormatter.format(bytes / 1e3)} kB`;
};

function getHash(input: BinaryLike, length: number | null = 12) {
  const hashStr = createHash("sha256").update(input).digest("hex");
  if (length) {
    return hashStr.slice(0, length);
  }
  return hashStr;
}

function cleanStack(stack: string) {
  return stack
    .split(/\n/)
    .filter((l: string) => /^\s*at/.test(l))
    .join("\n");
}

function prepareError(err$2: {
  message: string;
  stack: any;
  id: any;
  frame: any;
  plugin: any;
  pluginCode: { toString: () => any };
  loc: any;
}) {
  return {
    message: stripVTControlCharacters(err$2.message)?.split("/\n")?.shift(),
    stack: stripVTControlCharacters(cleanStack(err$2.stack || "")),
    id: err$2.id,
    frame: stripVTControlCharacters(err$2.frame || ""),
    plugin: "vite-plugin-browserext-hmr",
    pluginCode: err$2.pluginCode?.toString(),
    loc: err$2.loc,
  };
}

const isItBackgroundUrl = (path: string) => {
  const background = global.__finalManifests.background;
  const { service_worker, scripts } = background ?? {};
  if (service_worker) {
    return service_worker?.replace(/^\//, "") === path?.replace(/^\//, "");
  } else if (scripts) {
    return scripts?.some(
      (i: string) => i?.replace(/^\//, "") === path?.replace(/^\//, "")
    );
  }
};

// 防抖函数
function debounce(
  func: { apply: (arg0: any, arg1: IArguments) => void },
  delay: number | undefined,
  immediate: any
) {
  let timer: string | number | NodeJS.Timeout | null | undefined;
  return function (this: any) {
    if (timer) clearTimeout(timer);
    if (immediate) {
      let firstRun = !timer;
      timer = setTimeout(() => {
        timer = null;
      }, delay);
      if (firstRun) {
        func.apply(this, arguments);
      }
    } else {
      timer = setTimeout(() => {
        func.apply(this, arguments);
      }, delay);
    }
  };
}

// 输出文件
const outputFile = async (files: any[]) => {
  const fs: any = await import("fs-extra");
  for (let index = 0; index < files.length; index++) {
    const element = files[index];
    const { fileName, code } = element;
    if (!fileName) continue;
    const dir = global.__config?.build?.outDir ?? "dist";
    const name = `${fileName.startsWith("/") ? "" : `/`}${fileName}`;
    const filePath = `${dir}${name}`;
    await fs.outputFile(filePath, code, "utf-8");
    const size = Buffer.byteLength(code);
    if (name.endsWith(".map") || name.endsWith("manifest.json")) continue;
    console.log(
      `${black(dir)}${green(name)}`,
      "  ",
      black(bold(displaySize(size)))
    );
  }
};

export {
  getHash,
  injectEnvironmentToHooks,
  minifyCode,
  arePathsSameFileSync,
  formatDevUrl,
  generateHotReloadCode,
  outputFile,
  prepareError,
  isItBackgroundUrl,
  debounce,
};

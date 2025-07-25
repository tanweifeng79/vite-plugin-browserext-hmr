// 引入Rollup相关插件
import pluginNodeResolve from "@rollup/plugin-node-resolve"; // 解析node_modules中的模块
import commonjs from "@rollup/plugin-commonjs"; // 支持CommonJS模块
import typescript from "rollup-plugin-typescript2"; // 支持TypeScript
import json from "@rollup/plugin-json"; // 支持导入JSON文件
import externals from "rollup-plugin-node-externals"; // 自动将Node内置模块和依赖标记为external
import copy from "rollup-plugin-copy"; // 用于复制文件
import dts from "rollup-plugin-dts"; // 用于生成声明文件

import { resolve, dirname } from "node:path"; // Node.js路径相关API
import { fileURLToPath } from "node:url"; // Node.js URL转路径

// 获取当前文件所在目录
const __dirname = dirname(fileURLToPath(import.meta.url));

// 外部依赖插件
const externalsPlugin = externals({
  builtins: true, // 标记Node内置模块为external
  deps: true, // 标记dependencies为external
  peerDeps: true, // 标记peerDependencies为external
  devDeps: false, // 不标记devDependencies为external
});

const typescriptPlugin = typescript({});

// 共享的插件配置 - 只用于主构建（源码编译）
const sharedPlugins = [
  pluginNodeResolve(), // 解析node_modules依赖
  commonjs(), // 支持CommonJS模块
  json(), // 支持JSON文件导入
  externalsPlugin,
];

// 复制文件插件 - 只执行一次（在写入bundle后执行）
const copyPlugin = copy({
  targets: [
    {
      src: "./lib/background-entrypoint-client.js", // 要复制的源文件
      dest: "dist", // 目标目录
    },
    {
      src: "./lib/background-entrypoint.js",
      dest: "dist",
    },
    {
      src: "./lib/webcomponents-bundle.js",
      dest: "dist",
    },
    {
      src: "README.md",
      dest: "dist",
    },
    {
      src: "./lib/web-ext-run.d.ts", // 添加web-ext-run.d.ts类型声明文件
      dest: "dist", // 直接复制到dist目录
    },
    {
      src: "package.json",
      dest: "dist",
      // 只保留部分字段，避免将开发相关内容带入发布包
      transform: (content) => {
        const pkg = JSON.parse(content);
        return JSON.stringify(
          {
            name: pkg.name,
            version: pkg.version,
            type: "module", // 明确指定默认使用 ES 模块格式
            main: "index.cjs", // CommonJS 入口点
            module: "index.js", // ES 模块入口点
            exports: {
              // 更精确地控制导入行为
              import: "./index.js", // 使用 import 导入时的入口
              require: "./index.cjs", // 使用 require 导入时的入口
              types: "./index.d.ts", // 类型声明文件
            },
            types: "./index.d.ts",
            license: pkg.license,
            repository: pkg.repository,
            keywords: pkg.keywords,
            dependencies: pkg.dependencies,
          },
          null,
          2
        );
      },
    },
  ],
  hook: "writeBundle", // 确保在写入bundle后执行，只执行一次
});

// 导出Rollup配置
export default [
  // ES模块输出
  {
    input: resolve(__dirname, "index.ts"), // 入口文件
    output: {
      dir: "dist",
      entryFileNames: "index.js",
      format: "es", // ES模块输出
    },
    plugins: [...sharedPlugins, copyPlugin, typescriptPlugin], // 使用共享插件和复制插件
  },
  // CommonJS模块输出
  {
    input: resolve(__dirname, "index.ts"), // 入口文件
    output: {
      dir: "dist",
      entryFileNames: "index.cjs",
      format: "cjs", // CommonJS模块输出
    },
    plugins: [...sharedPlugins, typescriptPlugin], // 使用共享插件，但不重复使用copyPlugin
  },
  // 类型声明文件输出 - 使用rollup-plugin-dts
  {
    input: resolve(__dirname, "index.ts"),
    output: {
      file: "dist/index.d.ts",
      format: "es",
    },
    plugins: [externalsPlugin, dts({})],
  },
];

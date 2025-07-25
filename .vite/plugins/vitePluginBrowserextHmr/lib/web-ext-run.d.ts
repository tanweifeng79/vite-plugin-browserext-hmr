declare module "web-ext-run" {
  /**
   * Firefox 浏览器首选项配置
   */
  interface FirefoxPreferences {
    [key: string]: boolean | number | string;
  }

  /**
   * 运行浏览器扩展的选项
   */
  interface RunOptions {
    /** 浏览器类型，如 'firefox-desktop', 'firefox-android', 'chromium' */
    target?: string | string[];
    /** 扩展源码目录路径 */
    sourceDir?: string;
    /** 是否在浏览器中打开开发者工具 */
    devtools?: boolean;
    /** 是否在浏览器中打开扩展管理页面 */
    browserConsole?: boolean;
    /** 启动浏览器后是否保持运行 */
    keepProfileChanges?: boolean;
    /** 是否在终端中显示重新加载信息 */
    noReload?: boolean;
    /** 是否禁止重新加载管理器扩展 */
    noReloadManagerExtension?: boolean;
    /** 自定义 Firefox 首选项配置 */
    pref?: FirefoxPreferences;
    /** 自定义 Firefox 配置文件路径 */
    profilePath?: string;
    /** 自定义 Firefox 二进制文件路径 */
    firefox?: string;
    /** 自定义 Chromium 二进制文件路径 */
    chromiumBinary?: string;
    /** 自定义 Chrome 二进制文件路径 */
    chromeBinary?: string;
    /** 自定义 Edge 二进制文件路径 */
    edgeBinary?: string;
    /** 启动浏览器时打开的 URL */
    startUrl?: string | string[];
    /** 监听文件变化的目录 */
    watchFile?: string[];
    /** 忽略监听文件变化的目录 */
    ignoreFiles?: string[];
    /** 传递给浏览器的命令行参数 */
    args?: string[];
    /** 是否安装临时扩展 */
    install?: boolean;
    /** 是否预安装扩展 */
    preInstall?: boolean;
    /** 是否禁用交互式输入 */
    noInput?: boolean;
    /** 是否禁止重新安装扩展 */
    noReinstall?: boolean;
    /** 自定义 Chromium 配置文件路径 */
    chromiumProfile?: string;
  }

  /**
   * 运行结果对象
   */
  interface RunResult {
    /** 退出运行的方法 */
    exit: () => Promise<void>;
    /** 重新加载所有扩展的方法 */
    reloadAllExtensions?: () => Promise<void>;
    /** 重新加载特定扩展的方法 */
    reloadExtensionBySourceDir?: (sourceDir: string) => Promise<void>;
  }

  /**
   * Web 扩展配置
   */
  interface WebExtConfig {
    /** 源码目录配置 */
    sourceDir?: string;
    /** 是否禁用自动重新加载 */
    noReload?: boolean;
    /** 自定义配置文件路径 */
    configPath?: string;
    /** 是否在完成操作后退出程序 */
    shouldExitProgram?: boolean;
  }

  /**
   * web-ext-run 命令模块
   */
  export const cmd: {
    /**
     * 运行浏览器扩展进行开发和调试
     * @param options 运行选项
     * @param config 配置选项
     * @returns 包含控制运行实例的方法的对象
     */
    run: (options: RunOptions, config?: WebExtConfig) => Promise<RunResult>;
  };
}

interface WebExtRunPluginOptions {
  wxtUserConfig: {
    browser: string;
    binaries: {
      firefox?: string;
      chromium?: string;
      edge?: string;
    };
    chromiumProfile: string;
    chromiumPref: string;
    chromiumArgs: string[];
    firefoxProfile: string;
    firefoxPrefs: string;
    firefoxArgs: string[];
    openConsole: boolean;
    openDevtools: boolean;
    startUrls: string[];
    keepProfileChanges: boolean;
    outDir: string;
  };
}

/**
 * 启动web-ext-run进程
 * @param param0
 * @param wxtUserConfig 配置
 * @param wxtUserConfig.browser 浏览器类型
 * @param wxtUserConfig.binaries 浏览器二进制文件--览器地址栏输入 chrome://version/，然后文件地址就是这个只需要的浏览器二进制文件
 * @param wxtUserConfig.chromiumProfile 浏览器配置文件
 * @param wxtUserConfig.chromiumPref 浏览器偏好设置
 * @param wxtUserConfig.chromiumArgs 浏览器参数
 * @param wxtUserConfig.firefoxProfile 火狐浏览器配置文件
 * @param wxtUserConfig.firefoxPrefs 火狐浏览器偏好设置
 * @param wxtUserConfig.firefoxArgs 火狐浏览器参数
 * @param wxtUserConfig.openConsole 是否打开浏览器控制台
 * @param wxtUserConfig.openDevtools 是否打开浏览器开发者工具
 * @param wxtUserConfig.startUrls 启动URL
 * @param wxtUserConfig.keepProfileChanges 是否保持浏览器配置
 * @param wxtUserConfig.outDir 输出目录
 * @returns
 */
export const webExtRunPlugin = async ({
  wxtUserConfig,
}: WebExtRunPluginOptions) => {
  const { cmd } = await import("web-ext-run");
  global.__eventEmitter.on("web-ext-run-start", async () => {
    if (
      global.__runnerNum !== 0 ||
      !global.__buildCompleted ||
      global.__buildInProgress ||
      global.__runner
    )
      return;
    await global.__runner?.exit().catch(() => {});
    // 启动web-ext-run进程
    global.__runner = await cmd
      .run(
        {
          browserConsole: wxtUserConfig?.openConsole,
          devtools: wxtUserConfig?.openDevtools,
          startUrl: wxtUserConfig?.startUrls,
          keepProfileChanges: wxtUserConfig?.keepProfileChanges,
          ...(wxtUserConfig.browser === "firefox"
            ? {
                firefox: wxtUserConfig?.binaries?.firefox,
                firefoxProfile: wxtUserConfig?.firefoxProfile,
                prefs: wxtUserConfig?.firefoxPrefs,
                args: wxtUserConfig?.firefoxArgs,
              }
            : {
                chromiumBinary:
                  wxtUserConfig?.binaries?.[
                    wxtUserConfig.browser as "firefox" | "chromium" | "edge"
                  ],
                chromiumProfile: wxtUserConfig?.chromiumProfile,
                chromiumPref: {
                  devtools: {
                    synced_preferences_sync_disabled: {
                      // Remove content scripts from sourcemap debugger ignore list so stack traces
                      // and log locations show up properly, see:
                      // https://github.com/wxt-dev/wxt/issues/236#issuecomment-1915364520
                      skipContentScripts: false,
                      // Was renamed at some point, see:
                      // https://github.com/wxt-dev/wxt/issues/912#issuecomment-2284288171
                      "skip-content-scripts": false,
                    },
                  },
                },
                args: [
                  "--unsafely-disable-devtools-self-xss-warnings",
                  "--disable-features=DisableLoadExtensionCommandLineSwitch",
                  ...(wxtUserConfig?.chromiumArgs ?? []),
                ],
              }),
          target:
            wxtUserConfig.browser === "firefox"
              ? "firefox-desktop"
              : "chromium",
          sourceDir: wxtUserConfig.outDir,
          noReloadManagerExtension: true,
          noReload: true,
          noInput: true,
        },
        { shouldExitProgram: false }
      )
      .catch((err: any) => {
        console.error("浏览器启动失败:", err);
      });
    global.__runnerNum++;
  });

  // 监听关闭事件，关闭web-ext-run进程
  global.__eventEmitter.on("web-ext-run-close", async () => {
    if (global.__runnerNum > 0) {
      await global.__runner?.exit().catch(() => {});
      global.__runnerNum--;
    }
  });
};

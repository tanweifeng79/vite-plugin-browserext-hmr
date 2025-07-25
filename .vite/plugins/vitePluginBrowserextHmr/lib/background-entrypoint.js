import { MatchPattern } from "@webext-core/match-patterns";

// Chrome扩展热更新客户端代码
const browser = globalThis.browser?.runtime?.id
  ? globalThis.browser
  : globalThis.chrome;
const socketProtocol = __socketProtocol__;
const socketHost = __socketHost__;
const overlay = __overlay__;
const wsToken = __wsToken__;
let heartbeatTimer = null;

function connectDevServer() {
  try {
    const ws = new WebSocket(
      `${socketProtocol}://${socketHost}?token=${wsToken}`,
      "vite-hmr"
    );
    ws.addEventListener("open", () => {
      console.debug("Connected to dev server");
      startHeartbeat();
    });
    ws.addEventListener("close", () => {
      console.debug(
        "Disconnected from dev server, attempting to reconnect in 1s..."
      );
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      setTimeout(connectDevServer, 5000);
    });
    ws.addEventListener("error", (event) => {
      console.error("Failed to connect to dev server", event);
    });

    // 工具函数：生成content script的唯一ID
    const getScriptId = (item) => `crx:${item.js?.join?.("-")}`;

    // 工具函数：批量操作content scripts
    const batchOperateContentScripts = async (data, handler) => {
      if (!Array.isArray(data)) return;
      for (const item of data) {
        const id = getScriptId(item);
        await handler(item, id);
      }
    };

    /**
     * 优化后的消息处理函数，提升可读性、健壮性和性能
     */
    const messageHandler = async (e) => {
      let message;
      try {
        message = JSON.parse(e.data);
      } catch (err) {
        console.error("Message parsing failed:", err, e.data);
        return;
      }
      try {
        if (
          message.type === "custom" &&
          message.event === "crx-reload-content_scripts-register"
        ) {
          // 处理 content_scripts 注册
          const ids = message?.data?.map(getScriptId);
          let registered = [];
          try {
            registered =
              (await browser?.scripting?.getRegisteredContentScripts?.({
                ids,
              })) || [];
          } catch (err) {
            // 某些浏览器可能不支持该API，忽略
            registered = [];
          }
          // 如果全部已注册，则只需更新
          if (registered.length === message?.data?.length) {
            await batchOperateContentScripts(
              message.data,
              async (_item, id) => {
                await browser?.scripting?.updateContentScripts?.([
                  { allFrames: true, id },
                ]);
              }
            );
            return;
          }
          // 否则先全部注销再注册
          try {
            await browser?.scripting?.unregisterContentScripts?.({ ids });
          } catch (err) {}
          await batchOperateContentScripts(message.data, async (item, id) => {
            await browser?.scripting?.registerContentScripts?.([
              { ...item, id },
            ]);
          });
        } else if (
          message.type === "custom" &&
          message.event === "crx-reload-content_scripts"
        ) {
          // 处理 content_scripts 热重载
          let registered = [];
          try {
            registered =
              (await browser?.scripting?.getRegisteredContentScripts?.()) || [];
          } catch (err) {
            registered = [];
          }
          await batchOperateContentScripts(message.data, async (item, id) => {
            const existing = registered.find?.((cs) => cs.id === id);
            if (existing) {
              await browser?.scripting?.updateContentScripts?.([
                { allFrames: true, id },
              ]);
            } else {
              await browser?.scripting?.registerContentScripts?.([
                { ...item, id },
              ]);
            }
          });
          // 只刷新用到这个插件的窗口
          let allTabs = [];
          try {
            allTabs = (await browser?.tabs?.query({})) || [];
          } catch (err) {
            console.warn("Failed to retrieve tab:", err);
            return;
          }
          if (!allTabs.length) return;
          const matchPatterns = message?.data
            ?.map((i) => i.matches)
            ?.flat()
            ?.map((match) => new MatchPattern(match));
          const matchingTabs = allTabs?.filter((tab) => {
            const url = tab.url;
            if (!url) return false;
            return !!matchPatterns?.find((pattern) => pattern.includes(url));
          });
          await Promise.all(
            matchingTabs?.map(async (tab) => {
              try {
                await browser.tabs.reload(tab.id);
              } catch (err) {
                console.warn("Failed to reload tab:", err);
              }
            })
          );
        } else if (
          message.type === "custom" &&
          (message.event === "crx-reload" ||
            message.event === "vite:ws:disconnect")
        ) {
          // 处理扩展重载
          browser.runtime?.reload?.();
        } else if (message.type === "update") {
          // 处理错误覆盖层
          try {
            if (overlay && typeof clearErrorOverlay === "function") {
              clearErrorOverlay();
            }
          } catch (e) {}
        } else if (
          (message.type === "error" || message.type === "crx-error") &&
          message.err
        ) {
          // 处理构建错误
          if (overlay && typeof createErrorOverlay === "function") {
            createErrorOverlay(message.err);
          } else {
            console.warn(
              `[vite-plugin-browserext-hmr] Internal Server Error\n${message.err.message}\n${message.err.stack}`
            );
          }
        }
      } catch (err) {
        console.error("Message processing exception:", err, message);
      }
    };

    ws.addEventListener("message", (e) => messageHandler(e));
    return ws;
  } catch (error) {
    console.error("Error setting up WebSocket connection:", error);
    setTimeout(connectDevServer, 5000);
    return null;
  }
}

// 初始化热更新
const ws = connectDevServer();

function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      // 发送心跳并启动超时检测
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 30000);
}

// 添加卸载清理
globalThis?.addEventListener?.("beforeunload", () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.close();
  }
  if (heartbeatTimer) clearInterval(heartbeatTimer);
});

function keepServiceWorkerAlive() {
  setInterval(async () => {
    await browser.runtime?.getPlatformInfo?.();
  }, 5e3);
}
keepServiceWorkerAlive();

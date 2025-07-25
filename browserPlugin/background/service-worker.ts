import "../../src/service-worker/index";
console.log(222);

/**
 * 删除所有动态注册的内容脚本
 * @param {Array<string>} [ids] - 可选的脚本ID数组，如果不提供则删除所有脚本
 * @returns {Promise<void>}
 */
async function unregisterAllContentScripts(ids?: string[]) {
  try {
    if (ids && ids.length > 0) {
      // 如果提供了特定的脚本ID，则只删除这些脚本
      await chrome.scripting.unregisterContentScripts({ ids });
      console.log(`已成功注销指定的内容脚本: ${ids.join(", ")}`);
    } else {
      // 获取所有已注册的内容脚本
      const registeredScripts =
        await chrome.scripting.getRegisteredContentScripts();

      if (registeredScripts && registeredScripts.length > 0) {
        // 提取所有脚本的ID
        const scriptIds = registeredScripts.map((script) => script.id);

        // 注销所有内容脚本
        await chrome.scripting.unregisterContentScripts({ ids: scriptIds });
        console.log(`已成功注销所有内容脚本: ${scriptIds.join(", ")}`);
      } else {
        console.log("没有找到已注册的内容脚本");
      }
    }
  } catch (error) {
    console.error(`注销内容脚本时出错: ${error}`);
  }
}

// 监听来自popup或其他扩展页面的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "unregisterContentScripts") {
    unregisterAllContentScripts(message.ids)
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({ success: false, error: error.toString() })
      );
    return true; // 保持消息通道打开，以便异步响应
  }
});

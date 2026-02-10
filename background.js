import { api, wait } from './utils.js';

api.runtime.onInstalled.addListener(() => {
    api.contextMenus.create({
        id: "capture-full-page",
        title: "Gnomad: Capture Full Page (PDF)",
        contexts: ["page"]
    });
});

api.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "capture-full-page") {
        executeCapture(tab.id, { hideSticky: true, delay: 500 });
    }
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "initiateCapture") {
        executeCapture(message.tabId, message.options);
    }
});

async function executeCapture(tabId, options) {
    try {
        // 1. Prepare and Identify Scroll Target
        // We inject content.js first so it can find the scrollable element
        await api.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });

        const results = await api.tabs.sendMessage(tabId, { action: "getDimensions" });
        const { height, width, vh, dpr } = results;

        // Progress Indicator
        api.action.setBadgeText({ text: "0%" });
        api.action.setBadgeBackgroundColor({ color: "#4f46e5" });

        const chunks = [];
        let currentY = 0;

        // 2. Prepare Page (Hide scrollbars/sticky)
        await api.tabs.sendMessage(tabId, { action: "prepare", options });

        // 3. Capture Loop
        while (currentY < height) {
            // Logic: Ensure we don't scroll past the bottom
            const scrollTarget = Math.min(currentY, height - vh);

            // Update Badge
            const progress = Math.min(100, Math.round((currentY / height) * 100));
            api.action.setBadgeText({ text: `${progress}%` });

            await api.tabs.sendMessage(tabId, { action: "scroll", y: scrollTarget });

            // Wait for lazy-loading elements/animations to settle
            await wait(options.delay || 500);

            const dataUri = await api.tabs.captureVisibleTab(null, { format: 'png' });

            chunks.push({
                dataUri,
                y: scrollTarget * dpr
            });

            currentY += vh;
            // Safety break to prevent infinite loops
            if (chunks.length > 50) break;
            if (currentY >= height) break;
        }

        api.action.setBadgeText({ text: "100%" });
        setTimeout(() => api.action.setBadgeText({ text: "" }), 2000);

        // 4. Cleanup page
        await api.tabs.sendMessage(tabId, { action: "reset" });

        // 5. Store data and open Editor
        const captureKey = `gnomad_${Date.now()}`;
        await api.storage.local.set({
            [captureKey]: { chunks, width, height, dpr, vh }
        });

        api.tabs.create({ url: `editor.html?id=${captureKey}` });

    } catch (err) {
        console.error("Capture Failed:", err);
        api.action.setBadgeText({ text: "ERR" });
        api.action.setBadgeBackgroundColor({ color: "#ef4444" });
    }
}

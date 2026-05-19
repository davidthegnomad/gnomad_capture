import { api, wait } from './utils.js';
import { computeScrollPositions } from './lib/stitch.js';

const RESTRICTED_PREFIXES = ['chrome:', 'chrome-extension:', 'chrome-devtools:', 'edge:', 'about:', 'moz-extension:'];

function isRestrictedUrl(url) {
    if (!url) return true;
    return RESTRICTED_PREFIXES.some((p) => url.startsWith(p));
}

api.runtime.onInstalled.addListener(() => {
    api.contextMenus.removeAll(() => {
        api.contextMenus.create({
            id: 'capture-full-page',
            title: 'Gnomad: Capture Full Page',
            contexts: ['page'],
        });
    });
});

api.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'capture-full-page' && tab?.id) {
        executeCapture(tab.id, { hideSticky: true, delay: 500 });
    }
});

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'initiateCapture') {
        executeCapture(message.tabId, message.options || {})
            .then(() => sendResponse({ ok: true }))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;
    }
    return false;
});

async function injectContentScript(tabId) {
    await api.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
    });
}

async function sendTabMessage(tabId, message) {
    return api.tabs.sendMessage(tabId, message);
}

async function executeCapture(tabId, options) {
    let tab;
    try {
        tab = await api.tabs.get(tabId);
        if (isRestrictedUrl(tab.url)) {
            throw new Error('Cannot capture this page (browser or extension URL).');
        }

        await injectContentScript(tabId);

        const dimensions = await sendTabMessage(tabId, { action: 'getDimensions' });
        if (!dimensions?.height || !dimensions?.vh) {
            throw new Error('Could not read page dimensions.');
        }

        const { height, width, vh, dpr } = dimensions;
        const delay = options.delay ?? 500;
        const scrollPositions = computeScrollPositions(height, vh);

        api.action.setBadgeText({ tabId, text: '…' });
        api.action.setBadgeBackgroundColor({ color: '#4f46e5' });

        await sendTabMessage(tabId, { action: 'prepare', options });

        const chunks = [];
        let prevScrollY = null;

        for (let i = 0; i < scrollPositions.length; i++) {
            const scrollY = scrollPositions[i];
            const progress = Math.min(100, Math.round((scrollY / Math.max(height, 1)) * 100));
            api.action.setBadgeText({ tabId, text: `${progress}%` });

            await sendTabMessage(tabId, { action: 'scroll', y: scrollY });
            await wait(delay);

            const dataUri = await api.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

            chunks.push({
                dataUri,
                scrollY,
                prevScrollY,
                index: i,
            });

            prevScrollY = scrollY;
        }

        api.action.setBadgeText({ tabId, text: '✓' });
        setTimeout(() => api.action.setBadgeText({ tabId, text: '' }), 2000);

        const captureKey = `gnomad_${Date.now()}`;
        await api.storage.local.set({
            [captureKey]: {
                chunks,
                width,
                height,
                vh,
                dpr,
                capturedAt: Date.now(),
            },
        });

        const editorUrl = api.runtime.getURL(`editor.html?id=${encodeURIComponent(captureKey)}`);
        await api.tabs.create({ url: editorUrl });
    } catch (err) {
        console.error('Gnomad Capture failed:', err);
        api.action.setBadgeText({ tabId, text: 'ERR' });
        api.action.setBadgeBackgroundColor({ color: '#ef4444' });
        setTimeout(() => api.action.setBadgeText({ tabId, text: '' }), 3000);
        throw err;
    } finally {
        try {
            await sendTabMessage(tabId, { action: 'reset' });
        } catch {
            // Tab may have closed or navigated away
        }
    }
}

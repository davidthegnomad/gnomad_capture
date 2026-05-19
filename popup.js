const api = globalThis.browser || globalThis.chrome;

const RESTRICTED = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'devtools:'];

function isRestricted(url) {
    return !url || RESTRICTED.some((p) => url.startsWith(p));
}

document.getElementById('capBtn').addEventListener('click', async () => {
    const btn = document.getElementById('capBtn');
    const errEl = document.getElementById('error');

    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Capturing…';

    try {
        const [tab] = await api.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            throw new Error('No active tab.');
        }
        if (isRestricted(tab.url)) {
            throw new Error('Cannot capture browser or extension pages. Open a normal website first.');
        }

        const res = await api.runtime.sendMessage({
            action: 'initiateCapture',
            tabId: tab.id,
            options: {
                hideSticky: document.getElementById('sticky').checked,
                delay: Math.max(100, parseInt(document.getElementById('delay').value, 10) || 500),
            },
        });

        if (res && res.ok === false) {
            throw new Error(res.error || 'Capture failed.');
        }

        window.close();
    } catch (e) {
        errEl.textContent = e.message || 'Capture failed.';
        btn.disabled = false;
        btn.textContent = 'Capture Full Page';
    }
});

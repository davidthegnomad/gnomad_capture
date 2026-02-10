document.getElementById('capBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.runtime.sendMessage({
        action: "initiateCapture",
        tabId: tab.id,
        options: {
            hideSticky: document.getElementById('sticky').checked,
            delay: parseInt(document.getElementById('delay').value)
        }
    });
    window.close();
});

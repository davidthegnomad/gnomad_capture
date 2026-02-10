(function () {
    let originalStyle = "";
    let scrollTarget = null;
    let hiddenElements = [];

    const api = globalThis.browser || globalThis.chrome;

    function findMainScrollable() {
        // 1. Start with candidates that scroll vertical and have content larger than view
        const candidates = Array.from(document.querySelectorAll('*'))
            .filter(el => {
                const style = window.getComputedStyle(el);
                return (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                    el.scrollHeight > el.clientHeight;
            });

        if (candidates.length === 0) return window;

        // 2. Sort by largest area (Client Width * Client Height) to find the "Main" container
        candidates.sort((a, b) => {
            return (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight);
        });

        // 3. Return the largest scrollable element, or window if none are significant
        return candidates[0] || window;
    }

    api.runtime.onMessage.addListener((req, sender, sendResponse) => {
        if (req.action === "getDimensions") {
            scrollTarget = findMainScrollable();

            const isWindow = scrollTarget === window;
            const height = isWindow ? document.documentElement.scrollHeight : scrollTarget.scrollHeight;
            const width = isWindow ? document.documentElement.scrollWidth : scrollTarget.scrollWidth;
            const vh = isWindow ? window.innerHeight : scrollTarget.clientHeight;

            sendResponse({
                height,
                width,
                vh,
                dpr: window.devicePixelRatio || 1,
                isWindow
            });
            return true;
        }

        if (req.action === "prepare") {
            // Inject Scrollbar Hiding CSS
            const style = document.createElement('style');
            style.id = "gnomad-capture-styles";
            style.textContent = `
                ::-webkit-scrollbar { display: none !important; }
                body { -ms-overflow-style: none !important; scrollbar-width: none !important; }
            `;
            document.head.appendChild(style);

            // Hide Scrollbars on target
            if (scrollTarget && scrollTarget !== window) {
                originalStyle = scrollTarget.style.overflow;
                scrollTarget.style.overflow = "hidden"; // This might lock scroll? verify.
                // actually for capture we might need it 'visible' but scrollbar hidden?
                // classic extensions usually set overflow: hidden on body but manage scrollTop manually.
                // For now, let's trust the CSS hide and keep overflow changes minimal to avoid locking.
            } else {
                originalStyle = document.body.style.overflow;
                document.body.style.overflow = "hidden";
            }

            // Redact/Hide Sticky elements if requested
            if (req.options.hideSticky) {
                const elements = document.querySelectorAll('*');
                elements.forEach(el => {
                    const pos = window.getComputedStyle(el).position;
                    // Also hide 'fixed' headers often found in modern frameworks
                    if (pos === 'fixed' || pos === 'sticky') {
                        hiddenElements.push({ el, opacity: el.style.opacity, pointer: el.style.pointerEvents });
                        el.style.opacity = "0";
                        el.style.pointerEvents = "none";
                    }
                });
            }
            sendResponse(true);
        }

        if (req.action === "scroll") {
            if (scrollTarget && scrollTarget !== window) {
                scrollTarget.scrollTo({ top: req.y, behavior: 'auto' });
            } else {
                window.scrollTo({ top: req.y, behavior: 'auto' });
            }
            sendResponse(true);
        }

        if (req.action === "reset") {
            const style = document.getElementById('gnomad-capture-styles');
            if (style) style.remove();

            if (scrollTarget && scrollTarget !== window) {
                scrollTarget.style.overflow = originalStyle;
            } else {
                document.body.style.overflow = originalStyle;
            }

            hiddenElements.forEach(item => {
                item.el.style.opacity = item.opacity;
                item.el.style.pointerEvents = item.pointer;
            });
            hiddenElements = [];
            scrollTarget = null;
            sendResponse(true);
        }
    });
})();

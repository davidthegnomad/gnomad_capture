/**
 * Injected once per tab (guarded). Handles scroll, dimensions, sticky hide.
 */
(function () {
    const api = globalThis.browser || globalThis.chrome;

    if (globalThis.__gnomadCaptureListenerAttached) {
        return;
    }
    globalThis.__gnomadCaptureListenerAttached = true;

    const state = {
        scrollTarget: null,
        bodyOverflow: '',
        targetOverflow: '',
        hiddenElements: [],
    };

    function findMainScrollable() {
        const candidates = Array.from(document.querySelectorAll('*')).filter((el) => {
            const style = window.getComputedStyle(el);
            return (
                (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                el.scrollHeight > el.clientHeight + 2
            );
        });

        if (candidates.length === 0) return window;

        candidates.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
        return candidates[0] || window;
    }

    function isWindowTarget() {
        return !state.scrollTarget || state.scrollTarget === window;
    }

    function scrollToY(y) {
        if (isWindowTarget()) {
            window.scrollTo({ top: y, left: 0, behavior: 'auto' });
        } else {
            state.scrollTarget.scrollTo({ top: y, left: 0, behavior: 'auto' });
        }
    }

    function getMetrics() {
        const isWindow = isWindowTarget();
        const height = isWindow
            ? Math.max(
                  document.documentElement.scrollHeight,
                  document.body?.scrollHeight || 0
              )
            : state.scrollTarget.scrollHeight;
        const width = isWindow
            ? Math.max(
                  document.documentElement.scrollWidth,
                  document.body?.scrollWidth || 0
              )
            : state.scrollTarget.scrollWidth;
        const vh = isWindow ? window.innerHeight : state.scrollTarget.clientHeight;

        return {
            height,
            width,
            vh,
            dpr: window.devicePixelRatio || 1,
            isWindow,
        };
    }

    api.runtime.onMessage.addListener((req, _sender, sendResponse) => {
        try {
            if (req.action === 'getDimensions') {
                state.scrollTarget = findMainScrollable();
                sendResponse(getMetrics());
                return true;
            }

            if (req.action === 'prepare') {
                state.scrollTarget = state.scrollTarget || findMainScrollable();

                let style = document.getElementById('gnomad-capture-styles');
                if (!style) {
                    style = document.createElement('style');
                    style.id = 'gnomad-capture-styles';
                    style.textContent = `
                        html, body { scrollbar-width: none !important; -ms-overflow-style: none !important; }
                        ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
                    `;
                    (document.head || document.documentElement).appendChild(style);
                }

                // Do NOT set overflow:hidden on body — it blocks window.scrollTo during capture.
                state.bodyOverflow = document.body.style.overflow;
                state.targetOverflow = '';

                if (req.options?.hideSticky) {
                    state.hiddenElements = [];
                    document.querySelectorAll('*').forEach((el) => {
                        const pos = window.getComputedStyle(el).position;
                        if (pos === 'fixed' || pos === 'sticky') {
                            state.hiddenElements.push({
                                el,
                                visibility: el.style.visibility,
                                pointer: el.style.pointerEvents,
                            });
                            el.style.visibility = 'hidden';
                            el.style.pointerEvents = 'none';
                        }
                    });
                }

                sendResponse({ ok: true });
                return true;
            }

            if (req.action === 'scroll') {
                scrollToY(req.y);
                sendResponse({ ok: true });
                return true;
            }

            if (req.action === 'reset') {
                const style = document.getElementById('gnomad-capture-styles');
                if (style) style.remove();

                document.body.style.overflow = state.bodyOverflow;

                if (state.scrollTarget && state.scrollTarget !== window) {
                    state.scrollTarget.style.overflow = state.targetOverflow;
                }

                state.hiddenElements.forEach((item) => {
                    item.el.style.visibility = item.visibility;
                    item.el.style.pointerEvents = item.pointer;
                });

                state.hiddenElements = [];
                state.scrollTarget = null;
                state.bodyOverflow = '';
                state.targetOverflow = '';

                sendResponse({ ok: true });
                return true;
            }
        } catch (err) {
            sendResponse({ ok: false, error: err.message });
            return true;
        }

        return false;
    });
})();

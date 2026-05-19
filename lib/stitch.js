/**
 * Pure helpers for full-page capture stitching (testable without DOM).
 */

const MAX_CHUNKS = 50;

/**
 * @param {number} pageHeightCss - Total scrollable height in CSS px
 * @param {number} viewportHeightCss - Viewport height in CSS px
 * @returns {number[]} Scroll positions (CSS px) for each capture
 */
export function computeScrollPositions(pageHeightCss, viewportHeightCss) {
  if (pageHeightCss <= 0 || viewportHeightCss <= 0) return [0];
  if (pageHeightCss <= viewportHeightCss + 2) return [0];

  const positions = [];
  let y = 0;

  while (positions.length < MAX_CHUNKS) {
    positions.push(y);
    const nextY = y + viewportHeightCss;
    if (nextY >= pageHeightCss - 1) break;
    y = nextY;
  }

  const last = Math.max(0, pageHeightCss - viewportHeightCss);
  const tail = positions[positions.length - 1];
  if (last > tail) {
    if (positions.length >= MAX_CHUNKS) {
      positions[positions.length - 1] = last;
    } else {
      positions.push(last);
    }
  }

  return positions;
}

/**
 * Crop overlap from the top of a chunk (device pixels).
 */
export function computeCropTopPx(scrollYCss, prevScrollYCss, viewportHeightCss, dpr) {
  if (prevScrollYCss == null || scrollYCss <= 0) return 0;
  const prevBottomCss = prevScrollYCss + viewportHeightCss;
  const overlapCss = Math.max(0, prevBottomCss - scrollYCss);
  return Math.round(overlapCss * dpr);
}

/**
 * @returns {{ destY: number, sourceY: number, drawHeight: number }}
 */
export function computeDrawRect(
  scrollYCss,
  pageHeightCss,
  viewportHeightCss,
  chunkHeightPx,
  dpr,
  cropTopPx
) {
  const destY = Math.round(scrollYCss * dpr);
  const sourceY = cropTopPx;
  const remainingPx = Math.round(pageHeightCss * dpr) - destY;
  const visiblePx = Math.round(viewportHeightCss * dpr) - cropTopPx;
  const drawHeight = Math.min(chunkHeightPx - sourceY, visiblePx, remainingPx);

  return {
    destY,
    sourceY,
    drawHeight: Math.max(0, drawHeight),
  };
}

/**
 * Total canvas height in device pixels from scroll positions and chunk height.
 */
export function computeCanvasHeightPx(scrollPositionsCss, viewportHeightCss, pageHeightCss, chunkHeightPx, dpr) {
  let maxH = 0;
  let prev = null;
  for (const scrollY of scrollPositionsCss) {
    const cropTop = computeCropTopPx(scrollY, prev, viewportHeightCss, dpr);
    const { destY, drawHeight } = computeDrawRect(
      scrollY,
      pageHeightCss,
      viewportHeightCss,
      chunkHeightPx,
      dpr,
      cropTop
    );
    maxH = Math.max(maxH, destY + drawHeight);
    prev = scrollY;
  }
  return maxH;
}

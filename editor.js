import { api } from './utils.js';
import { computeCropTopPx, computeDrawRect, computeCanvasHeightPx } from './lib/stitch.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let isDrawing = false;
let startX = 0;
let startY = 0;

function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#fca5a5' : '#94a3b8';
}

async function loadImage(src) {
    const img = new Image();
    img.src = src;
    await new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to decode capture chunk'));
    });
    return img;
}

function normalizeChunks(chunks, dpr) {
    return chunks.map((c, i) => {
        const scrollY = c.scrollY ?? (typeof c.y === 'number' ? c.y / dpr : 0);
        const prev = chunks[i - 1];
        const prevScrollY =
            c.prevScrollY ??
            (i > 0 ? (prev.scrollY ?? (typeof prev.y === 'number' ? prev.y / dpr : 0)) : null);
        return {
            dataUri: c.dataUri,
            scrollY,
            prevScrollY,
            index: c.index ?? i,
        };
    });
}

async function stitchCapture(data) {
    if (!data?.chunks?.length) {
        throw new Error('No capture data found.');
    }

    const { height, vh, dpr } = data;
    const chunks = normalizeChunks(data.chunks, dpr);
    const firstImg = await loadImage(chunks[0].dataUri);
    const chunkW = firstImg.width;
    const chunkH = firstImg.height;

    const scrollPositions = chunks.map((c) => c.scrollY);
    const canvasH = computeCanvasHeightPx(scrollPositions, vh, height, chunkH, dpr);

    canvas.width = chunkW;
    canvas.height = Math.max(canvasH, 1);

    const cssWidth = Math.round(chunkW / dpr);
    const cssHeight = Math.round(canvas.height / dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    for (const chunk of chunks) {
        const img = chunk.index === 0 ? firstImg : await loadImage(chunk.dataUri);
        const cropTop = computeCropTopPx(chunk.scrollY, chunk.prevScrollY, vh, dpr);
        const { destY, sourceY, drawHeight } = computeDrawRect(
            chunk.scrollY,
            height,
            vh,
            chunkH,
            dpr,
            cropTop
        );

        if (drawHeight <= 0) continue;

        ctx.drawImage(
            img,
            0,
            sourceY,
            chunkW,
            drawHeight,
            0,
            destY,
            chunkW,
            drawHeight
        );
    }

    setStatus(`Stitched ${chunks.length} sections · ${cssWidth}×${cssHeight}px`);
}

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        setStatus('Missing capture id.', true);
        return;
    }

    setStatus('Loading capture…');

    try {
        const stored = await api.storage.local.get(id);
        const data = stored[id];
        await stitchCapture(data);
    } catch (err) {
        console.error(err);
        setStatus(err.message || 'Failed to load capture.', true);
    }

    canvas.addEventListener('mousedown', startRedacting);
    canvas.addEventListener('mousemove', drawRedacting);
    canvas.addEventListener('mouseup', stopRedacting);
});

function startRedacting(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    startX = (e.clientX - rect.left) * scale;
    startY = (e.clientY - rect.top) * scale;
}

function drawRedacting() {
    // Live preview optional
}

function stopRedacting(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const endX = (e.clientX - rect.left) * scale;
    const endY = (e.clientY - rect.top) * scale;

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    if (w > 2 && h > 2) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, w, h);
    }
    isDrawing = false;
}

document.getElementById('savePng')?.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `gnomad-capture-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

document.getElementById('copyBtn')?.addEventListener('click', async () => {
    try {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setStatus('Copied to clipboard.');
    } catch (err) {
        setStatus('Clipboard failed — try Save PNG.', true);
    }
});

document.getElementById('savePdf')?.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const mode = document.getElementById('pdfMode').value;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    if (mode === 'single') {
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'l' : 'p',
            unit: 'px',
            format: [canvas.width, canvas.height],
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
        pdf.save('gnomad-full.pdf');
    } else {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidthMm = pageWidth;
        const imgHeightMm = (canvas.height * pageWidth) / canvas.width;

        let heightLeft = imgHeightMm;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidthMm, imgHeightMm);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position -= pageHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidthMm, imgHeightMm);
            heightLeft -= pageHeight;
        }
        pdf.save('gnomad-paginated.pdf');
    }
});

const api = globalThis.browser || globalThis.chrome;
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let isDrawing = false;
let startX, startY;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const data = (await api.storage.local.get(id))[id];

    if (!data || !data.chunks || data.chunks.length === 0) return;

    // Stitching Logic: Rely on FIRST chunk for real width
    const firstChunk = new Image();
    firstChunk.src = data.chunks[0].dataUri;
    await new Promise(r => firstChunk.onload = r);

    const realChunkWidth = firstChunk.width;
    const realChunkHeight = firstChunk.height;

    // Total Height Calculation
    let maxH = 0;
    for (const c of data.chunks) {
        if (c.y + realChunkHeight > maxH) maxH = c.y + realChunkHeight;
    }

    // Set Internal Resolution
    canvas.width = realChunkWidth;
    canvas.height = maxH > 0 ? maxH : (data.height * data.dpr);

    // Set Display Size (maintain aspect ratio)
    // We default to the 'CSS pixel' width reported by the page.
    const effectiveDPR = data.dpr || 1;
    const cssWidth = Math.round(realChunkWidth / effectiveDPR);
    const cssHeight = Math.round(canvas.height / effectiveDPR);

    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    // Draw Chunks
    for (const chunk of data.chunks) {
        const img = new Image();
        img.src = chunk.dataUri;
        await new Promise(r => img.onload = r);
        ctx.drawImage(img, 0, chunk.y);
    }

    // Init Redaction Tool
    canvas.addEventListener('mousedown', startRedacting);
    canvas.addEventListener('mousemove', drawRedacting);
    canvas.addEventListener('mouseup', stopRedacting);
});

// REDACTION LOGIC
let savedCanvasState = null;

function startRedacting(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    startX = (e.clientX - rect.left) * scale;
    startY = (e.clientY - rect.top) * scale;
    
    // Cache the clean state of the canvas
    savedCanvasState = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function drawRedacting(e) {
    if (!isDrawing || !savedCanvasState) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const currentX = (e.clientX - rect.left) * scale;
    const currentY = (e.clientY - rect.top) * scale;

    // Restore original clean state
    ctx.putImageData(savedCanvasState, 0, 0);

    // Draw high-end translucent preview with neon border
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.strokeStyle = "#818cf8"; // Modern indigo neon
    ctx.lineWidth = Math.max(1, 2 * scale);
    
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
}

function stopRedacting(e) {
    if (!isDrawing || !savedCanvasState) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const endX = (e.clientX - rect.left) * scale;
    const endY = (e.clientY - rect.top) * scale;

    // Restore original clean state to wipe the preview border
    ctx.putImageData(savedCanvasState, 0, 0);

    // Draw final solid black redacted region
    ctx.fillStyle = "black";
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    ctx.fillRect(x, y, w, h);
    
    isDrawing = false;
    savedCanvasState = null;
}

// EXPORT LOGIC
document.getElementById('savePng').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'capture.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
});

document.getElementById('copyBtn').addEventListener('click', () => {
    canvas.toBlob(blob => {
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([item]);
        alert("Copied to clipboard!");
    });
});

document.getElementById('savePdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const mode = document.getElementById('pdfMode').value;
    const imgData = canvas.toDataURL("image/jpeg", 0.9);

    if (mode === 'single') {
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'l' : 'p',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
        pdf.save('gnomad-full.pdf');
    } else {
        // A4 Paginated Logic
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidthPx = canvas.width;
        const imgHeightPx = canvas.height;

        const ratio = pageWidth / (imgWidthPx / (window.devicePixelRatio || 1) * 3.78); // px to mm approx
        const scaledImgHeight = (imgHeightPx * (pageWidth / imgWidthPx));

        let heightLeft = scaledImgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, scaledImgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - scaledImgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, scaledImgHeight);
            heightLeft -= pageHeight;
        }
        pdf.save('gnomad-paginated.pdf');
    }
});

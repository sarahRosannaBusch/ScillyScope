/**
 * @file    scopeRenderer.js
 * @brief   ScillyScope scope visualization
 * @authors Sarah Busch
 * @version 0
 * @date    20 Nov 2025
 */


import { targetAmp, currentFreq, lastFreq } from "./audio.js";

let visualAmp = 0;        // 0..1

// get canvas + context
const scopeCanvas = document.getElementById('scope-screen');
const scopeCtx = scopeCanvas.getContext('2d');

// resize canvas resolution to match CSS size
function resizeScope() {
    scopeCanvas.width = scopeCanvas.clientWidth;
    scopeCanvas.height = scopeCanvas.clientHeight;
}
window.addEventListener('resize', resizeScope);
resizeScope();

const AMP_TIME = 0.2;     // artifically slow visual amp change
let lastTime = performance.now();

export function drawScope() {
    requestAnimationFrame(drawScope);

    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    // amplitude easing
    const step = AMP_TIME > 0 ? delta / AMP_TIME : 1;
    if (visualAmp < targetAmp) {
        visualAmp = Math.min(visualAmp + step, targetAmp);
    } else if (visualAmp > targetAmp) {
        visualAmp = Math.max(visualAmp - step, targetAmp);
    }

    // clear completely so previous frame (incl. flat line) disappears
    scopeCtx.globalCompositeOperation = 'source-over';
    scopeCtx.clearRect(0, 0, scopeCanvas.width, scopeCanvas.height);

    // --- grid ---
    const divisionsX = 10;
    const divisionsY = 8;
    const paddingX = 16;
    const paddingY = 12;

    const gridLeft = paddingX;
    const gridRight = scopeCanvas.width - paddingX;
    const gridTop = paddingY;
    const gridBottom = scopeCanvas.height - paddingY;

    const gridWidth = gridRight - gridLeft;
    const gridHeight = gridBottom - gridTop;

    const spacingX = gridWidth / divisionsX;
    const spacingY = gridHeight / divisionsY;

    const totalMs = 20;
    const msPerDivision = totalMs / divisionsX;

    // grid lines
    scopeCtx.strokeStyle = '#333';
    scopeCtx.lineWidth = 1;

    // vertical lines + time labels
    for (let i = 0; i <= divisionsX; i++) {
        const x = gridLeft + i * spacingX;
        scopeCtx.beginPath();
        scopeCtx.moveTo(x, gridTop);
        scopeCtx.lineTo(x, gridBottom);
        scopeCtx.stroke();

        const timeLabel = (i * msPerDivision) + ' ms';
        scopeCtx.fillStyle = '#0f0';
        scopeCtx.font = '12px monospace';
        scopeCtx.textAlign = 'center';
        scopeCtx.textBaseline = 'bottom';
        scopeCtx.fillText(timeLabel, x, gridBottom - 2);
    }

    // horizontal lines
    for (let j = 0; j <= divisionsY; j++) {
        const y = gridTop + j * spacingY;
        scopeCtx.beginPath();
        scopeCtx.moveTo(gridLeft, y);
        scopeCtx.lineTo(gridRight, y);
        scopeCtx.stroke();
    }

    // center reference line as part of the grid (NOT green trace)
    // make it subtle so it doesn't read as a "flat signal"
    scopeCtx.save();
    scopeCtx.strokeStyle = '#2a2a2a'; // subdued grid color
    scopeCtx.lineWidth = 1;
    scopeCtx.setLineDash([4, 4]);     // optional: dashed center
    scopeCtx.beginPath();
    scopeCtx.moveTo(gridLeft, (gridTop + gridBottom) / 2);
    scopeCtx.lineTo(gridRight, (gridTop + gridBottom) / 2);
    scopeCtx.stroke();
    scopeCtx.restore();

    // --- amplitude scale (right side) ---
    // top = +1.0, center = 0.0, bottom = -1.0
    scopeCtx.fillStyle = '#0f0';
    scopeCtx.font = '12px monospace';
    scopeCtx.textAlign = 'right';
    scopeCtx.textBaseline = 'middle';
    scopeCtx.strokeStyle = '#0f0';
    scopeCtx.lineWidth = 1;

    // small header on the right
    scopeCtx.textAlign = 'center';
    scopeCtx.fillText('Amp', scopeCanvas.width - 18, gridTop);
    scopeCtx.textAlign = 'right';

    for (let j = 0; j <= divisionsY; j++) {
        const y = gridTop + j * spacingY;
        // map j -> amplitude: j=0 -> +1, j=divisionsY -> -1
        const ampVal = 1 - (j / divisionsY) * 2;
        const label = ampVal.toFixed(1);

        // tick mark at right edge of grid
        scopeCtx.beginPath();
        scopeCtx.moveTo(gridRight - 6, y);
        scopeCtx.lineTo(gridRight - 2, y);
        scopeCtx.stroke();

        // omit first and last label (j === 0 or j === divisionsY)
        if (j === 0 || j === divisionsY) continue;

        // label right of the grid (outside the grid)
        scopeCtx.fillText(label, scopeCanvas.width - 6, y);
    }

    // --- waveform drawing ---
    const freqToDraw = currentFreq != null ? currentFreq : lastFreq;

    // use grid center for idle trace as well
    const midY = (gridTop + gridBottom) / 2;

    if (!freqToDraw || visualAmp <= 0.001) {
        // idle flat trace ONLY when no signal
        scopeCtx.strokeStyle = '#0f0';
        scopeCtx.lineWidth = 2;
        scopeCtx.beginPath();
        scopeCtx.moveTo(gridLeft, midY);
        scopeCtx.lineTo(gridRight, midY);
        scopeCtx.stroke();
        return;
    }

    // sine wave
    scopeCtx.lineWidth = 2;
    scopeCtx.strokeStyle = '#0f0';
    scopeCtx.beginPath();

    // amplitude based on grid height so waveform sits inside the grid
    const amplitude = visualAmp * (gridHeight / 2 * 0.9);

    const totalSeconds = totalMs / 1000;
    const cycles = freqToDraw * totalSeconds;

    if (typeof drawScope.phase === 'undefined') {
        drawScope.phase = 0;
    }

    // map x across the grid area and center the waveform horizontally
    const gridCenterX = (gridLeft + gridRight) / 2;
    for (let x = Math.floor(gridLeft); x <= Math.ceil(gridRight); x++) {
        // normalized position relative to grid center: -0.5 .. +0.5
        const normalized = (x - gridCenterX) / gridWidth;
        // convert normalized position to radians across the number of cycles
        const t = normalized * cycles * 2 * Math.PI + drawScope.phase;
        const y = midY + Math.sin(t) * amplitude;
        if (x === Math.floor(gridLeft)) {
            scopeCtx.moveTo(x, y);
        } else {
            scopeCtx.lineTo(x, y);
        }
    }

    scopeCtx.stroke();
}
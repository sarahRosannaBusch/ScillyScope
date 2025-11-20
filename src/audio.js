/**
 * @file    audio.js
 * @brief   ScillyScope audio
 * @authors Sarah Busch
 * @version 0
 * @date    20 Nov 2025
 */

const AudioContext = window.AudioContext || window.webkitAudioContext;
export const audioCtx = new AudioContext();

// --- analyser setup ---
export const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;

// global volume variable (0..1)
export let volume = 0.5;
const volumeSlider = document.getElementById('volume-slider');
volumeSlider.addEventListener('input', () => {
    volume = volumeSlider.value / 100; // normalize 0..1
});

// visual amplitude + frequency state
export let targetAmp = 0;        // 0 or volume
export let currentFreq = null;   // active note freq (if any)
export let lastFreq = 0;         // remember last freq to draw during shrink

export function setVars(freq) {
	currentFreq = freq;
	lastFreq = freq;
	targetAmp = volume; 
}

export function clearVars() {
    currentFreq = null;
    targetAmp = 0;
}
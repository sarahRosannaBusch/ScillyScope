/**
 * @file    game.js
 * @brief   ScillyScope scripts
 * @authors Sarah Busch
 * @version 0.6
 * @date    29 Nov 2025
 */

import { createKeyboard } from "./keyboard.js";
import { drawScope } from "./scopeRenderer.js";
import { initBtns, record, playRecording, recordKeyPresses, playMelody, playHaiku } from "./playRecord.js";

const keyboard = createKeyboard();
drawScope();

// --- recording / playback UI elements ---
const playButton = document.getElementById('play-button');
const recordBtn = document.getElementById('record-button');
const playBottomBtn = document.getElementById('play-bottom-button');

initBtns(playButton, recordBtn, playBottomBtn);

// haiku puzzle:
const melodies = [
    'Sine', 'waves', 'oscillate',
    'surfing', 'seismic', 'tidal', 'swells',
    'light', 'echoes', 'sound', 'fades'
];

let selectedWordIndex = null;
let curMelody = melodies[selectedWordIndex];

playButton.addEventListener('click', () => playHaiku(melodies, startGame));
recordBtn.addEventListener('click', record);
keyboard.addEventListener('pointerdown', recordKeyPresses);
playBottomBtn.addEventListener('click', () => playRecording(curMelody, handleResult));

function startGame() {
    console.log('start game');
}

function handleResult(result) {
    updateTopRow(`Result: ${result}`);
}
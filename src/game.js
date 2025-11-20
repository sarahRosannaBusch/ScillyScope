/**
 * @file    game.js
 * @brief   ScillyScope scripts
 * @authors Sarah Busch
 * @version 0.5
 * @date    20 Nov 2025
 */

import { createKeyboard } from "./keyboard.js";
import { drawScope } from "./scopeRenderer.js";
import { initBtns, record, playRecording, recordKeyPresses, playMelody } from "./playRecord.js";

const keyboard = createKeyboard();
drawScope();

// --- recording / playback UI elements ---
const playButton = document.getElementById('play-button');
const recordBtn = document.getElementById('record-button');
const playBottomBtn = document.getElementById('play-bottom-button');

initBtns(playButton, recordBtn, playBottomBtn);

// multiple melodies defined by the letters printed on the keys
const melodies = ['WAVES', 'WATER', 'SOME\u2423OTHER'];
let currentMelodyIndex = 0;
let curMelody = melodies[currentMelodyIndex];

playButton.addEventListener('click', () => playMelody(curMelody));
recordBtn.addEventListener('click', record);
keyboard.addEventListener('pointerdown', recordKeyPresses);
playBottomBtn.addEventListener('click', () => playRecording(curMelody, handleResult));

function handleResult(result) {
    console.log(result);
}
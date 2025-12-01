/**
 * @file    game.js
 * @brief   ScillyScope scripts
 * @authors Sarah Busch
 * @version 1.0
 * @date    30 Nov 2025
 */

import { createKeyboard } from "./keyboard.js";
import { drawScope } from "./scopeRenderer.js";
import { initBtns, record, playRecording, recordKeyPresses, playMelody, playHaiku } from "./playRecord.js";

const keyboard = createKeyboard();
drawScope();

// --- recording / playback UI elements ---
const playButton = document.getElementById('play-button');
const haiku = document.getElementById('haiku');
const wordButtons = haiku.querySelectorAll('.word-cover');
const recordBtn = document.getElementById('record-button');
const recordedInput = document.getElementById('recorded-sequence');
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
let gameStarted = false;

playButton.addEventListener('click', () => {
    playButton.style.display = 'none';
    haiku.style.display = 'flex';
    playHaiku(melodies, startGame);
});
recordBtn.addEventListener('click', () => { 
    recordedInput.style.borderColor = '#0f0';
    recordedInput.style.color = '#0f0';
    record();
});
keyboard.addEventListener('pointerdown', recordKeyPresses);
playBottomBtn.addEventListener('click', () => playRecording(curMelody, handleResult));

function startGame() {
    if(!gameStarted) {
        gameStarted = true;
        haiku.classList.add('active');
        recordedInput.value = "Select a word to hear its frequencies";

        wordButtons.forEach(button => {
            button.disabled = false;
            button.addEventListener('click', () => {
                recordedInput.style.borderColor = '#0f0';
                recordedInput.style.color = '#0f0';

                const index = parseInt(button.dataset.wordIndex, 10);
                selectedWordIndex = index;
                curMelody = melodies[index];

                // Play the corresponding melody/word
                playMelody(curMelody);

                // Remove highlight from all buttons
                wordButtons.forEach(btn => btn.classList.remove('highlight'));

                // Add highlight to the last pressed button
                button.classList.add('highlight');
            });
        });
    } else {
        wordButtons.forEach(button => {
            button.classList.add('highlight');
        });
    }
}

function handleResult(result) {
    if (result === true && selectedWordIndex !== null) {
        const button = haiku.querySelector(
            `.word-cover[data-word-index="${selectedWordIndex}"]`
        );

        if (button) {
            button.textContent = melodies[selectedWordIndex];
            button.style.color = "white";
        }

        // Check if all words have been revealed
        const allRevealed = Array.from(
            haiku.querySelectorAll('.word-cover')
        ).every((btn, idx) => btn.textContent === melodies[idx]);

        if (allRevealed) {
            // Replay the haiku once everything is revealed            
            recordedInput.value = "Congrats! You have an amazing ear!"; 
            playHaiku(melodies, startGame);
        } else {            
            recordedInput.value = "Correct! Select another word to solve";
        }
    } else {
        if(gameStarted && selectedWordIndex !== null) {
            // Turn the input red
            recordedInput.style.borderColor = 'red';
            recordedInput.style.color = 'red';
        }
    }
}
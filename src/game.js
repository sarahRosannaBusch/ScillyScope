/**
 * @file    game.js
 * @brief   ScillyScope scripts
 * @authors Sarah Busch
 * @version 0.2
 * @date    7 Nov 2025
 */

const keyboard = document.getElementById('keyboard');
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const blackMap = {
	'C': 'C#',
	'D': 'D#',
	'F': 'F#',
	'G': 'G#',
	'A': 'A#'
};

function getFrequency(note, octave) {
	const A4 = 440;
	const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const index = noteOrder.indexOf(note);
	const keyNumber = index + (octave * 12);
	return A4 * Math.pow(2, (keyNumber - 57) / 12);
}

// --- sustain note handling ---
const activeNotes = {};

// visual amplitude + frequency state
let visualAmp = 0;        // 0..1
let targetAmp = 0;        // 0 or volume
let currentFreq = null;   // active note freq (if any)
let lastFreq = 0;         // remember last freq to draw during shrink

// global volume variable (0..1)
let volume = 0.5;
const volumeSlider = document.getElementById('volume-slider');
volumeSlider.addEventListener('input', () => {
    volume = volumeSlider.value / 100; // normalize 0..1
});

function startNote(note, freq) {
	const oscFund = audioCtx.createOscillator();
	const gain = audioCtx.createGain();

	oscFund.type = 'sine';
	oscFund.frequency.value = freq;

	// EQ: gentle bass lift
	const lowshelf = audioCtx.createBiquadFilter();
	lowshelf.type = 'lowshelf';
	lowshelf.frequency.value = 150;
	lowshelf.gain.value = 5; // subtle boost

	oscFund.connect(lowshelf);
	lowshelf.connect(gain);
	gain.connect(audioCtx.destination);
	gain.connect(analyser);

	const now = audioCtx.currentTime;
	const attack = 0.01;

	gain.gain.setValueAtTime(0, now);
	gain.gain.linearRampToValueAtTime(volume, now + attack);

	oscFund.start(now);

	activeNotes[note] = { oscFund, gain };

	currentFreq = freq;
	lastFreq = freq;
	targetAmp = volume; 
}

function stopNote(note) {
	const entry = activeNotes[note];
	if (!entry) return;

	const { oscFund, gain } = entry;
	const now = audioCtx.currentTime;
	const release = 0.5;

	// smooth release
	gain.gain.cancelScheduledValues(now);
	gain.gain.setValueAtTime(gain.gain.value, now);
	gain.gain.exponentialRampToValueAtTime(0.001, now + release);

	// stop both oscillators after release
	oscFund.stop(now + release);

	delete activeNotes[note];

	// visual: shrink using lastFreq, only flatline at zero
	if (Object.keys(activeNotes).length === 0) {
		currentFreq = null;
		targetAmp = 0;
	}
}

// --- define range ---
const startOctave = 2;
const endOctave = 4;
const startNoteName = 'A';
const endNoteName = 'B';

for (let octave = startOctave; octave <= endOctave; octave++) {
	for (let i = 0; i < whiteNotes.length; i++) {
		const note = whiteNotes[i];

		// Skip notes before A2
		if (octave === startOctave && whiteNotes.indexOf(note) < whiteNotes.indexOf(startNoteName)) {
			continue;
		}
		// Skip notes after B4
		if (octave === endOctave && whiteNotes.indexOf(note) > whiteNotes.indexOf(endNoteName)) {
			continue;
		}

		const wrapper = document.createElement('div');
		wrapper.classList.add('key-wrapper');

		const whiteKey = document.createElement('div');
		whiteKey.classList.add('key');
		const fullNote = note + octave;
		whiteKey.dataset.note = fullNote;
		whiteKey.textContent = fullNote;

		// press/release events
		whiteKey.addEventListener('mousedown', () => startNote(fullNote, getFrequency(note, octave)));
		whiteKey.addEventListener('mouseup', () => stopNote(fullNote));
		whiteKey.addEventListener('mouseleave', () => stopNote(fullNote));
		whiteKey.addEventListener('touchstart', (e) => {
			e.preventDefault();
			startNote(fullNote, getFrequency(note, octave));
		});
		whiteKey.addEventListener('touchend', () => stopNote(fullNote));

		wrapper.appendChild(whiteKey);

		// Add black keys if they exist in this octave
		if (blackMap[note]) {
			const blackNote = blackMap[note];
			const blackKey = document.createElement('div');
			blackKey.classList.add('key', 'black');
			const fullBlackNote = blackNote + octave;
			blackKey.dataset.note = fullBlackNote;
			blackKey.textContent = fullBlackNote;

			blackKey.addEventListener('mousedown', () => startNote(fullBlackNote, getFrequency(blackNote, octave)));
			blackKey.addEventListener('mouseup', () => stopNote(fullBlackNote));
			blackKey.addEventListener('mouseleave', () => stopNote(fullBlackNote));
			blackKey.addEventListener('touchstart', (e) => {
				e.preventDefault();
				startNote(fullBlackNote, getFrequency(blackNote, octave));
			});
			blackKey.addEventListener('touchend', () => stopNote(fullBlackNote));

			wrapper.appendChild(blackKey);
		}

		keyboard.appendChild(wrapper);
	}
}

// --- analyser setup ---
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
const bufferLength = analyser.fftSize;
const dataArray = new Uint8Array(bufferLength);

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

function drawScope() {
	requestAnimationFrame(drawScope);

	const now = performance.now();
	const delta = (now - lastTime) / 1000;
	lastTime = now;

	// time-based easing
	const step = AMP_TIME > 0 ? delta / AMP_TIME : 1;

	if (visualAmp < targetAmp) {
		visualAmp = Math.min(visualAmp + step, targetAmp);
	} else if (visualAmp > targetAmp) {
		visualAmp = Math.max(visualAmp - step, targetAmp);
	}

	scopeCtx.fillStyle = '#111';
	scopeCtx.fillRect(0, 0, scopeCanvas.width, scopeCanvas.height);

	// draw flatline only when visually at (near) zero
	if (visualAmp <= 0.001) {
		scopeCtx.strokeStyle = '#0f0';
		scopeCtx.lineWidth = 2;
		scopeCtx.beginPath();
		scopeCtx.moveTo(0, scopeCanvas.height / 2);
		scopeCtx.lineTo(scopeCanvas.width, scopeCanvas.height / 2);
		scopeCtx.stroke();
		return;
	}

	// choose frequency to display:
	// - if a note is active, use currentFreq
	// - otherwise, use lastFreq while shrinking
	const freqToDraw = currentFreq != null ? currentFreq : lastFreq;

	scopeCtx.lineWidth = 2;
	scopeCtx.strokeStyle = '#0f0';
	scopeCtx.beginPath();

	const midY = scopeCanvas.height / 2;
	const amplitude = visualAmp * (scopeCanvas.height / 2 * 0.9);

	const sampleRate = audioCtx.sampleRate;
	const visibleSeconds = bufferLength / sampleRate;
	const cycles = freqToDraw * visibleSeconds * 0.5;

	for (let x = 0; x < scopeCanvas.width; x++) {
		const t = (x / scopeCanvas.width) * cycles * 2 * Math.PI;
		const y = midY + Math.sin(t) * amplitude;
		if (x === 0) {
			scopeCtx.moveTo(x, y);
		} else {
			scopeCtx.lineTo(x, y);
		}
	}

	scopeCtx.stroke();
}
drawScope();
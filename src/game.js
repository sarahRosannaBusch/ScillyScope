/**
 * @file    game.js
 * @brief   ScillyScope scripts
 * @authors Sarah Busch
 * @version 0.4
 * @date    13 Nov 2025
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

// --- recording / playback UI elements ---
const recordBtn = document.getElementById('record-button');
const playBottomBtn = document.getElementById('play-bottom-button');
const recordedInput = document.getElementById('recorded-sequence');

// recording state
let isRecording = false;
let recordedNotes = [];

// top-level flags
let isPlaying = false;
let isPlayingRecorded = false;

// initialize play-bottom button state
if (playBottomBtn) {
	playBottomBtn.disabled = true;
	playBottomBtn.setAttribute('aria-pressed', 'false');
}

// helper: find a data-note (e.g. "C4") from a visible key label
function resolveNoteFromLabel(label, preferredOctave) {
	if (!keyboard || !label) return null;
	const wanted = String(label).trim().toUpperCase();
	const keys = Array.from(keyboard.querySelectorAll('.key'));
	const matches = keys.filter(k => ((k.textContent || k.innerText) || '').trim().toUpperCase() === wanted);
	if (matches.length === 0) return null;
	if (preferredOctave != null) {
		const byOctave = matches.find(k => {
			const dn = k.dataset.note || k.getAttribute('data-note') || '';
			return dn.endsWith(String(preferredOctave));
		});
		if (byOctave) return byOctave.dataset.note || byOctave.getAttribute('data-note');
	}
	// fallback to first match
	const el = matches[0];
	return el.dataset.note || el.getAttribute('data-note') || null;
}

// multiple melodies defined by the letters printed on the keys
const melodies = ['WAVES', 'WATER', 'SOME\u2423OTHER'];

// index of the currently selected melody (change with selectMelody)
let currentMelodyIndex = 0;

function selectMelody(index) {
	if (typeof index !== 'number') return;
	currentMelodyIndex = ((index % melodies.length) + melodies.length) % melodies.length;
}

// debug toggle (optional)
const DEBUG_HIGHLIGHT_KEYS = false;

function playMelody(melodyRef) {
	// resume audio on user gesture
	if (audioCtx.state === 'suspended') audioCtx.resume();

	// determine melody string: allow calling with index, name, or use currentMelodyIndex
	let melodyStr;
	if (typeof melodyRef === 'string') {
		melodyStr = melodyRef;
	} else if (typeof melodyRef === 'number') {
		melodyStr = melodies[melodyRef] || '';
	} else {
		melodyStr = melodies[currentMelodyIndex] || '';
	}

	// guard
	if (isPlaying) return;
	if (!melodyStr || melodyStr.length === 0) return;
	isPlaying = true;

	// UI: mark playing
	if (playButton) {
		playButton.classList.add('playing');
		playButton.setAttribute('aria-pressed', 'true');
	}

	// disable record and bottom-play while the melody runs
	if (recordBtn) recordBtn.disabled = true;
	if (playBottomBtn) playBottomBtn.disabled = true;

	const DEFAULT_NOTE_DURATION = 0.5; // seconds for every note except last
	const LAST_NOTE_DURATION = 1.0;    // seconds for the final note
	const NOTE_RELEASE = 0.5;          // keep in sync with stopNote's release

	let timeOffset = 0;
	const chars = Array.from(String(melodyStr));

	chars.forEach((ch, idx) => {
		// treat each character as a visible key label; ignore whitespace
		const labelRaw = String(ch);
		const label = labelRaw.trim().toUpperCase();
		const duration = (idx === chars.length - 1) ? LAST_NOTE_DURATION : DEFAULT_NOTE_DURATION;

		if (!label) {
			// skip unresolved label but advance time
			timeOffset += duration;
			return;
		}

		const dataNote = resolveNoteFromLabel(label);
		if (!dataNote) {
			// skip unresolved label but advance time
			timeOffset += duration;
			return;
		}

		// schedule start
		setTimeout(() => {
			const m = String(dataNote).match(/^([A-G]#?)(\d+)$/);
			if (!m) return;
			const freq = getFrequency(m[1], parseInt(m[2], 10));
			startNote(dataNote, freq);

			const keyEl = keyboard && keyboard.querySelector(`.key[data-note="${dataNote}"]`);
			if (keyEl) {
				keyEl.classList.add('active');
				if (DEBUG_HIGHLIGHT_KEYS) keyEl.classList.add('debug-playing');
			}
		}, timeOffset * 1000);

		// schedule stop
		setTimeout(() => {
			stopNote(dataNote);
			const keyEl = keyboard && keyboard.querySelector(`.key[data-note="${dataNote}"]`);
			if (keyEl) {
				keyEl.classList.remove('active');
				if (DEBUG_HIGHLIGHT_KEYS) keyEl.classList.remove('debug-playing');
			}
		}, (timeOffset + duration) * 1000);

		timeOffset += duration;
	});

	// total playback length (notes + release)
	const totalMs = (timeOffset + NOTE_RELEASE) * 1000;

	// revert UI after playback finishes
	setTimeout(() => {
		if (playButton) {
			playButton.classList.remove('playing');
			playButton.setAttribute('aria-pressed', 'false');
		}

		// restore record and bottom-play appropriately
		if (recordBtn) recordBtn.disabled = !!isRecording || !!isPlayingRecorded;
		if (playBottomBtn) playBottomBtn.disabled = recordedNotes.length === 0 || !!isRecording || !!isPlayingRecorded;

		// clear any lingering highlights
		if (keyboard) {
			keyboard.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
			if (DEBUG_HIGHLIGHT_KEYS) keyboard.querySelectorAll('.key.debug-playing').forEach(k => k.classList.remove('debug-playing'));
		}

		isPlaying = false;
	}, totalMs);
}

// hook up top play button
const playButton = document.getElementById('play-button');
if (playButton) playButton.addEventListener('click', playMelody);

function startNote(note, freq) {
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();

	osc.type = 'sine';
	osc.frequency.value = freq;

	// EQ: gentle bass lift
	const lowshelf = audioCtx.createBiquadFilter();
	lowshelf.type = 'lowshelf';
	lowshelf.frequency.value = 150;
	lowshelf.gain.value = 5; // subtle boost

	osc.connect(lowshelf);
	lowshelf.connect(gain);
	gain.connect(audioCtx.destination);
	gain.connect(analyser);

	const now = audioCtx.currentTime;
	const attack = 0.01;

	gain.gain.setValueAtTime(0, now);
	gain.gain.linearRampToValueAtTime(volume, now + attack);

	osc.start(now);

	activeNotes[note] = { osc, gain };

	currentFreq = freq;
	lastFreq = freq;
	targetAmp = volume; 
}

function stopNote(note) {
	const entry = activeNotes[note];
	if (!entry) return;

	const { osc, gain } = entry;
	const now = audioCtx.currentTime;
	const release = 0.5;

	// smooth release
	gain.gain.cancelScheduledValues(now);
	gain.gain.setValueAtTime(gain.gain.value, now);
	gain.gain.exponentialRampToValueAtTime(0.001, now + release);

	// stop both oscillators after release
	osc.stop(now + release);

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

// label pool: A..Z once, then one visible space symbol U+2423 (␣)
const labelPool = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '\u2423'];
let labelIndex = 0;

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

		// visible label from pool (A..Z once, plus U+2423 for the extra key)
		const label = labelPool[labelIndex] || '\u2423';
		whiteKey.textContent = label;
		whiteKey.setAttribute('aria-label', label);

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
		labelIndex++; // consume one label

		// Add black keys if they exist in this octave
		if (blackMap[note]) {
			const blackNote = blackMap[note];
			const blackKey = document.createElement('div');
			blackKey.classList.add('key', 'black');
			const fullBlackNote = blackNote + octave;
			blackKey.dataset.note = fullBlackNote;

			// visible label for black key from pool
			const blackLabel = labelPool[labelIndex] || '\u2423';
			blackKey.textContent = blackLabel;
			blackKey.setAttribute('aria-label', blackLabel);

			blackKey.addEventListener('mousedown', () => startNote(fullBlackNote, getFrequency(blackNote, octave)));
			blackKey.addEventListener('mouseup', () => stopNote(fullBlackNote));
			blackKey.addEventListener('mouseleave', () => stopNote(fullBlackNote));
			blackKey.addEventListener('touchstart', (e) => {
				e.preventDefault();
				startNote(fullBlackNote, getFrequency(blackNote, octave));
			});
			blackKey.addEventListener('touchend', () => stopNote(fullBlackNote));

			wrapper.appendChild(blackKey);
			labelIndex++; // consume one label
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
drawScope();

// -----------------
// Recording handlers
// -----------------

// record button handler: disable top play while recording
if (recordBtn) {
	recordBtn.addEventListener('click', () => {
		// ensure audio context is resumed on user gesture
		if (audioCtx.state === 'suspended') audioCtx.resume();

		isRecording = !isRecording;

		if (isRecording) {
			recordedNotes = [];
			if (recordedInput) recordedInput.value = '';
			recordBtn.classList.add('recording');
			recordBtn.setAttribute('aria-pressed', 'true');
			recordBtn.textContent = '⏹ Recording';
			if (playBottomBtn) {
				playBottomBtn.disabled = true;
				playBottomBtn.setAttribute('aria-pressed', 'false');
			}
			// disable the top play button while recording
			if (playButton) playButton.disabled = true;
		} else {
			recordBtn.classList.remove('recording');
			recordBtn.setAttribute('aria-pressed', 'false');
			recordBtn.textContent = '⏺ Record';
			if (playBottomBtn) {
				playBottomBtn.disabled = recordedNotes.length === 0;
			}
			// re-enable the top play button only if not playing recorded
			if (playButton) playButton.disabled = !!isPlayingRecorded;
		}
	});
}

if (playBottomBtn) {
	playBottomBtn.addEventListener('click', () => {
		if (recordedNotes.length === 0) return;
		// prevent double-trigger
		if (isPlayingRecorded) return;

		// ensure audio context is resumed on user gesture
		if (audioCtx.state === 'suspended') audioCtx.resume();

		isPlayingRecorded = true;
		playBottomBtn.classList.add('playing');
		playBottomBtn.setAttribute('aria-pressed', 'true');
		playBottomBtn.disabled = true;

		// disable the top play and record buttons while recorded playback runs
		if (playButton) playButton.disabled = true;
		if (recordBtn) recordBtn.disabled = true;

		const DEFAULT_NOTE_DURATION = 0.5; // seconds for every note except last
		const LAST_NOTE_DURATION = 1.0;    // seconds for the final note
		const NOTE_RELEASE = 0.5;          // seconds — keep in sync with stopNote's release

		// ensure we have a label->note map
		const map = (typeof labelToNote !== 'undefined' && labelToNote) ? labelToNote : (() => {
			const m = Object.create(null);
			if (keyboard) {
				Array.from(keyboard.querySelectorAll('.key')).forEach(k => {
					const label = ((k.textContent || k.innerText) || '').trim().toUpperCase();
					const dn = k.dataset.note || k.getAttribute('data-note');
					if (label && dn) m[label] = dn;
				});
			}
			return m;
		})();

		let timeOffset = 0;

		recordedNotes.forEach((entry, idx) => {
			const note = entry && entry.note ? entry.note : (entry || null);
			const duration = (idx === recordedNotes.length - 1) ? LAST_NOTE_DURATION : DEFAULT_NOTE_DURATION;

			if (!note) {
				timeOffset += duration;
				return;
			}

			// schedule start
			setTimeout(() => {
				const m = String(note).match(/^([A-G]#?)(\d+)$/);
				if (!m) return;
				const noteName = m[1];
				const octave = parseInt(m[2], 10);
				const freq = getFrequency(noteName, octave);

				startNote(note, freq);

				const keyEl = keyboard && keyboard.querySelector(`.key[data-note="${note}"]`);
				if (keyEl) {
					keyEl.classList.add('active');
					if (typeof DEBUG_HIGHLIGHT_KEYS !== 'undefined' && DEBUG_HIGHLIGHT_KEYS) keyEl.classList.add('debug-playing');
				}
			}, timeOffset * 1000);

			// schedule stop
			setTimeout(() => {
				stopNote(note);
				const keyEl = keyboard && keyboard.querySelector(`.key[data-note="${note}"]`);
				if (keyEl) {
					keyEl.classList.remove('active');
					if (typeof DEBUG_HIGHLIGHT_KEYS !== 'undefined' && DEBUG_HIGHLIGHT_KEYS) keyEl.classList.remove('debug-playing');
				}
			}, (timeOffset + duration) * 1000);

			timeOffset += duration;
		});

		// compute end time and revert UI (include release)
		const totalMs = (timeOffset + NOTE_RELEASE) * 1000;
		setTimeout(() => {
			playBottomBtn.classList.remove('playing');
			playBottomBtn.setAttribute('aria-pressed', 'false');
			playBottomBtn.disabled = recordedNotes.length === 0;

			// re-enable top play only if we're not currently recording or playing the melody
			if (playButton) playButton.disabled = !!isRecording || !!isPlaying;

			// re-enable record only if the melody isn't playing
			if (recordBtn) recordBtn.disabled = !!isPlaying;

			// clear any lingering highlights
			if (keyboard) {
				keyboard.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
				if (typeof DEBUG_HIGHLIGHT_KEYS !== 'undefined' && DEBUG_HIGHLIGHT_KEYS) {
					keyboard.querySelectorAll('.key.debug-playing').forEach(k => k.classList.remove('debug-playing'));
				}
			}

            // compare recorded result to the currently selected melody in `melodies`
            const melodyStr = Array.isArray(melodies)
                ? (melodies[currentMelodyIndex] || '')
                : String(melodies || '');

            const expected = Array.from(String(melodyStr)).map(ch => {
                const label = String(ch).trim().toUpperCase();
                return label ? (map[String(label)] || null) : null;
            }).filter(Boolean);

            const actual = recordedNotes.map(e => (e && e.note) ? e.note : String(e || ''));

            const sameLength = expected.length === actual.length;
            const allMatch = sameLength && expected.every((n, i) => n === actual[i]);

            if (allMatch) {
                console.log('success!');
            } else {
                console.log('fail!');
            }

			isPlayingRecorded = false;
		}, totalMs + 100);
	});
}

// helper: return the visible label printed on the key for a given note string or recorded entry
function parseNote(noteOrEntry) {
	if (!noteOrEntry) return null;

	// if passed an object like { note: "C4", label: "A" }
	if (typeof noteOrEntry === 'object') {
		if (noteOrEntry.label) return noteOrEntry.label;
		if (typeof noteOrEntry.note === 'string') noteOrEntry = noteOrEntry.note;
		else return null;
	}

	const noteStr = String(noteOrEntry).trim();

	// try to find the key element by data-note and return its visible label
	const keyEl = keyboard.querySelector(`.key[data-note="${noteStr}"]`);
	if (keyEl) {
		return keyEl.textContent || keyEl.innerText || '\u2423';
	}

	// if the input itself is already a single visible label (A..Z or U+2423), return it
	if (noteStr.length === 1) return noteStr;

	return null;
}

// capture key presses for recording (pointer events cover mouse/touch)
// ensure we store both the real note and the visible label
keyboard.addEventListener('pointerdown', (ev) => {
	const keyEl = ev.target.closest('.key');
	if (!keyEl) return;

	const note = keyEl.dataset.note || keyEl.getAttribute('data-note') || null;
	const label = keyEl.textContent || '\u2423';

	// dispatch a global event so other code can react if needed
	if (note) {
		document.dispatchEvent(new CustomEvent('pianoKeyPressed', { detail: { note } }));
	}

	// If recording, append the visible label to the readonly input (store both)
	if (isRecording) {
		recordedNotes.push({ note, label });
		if (recordedInput) recordedInput.value = recordedNotes.map(e => e.label).join(' ');
	}
});

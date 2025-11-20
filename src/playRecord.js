/**
 * @file    playRecord.js
 * @brief   ScillyScope play and record button event handlers
 * @authors Sarah Busch
 * @version 0
 * @date    20 Nov 2025
 */

import { startNote, stopNote, getFrequency, resolveNoteFromLabel } from "./keyboard.js";
import { audioCtx } from "./audio.js";

// debug toggle
const DEBUG_HIGHLIGHT_KEYS = false;

const recordedInput = document.getElementById('recorded-sequence');

// recording state
let isRecording = false;
let recordedNotes = [];

// top-level flags
let isPlaying = false;
let isPlayingRecorded = false;

let playButton, recordBtn, playBottomBtn;

export function initBtns(pb, rb, pbb) {
    playButton = pb;
    recordBtn = rb;
    playBottomBtn = pbb;
}

// record button handler: disable play buttons while recording
export function record() {
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
}

export function playRecording(melodyStr, callback) {
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

        const expected = Array.from(String(melodyStr)).map(ch => {
            const label = String(ch).trim().toUpperCase();
            return label ? (map[String(label)] || null) : null;
        }).filter(Boolean);

        const actual = recordedNotes.map(e => (e && e.note) ? e.note : String(e || ''));

        const sameLength = expected.length === actual.length;
        const allMatch = sameLength && expected.every((n, i) => n === actual[i]);

        isPlayingRecorded = false;
        
        if (allMatch) {
            callback('success!');
        } else {
            callback('fail!');
        }

    }, totalMs + 100);
}

// capture key presses for recording (pointer events cover mouse/touch)
// ensure we store both the real note and the visible label
export function recordKeyPresses(ev) {
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
}

export function playMelody(melodyStr) {
	// resume audio on user gesture
	if (audioCtx.state === 'suspended') audioCtx.resume();

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
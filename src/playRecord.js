/**
 * @file    playRecord.js
 * @brief   ScillyScope play and record button event handlers
 * @authors Sarah Busch
 * @version 1.1
 * @date    29 Dec 2025
 */

import { startNote, stopNote, getFrequency, resolveNoteFromLabel } from "./keyboard.js";
import { audioCtx } from "./audio.js";

// debug toggle
const DEBUG_HIGHLIGHT_KEYS = false;

const recordedInput = document.getElementById('recorded-sequence');

// recording state
export let isRecording = false;
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

// capture key presses for recording (pointer events cover mouse/touch)
// ensure we store both the real note and the visible label
export function recordKeyPresses(ev) {
	const keyEl = ev.target.closest('.key');
	if (!keyEl) return;

	const note = keyEl.dataset.note || keyEl.getAttribute('data-note') || null;
	const label = keyEl.textContent;

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

function schedulePlayback(notes, {
    onStart = () => {},
    onFinish = () => {},
    defaultDuration = 0.5,
    lastDuration = 1.0,
    release = 0.1
}) {
    disableInput();
    let timeOffset = 0;
    notes.forEach((note, idx) => {
        const duration = (idx === notes.length - 1) ? lastDuration : defaultDuration;
        if (!note) {
            timeOffset += duration;
            return;
        }

        // schedule start
        setTimeout(() => {
            const m = String(note).match(/^([A-G]#?)(\d+)$/);
            if (!m) return;
            const freq = getFrequency(m[1], parseInt(m[2], 10));
            startNote(note, freq);

            const keyEl = keyboard?.querySelector(`.key[data-note="${note}"]`);
            if (keyEl) {
                keyEl.classList.add('active');
                if (DEBUG_HIGHLIGHT_KEYS) keyEl.classList.add('debug-playing');
            }
            onStart(note);
        }, timeOffset * 1000);

        // schedule stop
        setTimeout(() => {
            stopNote(note);
            const keyEl = keyboard?.querySelector(`.key[data-note="${note}"]`);
            if (keyEl) {
                keyEl.classList.remove('active');
                if (DEBUG_HIGHLIGHT_KEYS) keyEl.classList.remove('debug-playing');
            }
        }, (timeOffset + duration) * 1000);

        timeOffset += duration;
    });

    // cleanup after playback
    const totalMs = (timeOffset + release) * 1000;
    setTimeout(() => {
        onFinish();
        enableInput();
    }, totalMs);
}

export function playHaiku(wordsArr, callback) {
	if (audioCtx.state === 'suspended') audioCtx.resume();
	if (isPlaying || !Array.isArray(wordsArr) || wordsArr.length === 0) return;
	isPlaying = true;

	playButton?.classList.add('playing');
	playButton?.setAttribute('aria-pressed', 'true');
	recordBtn && (recordBtn.disabled = true);
	playBottomBtn && (playBottomBtn.disabled = true);

	// Build notes and track indices where each word starts
	const notes = [];
	const wordStarts = []; // index in `notes` of the first note for each word

	wordsArr.forEach((word, idx) => {
		const letters = Array.from(word)
			.map(ch => resolveNoteFromLabel(ch.trim().toUpperCase()))
			.filter(Boolean);

		wordStarts.push(notes.length);
		notes.push(...letters);

		// insert a null pause between words
		if (idx < wordsArr.length - 1) {
			notes.push(null);
		}
	});

	// Durations per note as schedulePlayback will use them
	// (last element uses lastDuration, all others use defaultDuration)
	const defaultDuration = 0.25;
	const lastDuration = 0.5;
	const release = 0.1;

	const durations = notes.map((_, i) =>
		i === notes.length - 1 ? lastDuration : defaultDuration
	);

	// Precompute start times (in seconds) for each word
	const wordStartTimes = wordStarts.map(startIdx => {
		let t = 0;
		for (let i = 0; i < startIdx; i++) t += durations[i];
		return t;
	});

	// Helper to highlight all covers for a given word index
	function highlightWord(wordIndex) {
		document.querySelectorAll('.word-cover').forEach(btn => btn.classList.remove('highlight'));
		document.querySelectorAll(`.word-cover[data-word-index="${wordIndex}"]`)
			.forEach(btn => btn.classList.add('highlight'));
	}

	// Schedule highlights for each word start
	wordStartTimes.forEach((t, wordIdx) => {
		setTimeout(() => {
			highlightWord(wordIdx);
		}, t * 1000);
	});

	// Kick off audio playback
	schedulePlayback(notes, {
		defaultDuration,
		lastDuration,
		release,
		onFinish: () => {
			playButton?.classList.remove('playing');
			playButton?.setAttribute('aria-pressed', 'false');
			if (recordBtn) recordBtn.disabled = !!isRecording || !!isPlayingRecorded;
			if (playBottomBtn) playBottomBtn.disabled = recordedNotes.length === 0 || !!isRecording || !!isPlayingRecorded;
			keyboard?.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
			if (DEBUG_HIGHLIGHT_KEYS) keyboard?.querySelectorAll('.key.debug-playing').forEach(k => k.classList.remove('debug-playing'));
			isPlaying = false;

			// Clear highlight when playback ends
			document.querySelectorAll('.word-cover').forEach(btn => btn.classList.remove('highlight'));

			callback();
		}
	});
}

let lastMelody;
export function playMelody(melodyStr) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (isPlaying || !melodyStr) return;
    if(melodyStr !== lastMelody) {
        recordedInput.value = "Record what you hear, then play it to check your results"; 
        lastMelody = melodyStr;
    }
    isPlaying = true;

    playButton?.classList.add('playing');
    playButton?.setAttribute('aria-pressed', 'true');
    recordBtn && (recordBtn.disabled = true);
    playBottomBtn && (playBottomBtn.disabled = true);

    const notes = Array.from(melodyStr)
        .map(ch => resolveNoteFromLabel(ch.trim().toUpperCase()))
        .filter(Boolean);

    schedulePlayback(notes, {
        onFinish: () => {
            playButton?.classList.remove('playing');
            playButton?.setAttribute('aria-pressed', 'false');
            if (recordBtn) recordBtn.disabled = !!isRecording || !!isPlayingRecorded;
            if (playBottomBtn) playBottomBtn.disabled = recordedNotes.length === 0 || !!isRecording || !!isPlayingRecorded;
            keyboard?.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
            if (DEBUG_HIGHLIGHT_KEYS) keyboard?.querySelectorAll('.key.debug-playing').forEach(k => k.classList.remove('debug-playing'));
            isPlaying = false;
        }
    });
}

export function playRecording(melodyStr, callback) {
    if (!recordedNotes.length || isPlayingRecorded) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isPlayingRecorded = true;

    playBottomBtn.classList.add('playing');
    playBottomBtn.setAttribute('aria-pressed', 'true');
    playBottomBtn.disabled = true;
    playButton && (playButton.disabled = true);
    recordBtn && (recordBtn.disabled = true);

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

    const notes = recordedNotes.map(e => e?.note || e);

    schedulePlayback(notes, {
        onFinish: () => {
            playBottomBtn.classList.remove('playing');
            playBottomBtn.setAttribute('aria-pressed', 'false');
            playBottomBtn.disabled = recordedNotes.length === 0;
            if (playButton) playButton.disabled = !!isRecording || !!isPlaying;
            if (recordBtn) recordBtn.disabled = !!isPlaying;
            keyboard?.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
            if (DEBUG_HIGHLIGHT_KEYS) keyboard?.querySelectorAll('.key.debug-playing').forEach(k => k.classList.remove('debug-playing'));

            const expected = Array.from(String(melodyStr)).map(ch => {
                const label = String(ch).trim().toUpperCase();
                return label ? (map[String(label)] || null) : null;
            }).filter(Boolean);

            const actual = notes.map(e => (e && e.note) ? e.note : String(e || ''));

            const allMatch = expected.length === actual.length && expected.every((n, i) => n === actual[i]);
            isPlayingRecorded = false;
            callback(allMatch ? true : false);
        }
    });
}

function disableInput() {
	document.getElementById('input-blocker').style.pointerEvents = 'auto';
}

function enableInput() {
	document.getElementById('input-blocker').style.pointerEvents = 'none';
}
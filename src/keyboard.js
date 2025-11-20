/**
 * @file    keyboard.js
 * @brief   ScillyScope piano keys
 * @authors Sarah Busch
 * @version 0
 * @date    20 Nov 2025
 */

import { audioCtx, volume, analyser, setVars, clearVars } from "./audio.js";

// --- sustain note handling ---
const activeNotes = {};

// param: keyboard elem
export function createKeyboard() {
    const keyboard = document.getElementById('keyboard');

    const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const blackMap = {
        'C': 'C#',
        'D': 'D#',
        'F': 'F#',
        'G': 'G#',
        'A': 'A#'
    };

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

    return keyboard;
}

export function startNote(note, freq) {
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

    setVars(freq);
}

export function stopNote(note) {
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
        clearVars();
	}
}

export function getFrequency(note, octave) {
	const A4 = 440;
	const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const index = noteOrder.indexOf(note);
	const keyNumber = index + (octave * 12);
	return A4 * Math.pow(2, (keyNumber - 57) / 12);
}

// helper: find a data-note (e.g. "C4") from a visible key label
export function resolveNoteFromLabel(label, preferredOctave) {
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
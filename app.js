const STORAGE_KEY_LEGACY = 'hangTimerRoutine';
const STORAGE_KEY_PROTOCOLS = 'hangTimerProtocols';
const STORAGE_KEY_ACTIVE = 'hangTimerActiveProtocolId';
const DEFAULT_PROTOCOL_ID = 'default';

let protocols = [];
let activeProtocolId = DEFAULT_PROTOCOL_ID;
let routine = [];
let currentIndex = -1;
let currentPhase = null;
let remainingMs = 0;
let totalPhaseMs = 0;
let intervalId = null;
let isPlaying = false;
let selectedIndices = new Set();
let audioCtx = null;
let wakeLock = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const timerView = $('#timer-view');
const editView = $('#edit-view');
const timerList = $('#timer-list');
const editList = $('#edit-list');
const countdownEl = $('#countdown');
const phaseLabelEl = $('#phase-label');
const barFill = $('#progress-bar-fill');
const timeLeftEl = $('#time-left');
const timeDoneEl = $('#time-done');
const playIcon = $('#play-icon');
const selectAllCb = $('#select-all');
const selectedCountEl = $('#selected-count');
const groupBar = $('#group-bar');
const groupInfoEl = $('#group-info');
const groupModal = $('#group-modal');

// ── Audio ──

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playBeep(duration = 0.25, frequency = 1000) {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = frequency;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (_) { /* audio not available */ }
}

function vibrate(ms = 80) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

// ── Wake Lock ──

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (_) { /* not available or denied */ }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
    }
}

// ── Protocols & Persistence ──

const DEFAULT_PROTOCOL = {
    id: DEFAULT_PROTOCOL_ID,
    title: 'Dave MacLeod Hangboard',
    description:
        '<p>Based on Dave MacLeod\u2019s ' +
        '<a href="https://youtu.be/PebF3NyEGPc?si=bg1f0wf3lGNIgEm6" target="_blank" rel="noopener">hangboard routine</a>. ' +
        '8 warm-up sets followed by 9 \u201cmax hang\u201d sets.</p>' +
        '<div class="grip-images">' +
            '<figure class="grip-card"><img src="grips/crimp.jpg" alt="Half Crimp" loading="lazy"><figcaption>Half Crimp</figcaption></figure>' +
            '<figure class="grip-card"><img src="grips/chisel.jpg" alt="Chisel" loading="lazy"><figcaption>Chisel</figcaption></figure>' +
            '<figure class="grip-card"><img src="grips/drag.jpg" alt="Drag" loading="lazy"><figcaption>Drag</figcaption></figure>' +
        '</div>',
    steps: [
        { label: 'jugs', rest: 5, hang: 10 },
        { label: 'jugs', rest: 50, hang: 10 },
        { label: 'pullups', rest: 50, hang: 10 },
        { label: 'pullups', rest: 50, hang: 10 },
        { label: 'crimp', rest: 50, hang: 10 },
        { label: 'crimp', rest: 50, hang: 10 },
        { label: 'drag', rest: 50, hang: 10 },
        { label: 'crimp', rest: 50, hang: 10 },
        { label: 'crimp-1', rest: 110, hang: 10 },
        { label: 'crimp-2', rest: 110, hang: 10 },
        { label: 'crimp-3', rest: 110, hang: 10 },
        { label: 'chisel-1', rest: 110, hang: 10 },
        { label: 'chisel-2', rest: 110, hang: 10 },
        { label: 'chisel-3', rest: 110, hang: 10 },
        { label: 'drag-1', rest: 110, hang: 10 },
        { label: 'drag-2', rest: 110, hang: 10 },
        { label: 'drag-3', rest: 110, hang: 10 },
    ],
    builtIn: true,
};

function saveProtocols() {
    const userProtocols = protocols.filter(p => !p.builtIn);
    localStorage.setItem(STORAGE_KEY_PROTOCOLS, JSON.stringify(userProtocols));
    localStorage.setItem(STORAGE_KEY_ACTIVE, activeProtocolId);
}

function getActiveProtocol() {
    return protocols.find(p => p.id === activeProtocolId) || protocols[0];
}

function setActiveProtocol(id) {
    const proto = protocols.find(p => p.id === id);
    if (!proto) return;
    activeProtocolId = id;
    routine = proto.steps.map(s => ({ ...s }));
    saveProtocols();
    reset();
    renderProtocolTitle();
}

function loadProtocols() {
    const saved = localStorage.getItem(STORAGE_KEY_PROTOCOLS);
    let userProtocols = [];
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) userProtocols = parsed;
        } catch (_) { /* ignore */ }
    }

    // Migration: convert old single-routine storage to a protocol
    if (!saved && localStorage.getItem(STORAGE_KEY_LEGACY)) {
        try {
            const oldSteps = JSON.parse(localStorage.getItem(STORAGE_KEY_LEGACY));
            if (Array.isArray(oldSteps) && oldSteps.length > 0 && oldSteps[0].label !== undefined) {
                const stepsMatch = JSON.stringify(oldSteps) === JSON.stringify(DEFAULT_PROTOCOL.steps);
                if (!stepsMatch) {
                    userProtocols.push({
                        id: crypto.randomUUID(),
                        title: 'My Routine',
                        description: '',
                        steps: oldSteps,
                    });
                }
            }
        } catch (_) { /* ignore */ }
    }

    protocols = [
        { ...DEFAULT_PROTOCOL, steps: DEFAULT_PROTOCOL.steps.map(s => ({ ...s })) },
        ...userProtocols,
    ];

    const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (savedActive && protocols.find(p => p.id === savedActive)) {
        activeProtocolId = savedActive;
    } else if (userProtocols.length > 0 && !saved) {
        activeProtocolId = userProtocols[0].id;
    } else {
        activeProtocolId = DEFAULT_PROTOCOL_ID;
    }

    const active = getActiveProtocol();
    routine = active.steps.map(s => ({ ...s }));
}

function saveRoutine() {
    const proto = getActiveProtocol();
    proto.steps = routine.map(s => ({ ...s }));
    saveProtocols();
}

function createProtocol(title, description, steps) {
    const proto = {
        id: crypto.randomUUID(),
        title: title || 'New Routine',
        description: description || '',
        steps: steps || [{ label: '', rest: 10, hang: 10 }],
    };
    protocols.push(proto);
    saveProtocols();
    return proto;
}

function deleteProtocol(id) {
    const proto = protocols.find(p => p.id === id);
    if (!proto || proto.builtIn) return;
    protocols = protocols.filter(p => p.id !== id);
    if (activeProtocolId === id) {
        setActiveProtocol(protocols[0].id);
    }
    saveProtocols();
}

// ── Share Link Encoding ──

function encodeShareUrl(protocol) {
    const data = {
        title: protocol.title,
        description: protocol.description || '',
        steps: protocol.steps,
    };
    const json = JSON.stringify(data);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    return window.location.origin + window.location.pathname + '#import=' + base64;
}

function decodeShareData(hash) {
    if (!hash || !hash.startsWith('#import=')) return null;
    try {
        const base64 = hash.slice('#import='.length);
        const json = decodeURIComponent(escape(atob(base64)));
        const data = JSON.parse(json);
        if (data && data.title && Array.isArray(data.steps) && data.steps.length > 0) {
            return data;
        }
    } catch (_) { /* invalid share link */ }
    return null;
}

function checkImportHash() {
    const data = decodeShareData(window.location.hash);
    if (!data) return;
    showImportModal(data);
}

function importProtocol(data) {
    const proto = createProtocol(data.title, data.description, data.steps);
    setActiveProtocol(proto.id);
    history.replaceState(null, '', window.location.pathname);
}

function showImportModal(data) {
    const modal = $('#import-modal');
    $('#import-title').textContent = data.title;
    $('#import-step-count').textContent = data.steps.length + ' step' + (data.steps.length !== 1 ? 's' : '');
    const descEl = $('#import-description');
    if (data.description) {
        descEl.innerHTML = data.description;
        descEl.classList.remove('hidden');
    } else {
        descEl.innerHTML = '';
        descEl.classList.add('hidden');
    }
    modal.classList.remove('hidden');

    const onAccept = () => {
        importProtocol(data);
        modal.classList.add('hidden');
        cleanup();
        renderProtocolTitle();
        renderTimerList();
        updateCompletionTime();
    };
    const onDecline = () => {
        history.replaceState(null, '', window.location.pathname);
        modal.classList.add('hidden');
        cleanup();
    };
    const cleanup = () => {
        $('#btn-import-accept').removeEventListener('click', onAccept);
        $('#btn-import-decline').removeEventListener('click', onDecline);
        $('#import-modal .modal-backdrop').removeEventListener('click', onDecline);
    };
    $('#btn-import-accept').addEventListener('click', onAccept);
    $('#btn-import-decline').addEventListener('click', onDecline);
    $('#import-modal .modal-backdrop').addEventListener('click', onDecline);
}

// ── Rendering: Protocol UI ──

function renderProtocolTitle() {
    const proto = getActiveProtocol();
    const titleEl = $('#protocol-name');
    if (titleEl) titleEl.textContent = proto.title;
}

function renderProtocolDescription() {
    const proto = getActiveProtocol();
    const container = $('#protocol-description');
    const panel = $('#description-panel');
    if (!container || !panel) return;
    if (proto.description) {
        container.innerHTML = proto.description;
        panel.classList.remove('hidden');
        setupDescriptionLightbox();
    } else {
        container.innerHTML = '';
        panel.classList.add('hidden');
    }
}

function setupDescriptionLightbox() {
    const container = $('#protocol-description');
    if (!container) return;
    container.querySelectorAll('.grip-card img').forEach(img => {
        img.addEventListener('click', () => {
            const lb = document.createElement('div');
            lb.className = 'lightbox';
            const big = document.createElement('img');
            big.src = img.src;
            big.alt = img.alt;
            lb.appendChild(big);
            lb.addEventListener('click', () => lb.remove());
            document.body.appendChild(lb);
        });
    });
}

function renderProtocolList() {
    const list = $('#protocol-list-items');
    if (!list) return;
    list.innerHTML = '';
    protocols.forEach(proto => {
        const el = document.createElement('div');
        el.className = 'protocol-list-item';
        if (proto.id === activeProtocolId) el.classList.add('active');

        const info = document.createElement('div');
        info.className = 'protocol-list-info';
        info.innerHTML =
            '<div class="protocol-list-title">' + escapeHtml(proto.title) + '</div>' +
            '<div class="protocol-list-meta">' + proto.steps.length + ' step' + (proto.steps.length !== 1 ? 's' : '') + '</div>';

        el.appendChild(info);

        if (!proto.builtIn) {
            const del = document.createElement('button');
            del.className = 'protocol-list-action-btn protocol-list-delete';
            del.setAttribute('aria-label', 'Delete routine');
            del.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete "' + proto.title + '"?')) {
                    deleteProtocol(proto.id);
                    renderProtocolList();
                    renderProtocolTitle();
                    renderTimerList();
                    updateCompletionTime();
                }
            });
            el.appendChild(del);
        }

        el.addEventListener('click', () => {
            setActiveProtocol(proto.id);
            $('#protocol-modal').classList.add('hidden');
            renderProtocolDescription();
            renderTimerList();
            updateCompletionTime();
        });

        list.appendChild(el);
    });
}

function showToast(message) {
    let toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2200);
}

// ── Rendering: Timer View ──

function renderTimerList() {
    timerList.innerHTML = '';
    routine.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'timer-item';

        if (currentIndex >= 0 && i < currentIndex) {
            el.classList.add('completed');
        }
        if (i === currentIndex && currentPhase === 'rest') {
            el.classList.add('active-rest');
        }
        if (i === currentIndex && currentPhase === 'hang') {
            el.classList.add('active-hang');
        }

        const indexContent = (currentIndex >= 0 && i < currentIndex)
            ? '✓'
            : String(i + 1);

        el.innerHTML =
            '<div class="timer-index">' + indexContent + '</div>' +
            '<div class="timer-item-info">' +
                '<div class="timer-item-label">' + escapeHtml(item.label || 'Timer ' + (i + 1)) + '</div>' +
                '<div class="timer-item-times">Rest ' + item.rest + 's · Hang ' + item.hang + 's</div>' +
            '</div>' +
            '<button class="timer-item-play" data-index="' + i + '" aria-label="Start from timer ' + (i + 1) + '">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>' +
            '</button>';

        timerList.appendChild(el);
    });

    scrollActiveIntoView();
}

function scrollActiveIntoView() {
    if (currentIndex >= 0 && currentIndex < timerList.children.length) {
        const el = timerList.children[currentIndex];
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function updateCountdown() {
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    countdownEl.textContent = seconds;

    const progress = totalPhaseMs > 0 ? 1 - (remainingMs / totalPhaseMs) : 0;
    const barWidth = currentPhase === 'hang'
        ? (1 - progress) * 100
        : progress * 100;
    barFill.style.width = barWidth + '%';

    if (currentPhase === 'rest') {
        barFill.classList.remove('hang');
        barFill.classList.add('rest');
        phaseLabelEl.textContent = 'REST';
        phaseLabelEl.style.color = 'var(--rest)';
    } else if (currentPhase === 'hang') {
        barFill.classList.remove('rest');
        barFill.classList.add('hang');
        phaseLabelEl.textContent = 'HANG';
        phaseLabelEl.style.color = 'var(--hang)';
    } else {
        barFill.classList.remove('rest', 'hang');
        phaseLabelEl.textContent = currentIndex >= routine.length ? 'DONE' : 'READY';
        phaseLabelEl.style.color = '';
        barFill.style.width = '0%';
    }


}

function updateCompletionTime() {
    let totalSeconds = 0;
    const startIdx = Math.max(currentIndex, 0);

    for (let i = startIdx; i < routine.length; i++) {
        if (i === currentIndex && currentPhase) {
            totalSeconds += Math.ceil(remainingMs / 1000);
            if (currentPhase === 'rest') {
                totalSeconds += routine[i].hang;
            }
        } else {
            totalSeconds += routine[i].rest + routine[i].hang;
        }
    }

    if (totalSeconds <= 0 && currentIndex >= routine.length) {
        timeLeftEl.textContent = 'Done!';
        timeDoneEl.textContent = '';
        return;
    }

    if (totalSeconds <= 0) {
        timeLeftEl.textContent = '';
        timeDoneEl.textContent = '';
        return;
    }

    const leftMin = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const leftSec = String(totalSeconds % 60).padStart(2, '0');
    timeLeftEl.innerHTML = '<span class="controls-time-icon">⏱</span> ' + leftMin + ':' + leftSec;

    const now = new Date();
    const end = new Date(now.getTime() + totalSeconds * 1000);
    const h = end.getHours();
    const m = String(end.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    timeDoneEl.innerHTML = '<span class="controls-time-icon">✓</span> ' + ((h % 12) || 12) + ':' + m + ' ' + ampm;
}

function updatePlayIcon() {
    if (isPlaying) {
        playIcon.innerHTML = '<rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/>';
    } else {
        playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
}

// ── Rendering: Edit View ──

const DRAG_HANDLE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">' +
    '<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>' +
    '<circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>' +
    '<circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

function renderEditList() {
    editList.innerHTML = '';
    routine.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'edit-item';
        el.dataset.index = i;
        if (selectedIndices.has(i)) el.classList.add('selected');

        el.innerHTML =
            '<div class="drag-handle" data-drag="true">' + DRAG_HANDLE_SVG + '</div>' +
            '<input type="checkbox" data-index="' + i + '"' + (selectedIndices.has(i) ? ' checked' : '') + '>' +
            '<input type="text" class="edit-item-label" value="' + escapeAttr(item.label) + '" data-index="' + i + '" data-field="label" placeholder="Timer ' + (i + 1) + '">' +
            '<input type="number" class="edit-time-input" value="' + item.rest + '" data-index="' + i + '" data-field="rest" min="1">' +
            '<input type="number" class="edit-time-input" value="' + item.hang + '" data-index="' + i + '" data-field="hang" min="1">';

        editList.appendChild(el);
    });

    const addCard = document.createElement('button');
    addCard.className = 'add-timer-card';
    addCard.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Cycle';
    addCard.addEventListener('click', () => {
        const last = routine.length > 0 ? routine[routine.length - 1] : { rest: 10, hang: 10 };
        routine.push({ label: '', rest: last.rest, hang: last.hang });
        renderEditList();
        const items = editList.querySelectorAll('.edit-item');
        items[items.length - 1]?.scrollIntoView({ behavior: 'smooth' });
    });
    editList.appendChild(addCard);

    updateSelectionUI();
}

// ── Drag to Reorder ──

let dragState = null;

function getDragIndex(y) {
    const items = editList.children;
    for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (y < mid) return i;
    }
    return items.length;
}

function clearDragIndicators() {
    const items = editList.querySelectorAll('.edit-item');
    items.forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below');
    });
}

function showDragIndicator(targetIdx) {
    clearDragIndicators();
    if (dragState === null) return;
    const fromIdx = dragState.fromIndex;
    if (targetIdx === fromIdx || targetIdx === fromIdx + 1) return;

    const items = editList.children;
    if (targetIdx < items.length) {
        items[targetIdx].classList.add('drag-over-above');
    } else if (items.length > 0) {
        items[items.length - 1].classList.add('drag-over-below');
    }
}

function finishDrag(toIndex) {
    if (dragState === null) return;
    const fromIndex = dragState.fromIndex;
    clearDragIndicators();

    const draggedEl = editList.children[fromIndex];
    if (draggedEl) draggedEl.classList.remove('dragging');

    if (toIndex !== fromIndex && toIndex !== fromIndex + 1) {
        const [item] = routine.splice(fromIndex, 1);
        const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
        routine.splice(insertAt, 0, item);

        // Remap selected indices
        const newSelected = new Set();
        selectedIndices.forEach(si => {
            let ni = si;
            if (si === fromIndex) {
                ni = insertAt;
            } else {
                if (si > fromIndex) ni--;
                if (ni >= insertAt) ni++;
            }
            newSelected.add(ni);
        });
        selectedIndices = newSelected;

        renderEditList();
    }

    dragState = null;
}

function setupDragListeners() {
    // Touch events
    editList.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('[data-drag]');
        if (!handle) return;
        const item = handle.closest('.edit-item');
        if (!item) return;

        e.preventDefault();
        const idx = parseInt(item.dataset.index, 10);
        item.classList.add('dragging');
        dragState = { fromIndex: idx };
    }, { passive: false });

    editList.addEventListener('touchmove', (e) => {
        if (!dragState) return;
        e.preventDefault();
        const touch = e.touches[0];
        const targetIdx = getDragIndex(touch.clientY);
        showDragIndicator(targetIdx);
        dragState.lastTargetIndex = targetIdx;

        // Auto-scroll when near edges
        const listRect = editList.getBoundingClientRect();
        const edgeZone = 40;
        if (touch.clientY < listRect.top + edgeZone) {
            editList.scrollTop -= 8;
        } else if (touch.clientY > listRect.bottom - edgeZone) {
            editList.scrollTop += 8;
        }
    }, { passive: false });

    editList.addEventListener('touchend', () => {
        if (!dragState) return;
        const toIndex = dragState.lastTargetIndex !== undefined
            ? dragState.lastTargetIndex
            : dragState.fromIndex;
        finishDrag(toIndex);
    });

    editList.addEventListener('touchcancel', () => {
        if (!dragState) return;
        clearDragIndicators();
        const draggedEl = editList.children[dragState.fromIndex];
        if (draggedEl) draggedEl.classList.remove('dragging');
        dragState = null;
    });

    // Mouse events
    editList.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('[data-drag]');
        if (!handle) return;
        const item = handle.closest('.edit-item');
        if (!item) return;

        e.preventDefault();
        const idx = parseInt(item.dataset.index, 10);
        item.classList.add('dragging');
        dragState = { fromIndex: idx };

        const onMouseMove = (ev) => {
            if (!dragState) return;
            const targetIdx = getDragIndex(ev.clientY);
            showDragIndicator(targetIdx);
            dragState.lastTargetIndex = targetIdx;
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (!dragState) return;
            const toIndex = dragState.lastTargetIndex !== undefined
                ? dragState.lastTargetIndex
                : dragState.fromIndex;
            finishDrag(toIndex);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function updateSelectionUI() {
    const count = selectedIndices.size;
    selectedCountEl.textContent = count > 0 ? count + ' selected' : '';
    groupInfoEl.textContent = count + ' selected';
    selectAllCb.checked = count === routine.length && count > 0;
    selectAllCb.indeterminate = count > 0 && count < routine.length;

    if (count > 0) {
        groupBar.classList.remove('hidden');
    } else {
        groupBar.classList.add('hidden');
    }
}

// ── Timer Logic ──

function startFrom(index, phase) {
    phase = phase || 'rest';
    clearInterval(intervalId);

    currentIndex = index;
    currentPhase = phase;
    totalPhaseMs = (phase === 'rest' ? routine[index].rest : routine[index].hang) * 1000;
    remainingMs = totalPhaseMs;
    isPlaying = true;

    requestWakeLock();
    updatePlayIcon();
    renderTimerList();
    updateCountdown();
    updateCompletionTime();

    intervalId = setInterval(tick, 100);
}

let lastBeepSecond = -1;

function tick() {
    remainingMs -= 100;

    const seconds = Math.ceil(remainingMs / 1000);

    if (currentPhase === 'rest' && seconds >= 1 && seconds <= 3 && seconds !== lastBeepSecond) {
        playBeep(0.2, 1000);
        vibrate(50);
        lastBeepSecond = seconds;
    }

    if (remainingMs <= 0) {
        clearInterval(intervalId);
        lastBeepSecond = -1;

        if (currentPhase === 'rest') {
            playBeep(0.4, 1500);
            vibrate(150);
            currentPhase = 'hang';
            totalPhaseMs = routine[currentIndex].hang * 1000;
            remainingMs = totalPhaseMs;
            renderTimerList();
            intervalId = setInterval(tick, 100);
        } else {
            playBeep(0.3, 2000);
            vibrate(100);

            if (currentIndex + 1 < routine.length) {
                currentIndex++;
                currentPhase = 'rest';
                totalPhaseMs = routine[currentIndex].rest * 1000;
                remainingMs = totalPhaseMs;
                renderTimerList();
                intervalId = setInterval(tick, 100);
            } else {
                currentIndex = routine.length;
                currentPhase = null;
                isPlaying = false;
                releaseWakeLock();
                updatePlayIcon();
                renderTimerList();
            }
        }
    }

    updateCountdown();
    updateCompletionTime();
}

function togglePlayPause() {
    getAudioCtx();

    if (!isPlaying && currentIndex === -1) {
        startFrom(0);
    } else if (!isPlaying && currentIndex >= routine.length) {
        reset();
        startFrom(0);
    } else if (isPlaying) {
        clearInterval(intervalId);
        isPlaying = false;
        releaseWakeLock();
        updatePlayIcon();
    } else {
        isPlaying = true;
        requestWakeLock();
        intervalId = setInterval(tick, 100);
        updatePlayIcon();
    }
}

function reset() {
    clearInterval(intervalId);
    isPlaying = false;
    currentIndex = -1;
    currentPhase = null;
    remainingMs = 0;
    totalPhaseMs = 0;
    lastBeepSecond = -1;
    releaseWakeLock();
    updatePlayIcon();
    updateCountdown();
    updateCompletionTime();
    renderTimerList();
}

// ── View Switching ──

function showView(view) {
    if (view === 'timer') {
        timerView.classList.add('active');
        editView.classList.remove('active');
        renderTimerList();
        updateCompletionTime();
    } else {
        editView.classList.add('active');
        timerView.classList.remove('active');
        selectedIndices.clear();
        const proto = getActiveProtocol();
        $('#edit-title').value = proto.title;
        const delBtn = $('#btn-delete-routine');
        if (proto.builtIn) {
            delBtn.classList.add('hidden');
        } else {
            delBtn.classList.remove('hidden');
        }
        renderProtocolDescription();
        renderEditList();
    }
}

// ── Event Listeners ──

function setupEventListeners() {
    setupDragListeners();

    $('#btn-play').addEventListener('click', togglePlayPause);

    $('#btn-edit').addEventListener('click', () => showView('edit'));

    $('#btn-reset').addEventListener('click', () => {
        if (currentIndex <= -1) return;
        if (confirm('Reset the routine?')) reset();
    });

    $('#btn-back').addEventListener('click', () => {
        const proto = getActiveProtocol();
        const newTitle = $('#edit-title').value.trim();
        if (newTitle && newTitle !== proto.title) {
            proto.title = newTitle;
        }
        saveRoutine();
        if (currentIndex >= routine.length) reset();
        renderProtocolTitle();
        showView('timer');
    });

    // Timer list: start from any timer
    timerList.addEventListener('click', (e) => {
        const btn = e.target.closest('.timer-item-play');
        if (!btn) return;
        const index = parseInt(btn.dataset.index, 10);
        getAudioCtx();
        startFrom(index);
    });

    // Edit list: inline editing & checkbox toggling
    editList.addEventListener('change', (e) => {
        const el = e.target;
        const i = parseInt(el.dataset.index, 10);
        if (isNaN(i)) return;

        if (el.type === 'checkbox') {
            if (el.checked) selectedIndices.add(i);
            else selectedIndices.delete(i);
            el.closest('.edit-item').classList.toggle('selected', el.checked);
            updateSelectionUI();
        }
    });

    editList.addEventListener('input', (e) => {
        const el = e.target;
        const i = parseInt(el.dataset.index, 10);
        const field = el.dataset.field;
        if (isNaN(i) || !field) return;

        if (field === 'label') {
            routine[i].label = el.value;
        } else {
            const val = parseInt(el.value);
            if (val > 0) routine[i][field] = val;
        }
    });

    // Select all
    selectAllCb.addEventListener('change', () => {
        if (selectAllCb.checked) {
            routine.forEach((_, i) => selectedIndices.add(i));
        } else {
            selectedIndices.clear();
        }
        renderEditList();
    });

    // Group edit
    $('#btn-group-edit').addEventListener('click', () => {
        groupModal.classList.remove('hidden');
    });

    $('#btn-delete-selected').addEventListener('click', () => {
        const count = selectedIndices.size;
        if (!count) return;
        if (!confirm('Remove ' + count + ' timer(s)?')) return;

        routine = routine.filter((_, i) => !selectedIndices.has(i));
        selectedIndices.clear();
        renderEditList();
    });

    $('#btn-modal-cancel').addEventListener('click', () => {
        groupModal.classList.add('hidden');
    });

    $('#group-modal .modal-backdrop').addEventListener('click', () => {
        groupModal.classList.add('hidden');
    });

    $('#btn-modal-apply').addEventListener('click', () => {
        const label = $('#group-label').value.trim();
        const rest = parseInt($('#group-rest').value);
        const hang = parseInt($('#group-hang').value);

        selectedIndices.forEach(i => {
            if (label) routine[i].label = label;
            if (rest > 0) routine[i].rest = rest;
            if (hang > 0) routine[i].hang = hang;
        });

        $('#group-label').value = '';
        groupModal.classList.add('hidden');
        renderEditList();
    });

    // Progress bar: tap to seek
    const progressTrack = $('.progress-bar-track');
    function seekToPosition(clientX) {
        if (!currentPhase || !isPlaying) return;
        const rect = progressTrack.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

        if (currentPhase === 'rest') {
            remainingMs = totalPhaseMs * (1 - fraction);
        } else {
            remainingMs = totalPhaseMs * fraction;
        }

        remainingMs = Math.max(0, remainingMs);
        updateCountdown();
        updateCompletionTime();
    }
    progressTrack.addEventListener('touchend', (e) => {
        e.preventDefault();
        seekToPosition(e.changedTouches[0].clientX);
    });
    progressTrack.addEventListener('click', (e) => {
        seekToPosition(e.clientX);
    });

    // Protocol picker
    $('#protocol-picker').addEventListener('click', () => {
        renderProtocolList();
        $('#protocol-modal').classList.remove('hidden');
    });

    $('#protocol-modal .modal-backdrop').addEventListener('click', () => {
        $('#protocol-modal').classList.add('hidden');
    });

    $('#btn-new-protocol').addEventListener('click', () => {
        const proto = createProtocol('New Routine', '', [{ label: '', rest: 10, hang: 10 }]);
        setActiveProtocol(proto.id);
        $('#protocol-modal').classList.add('hidden');
        renderProtocolTitle();
        renderTimerList();
        updateCompletionTime();
        showView('edit');
    });

    // Share button
    $('#btn-share').addEventListener('click', () => {
        const proto = getActiveProtocol();
        const newTitle = $('#edit-title').value.trim();
        if (newTitle) proto.title = newTitle;
        saveRoutine();
        const url = encodeShareUrl(proto);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                showToast('Share link copied!');
            }).catch(() => {
                promptShareUrl(url);
            });
        } else {
            promptShareUrl(url);
        }
    });

    // Delete routine
    $('#btn-delete-routine').addEventListener('click', () => {
        const proto = getActiveProtocol();
        if (proto.builtIn) {
            alert('The built-in routine cannot be deleted.');
            return;
        }
        if (!confirm('Delete "' + proto.title + '"?')) return;
        deleteProtocol(proto.id);
        renderProtocolTitle();
        renderTimerList();
        updateCompletionTime();
        showView('timer');
    });

    // Edit title input updates protocol title live
    $('#edit-title').addEventListener('input', (e) => {
        const proto = getActiveProtocol();
        proto.title = e.target.value.trim() || proto.title;
    });
}

function promptShareUrl(url) {
    prompt('Copy this share link:', url);
}

// ── Utilities ──

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Init ──

function init() {
    loadProtocols();
    renderProtocolTitle();
    renderTimerList();
    updateCountdown();
    updateCompletionTime();
    setupEventListeners();
    setInterval(updateCompletionTime, 1000);
    checkImportHash();
}

init();

let currentInterval = null;
let isPaused = false;
let remainingDuration = 0;
let currentPhase = 'rest';
let currentIndex = 0;
let currentHeight = 0; // Track current height of progress bar

const startButton = document.getElementById('startRoutine');
const pauseButton = document.getElementById('pauseRoutine');
const resetButton = document.getElementById('resetRoutine');

// Disable Pause button initially
pauseButton.disabled = true;

// Set up tabs for Setup and Main
function openTab(tabName) {
    document.getElementById('setup').style.display = tabName === 'setup' ? 'block' : 'none';
    document.getElementById('main').style.display = tabName === 'main' ? 'block' : 'none';
}

// Generate 10 rows in Setup and store labels and times
const restDurations = [];
const hangDurations = [];
for (let i = 1; i <= 10; i++) {
    const row = document.getElementById('inputRowTemplate').cloneNode(true);
    row.id = `inputRow${i}`;
    
    // Set default values for rest (10s) and hang (5s)
    row.children[1].value = 10;
    row.children[2].value = 5;

    document.getElementById('routine-setup').appendChild(row);
    restDurations.push(row.children[1]);
    hangDurations.push(row.children[2]);
}
document.getElementById('inputRowTemplate').remove();

// Initialize labels in the Main tab based on Setup inputs
function initializeRoutine() {
    const restLabels = document.getElementById('restLabels');
    const hangLabels = document.getElementById('hangLabels');
    restLabels.innerHTML = '';  
    hangLabels.innerHTML = '';  

    for (let i = 0; i < 10; i++) {
        const restLabel = document.createElement('div');
        restLabel.classList.add('label-item');
        restLabel.textContent = restDurations[i].value;
        restLabel.id = `restLabel${i + 1}`;
        restLabels.appendChild(restLabel);

        const hangLabel = document.createElement('div');
        hangLabel.classList.add('label-item');
        hangLabel.textContent = hangDurations[i].value;
        hangLabel.id = `hangLabel${i + 1}`;
        hangLabels.appendChild(hangLabel);
    }
}

// Start Routine button behavior
startButton.addEventListener('click', () => {
    startButton.disabled = true; // Disable Start button after it's pressed
    pauseButton.disabled = false; // Enable Pause button after Start is pressed
    initializeRoutine();
    startRoutine(0, 'rest');
});

// Pause/Resume button behavior
pauseButton.addEventListener('click', () => {
    if (isPaused) {
        pauseButton.textContent = 'Pause';
        startRoutine(currentIndex, currentPhase, remainingDuration); // Resume with remaining time
        isPaused = false;
    } else {
        clearInterval(currentInterval); // Pause the interval
        isPaused = true;
        pauseButton.textContent = 'Resume';
    }
});

// Reset Routine button with confirmation
resetButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset the routine?")) {
        clearInterval(currentInterval);
        document.getElementById('progressBar').style.height = '0';
        document.getElementById('countdownLabel').textContent = '0';
        pauseButton.textContent = 'Pause'; // Reset Pause button text
        isPaused = false;
        remainingDuration = 0;
        currentIndex = 0;
        currentHeight = 0; // Reset height tracking
        startButton.disabled = false; // Re-enable Start button on reset
        pauseButton.disabled = true; // Disable Pause button on reset
        initializeRoutine();
    }
});

// Function to run the routine with alternating rest and hang
function startRoutine(index, phase, durationOverride = null) {
    if (index >= 10) {
        startButton.disabled = false; // Re-enable Start button when routine completes
        pauseButton.disabled = true; // Disable Pause button after routine completes
        return;
    }

    const restTime = parseInt(restDurations[index].value) * 1000;
    const hangTime = parseInt(hangDurations[index].value) * 1000;
    const bar = document.getElementById('progressBar');
    const countdownLabel = document.getElementById('countdownLabel');
    const label = document.getElementById(`${phase}Label${index + 1}`);

    let duration = durationOverride || (phase === 'rest' ? restTime : hangTime);
    remainingDuration = duration;
    currentPhase = phase;
    currentIndex = index;

    let increment = 100 / (duration / 100);
    let height = phase === 'rest' ? (currentHeight || 0) : (currentHeight || 100);
    let color = phase === 'rest' ? 'yellow' : 'green';
    bar.className = `progress-bar ${color}`;
    label.style.color = phase === 'rest' ? '#ffc13b' : '#4caf50';
    
    currentInterval = setInterval(() => {
        height += (phase === 'rest' ? increment : -increment);
        bar.style.height = `${height}%`;
        currentHeight = height; // Track current height for resume

        const remainingSeconds = Math.ceil(duration / 1000 - (phase === 'rest' ? height : 100 - height) / 100 * (duration / 1000));
        countdownLabel.textContent = remainingSeconds;
        remainingDuration -= 100;

        if ((phase === 'rest' && height >= 100) || (phase === 'hang' && height <= 0)) {
            clearInterval(currentInterval);
            currentHeight = 0; // Reset height tracking for the next phase
            bar.classList.add('grey');
            label.classList.add('completed-label'); // Add completed class for grey and strikethrough

            if (phase === 'rest') {
                startRoutine(index, 'hang');
            } else {
                startRoutine(index + 1, 'rest');
            }
        }
    }, 100);
}

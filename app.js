let currentInterval = null;
let isPaused = false;
let remainingDuration = 0;
let currentPhase = 'rest';
let currentIndex = 0;
let currentHeight = 0; // Track current height of progress bar

const startButton = document.getElementById('startRoutine');
const startIcon = document.getElementById('startIcon');
const resetButton = document.getElementById('resetRoutine');


const play_path = "M6 6.74105C6 5.19747 7.67443 4.23573 9.00774 5.01349L18.0231 10.2725C19.3461 11.0442 19.3461 12.9558 18.0231 13.7276L9.00774 18.9865C7.67443 19.7643 6 18.8026 6 17.259V6.74105ZM17.0154 12L8 6.74105V17.259L17.0154 12Z";
const pause_path = "M9 6C9.55228 6 10 6.44772 10 7V17C10 17.5523 9.55228 18 9 18C8.44772 18 8 17.5523 8 17V7C8 6.44772 8.44772 6 9 6ZM15 6C15.5523 6 16 6.44772 16 7V17C16 17.5523 15.5523 18 15 18C14.4477 18 14 17.5523 14 17V7C14 6.44772 14.4477 6 15 6Z";


const ButtonState = Object.freeze({
    INITIAL: 'Initial',
    PLAYING: 'Playing',
    PAUSED: 'Paused',
});

let routineState = ButtonState.INITIAL;
// // Disable Pause button initially

// Set up tabs for Setup and Main
function openTab(tabName) {
    document.getElementById('setup').style.display = tabName === 'setup' ? 'block' : 'none';
    document.getElementById('main').style.display = tabName === 'main' ? 'block' : 'none';
}

const restDurations = [];
const hangDurations = [];
const setupLabels = [];
for (let i = 1; i <= 17; i++) {
    const row = document.getElementById('inputRowTemplate').cloneNode(true);
    row.id = `inputRow${i}`;

    // Set default values for rest (10s) and hang (5s)
    row.children[0].value = "";
    row.children[1].value = 10;
    row.children[2].value = 5;

    document.getElementById('routine-setup').appendChild(row);
    setupLabels.push(row.children[0].value); // Save setup label text
    restDurations.push(row.children[1]);
    hangDurations.push(row.children[2]);
}
document.getElementById('inputRowTemplate').remove();

function initializeRoutine() {
    const setupLabelsContainer = document.getElementById('setupLabels');
    const restLabels = document.getElementById('restLabels');
    const hangLabels = document.getElementById('hangLabels');
    setupLabelsContainer.innerHTML = '';
    restLabels.innerHTML = '';
    hangLabels.innerHTML = '';

    for (let i = 0; i < 17; i++) {
        // Retrieve the label text directly from the input field each time
        const setupLabelText = document.getElementById(`inputRow${i + 1}`).children[0].value;

        const setupLabel = document.createElement('div');
        setupLabel.classList.add('label-item');
        setupLabel.textContent = setupLabelText || "Label"; // Use "Label" as a fallback
        setupLabel.id = `setupLabel${i + 1}`;
        setupLabelsContainer.appendChild(setupLabel);

        const restLabel = document.createElement('div');
        restLabel.classList.add('label-item');
        restLabel.textContent = `${document.getElementById(`inputRow${i + 1}`).children[1].value}s`; // Add "rest " prefix
        restLabel.id = `restLabel${i + 1}`;
        restLabels.appendChild(restLabel);

        const hangLabel = document.createElement('div');
        hangLabel.classList.add('label-item');
        hangLabel.textContent = `${hangDurations[i].value}s`; // Append "s" to indicate seconds
        hangLabel.id = `hangLabel${i + 1}`;
        hangLabels.appendChild(hangLabel);
    }
    updateEstimatedCompletionTime();
}


// Start Routine button behavior
startButton.addEventListener('click', () => {
    if (routineState == ButtonState.INITIAL) {
        startRoutine(0, 'rest');
        updateEstimatedCompletionTime();
        const path = startIcon.querySelector('path');
        path.setAttribute('d', pause_path);
        routineState = ButtonState.PLAYING;
    }
    else if (routineState == ButtonState.PLAYING) {
        clearInterval(currentInterval); // Pause the interval
        const path = startIcon.querySelector('path');
        path.setAttribute('d', play_path);
        routineState = ButtonState.PAUSED;
    }
    else if (routineState == ButtonState.PAUSED) {
        startRoutine(currentIndex, currentPhase, remainingDuration); // Resume with remaining time
        updateEstimatedCompletionTime();
        const path = startIcon.querySelector('path');
        path.setAttribute('d', pause_path);
        routineState = ButtonState.PLAYING;
    }
});


// Reset Routine button with confirmation
resetButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset the routine?")) {
        clearInterval(currentInterval);
        document.getElementById('progressBar').style.height = '0';
        document.getElementById('countdownLabel').textContent = '0';
        isPaused = false;
        remainingDuration = 0;
        currentIndex = 0;
        currentHeight = 0; // Reset height tracking
        routineState = ButtonState.INITIAL;
        const path = startIcon.querySelector('path');
        path.setAttribute('d', play_path);
        initializeRoutine();
    }
});

function playBeep(seconds = 0.25, frequency = 1000) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequency; // Set the frequency (pitch)
    gainNode.gain.value = 0.3; // Volume of the beep

    oscillator.start();
    setTimeout(() => {
        oscillator.stop();
    }, seconds * 1000); // Convert seconds to milliseconds for the beep duration
}


function startRoutine(index, phase, durationOverride = null) {
    if (index >= 17) {
        startButton.innerHTML = "Start";
        return;
    }

    const restTime = parseInt(restDurations[index].value) * 1000;
    const hangTime = parseInt(hangDurations[index].value) * 1000;
    const bar = document.getElementById('progressBar');
    const countdownLabel = document.getElementById('countdownLabel');
    const label = document.getElementById(`${phase}Label${index + 1}`);
    const setupLabel = document.getElementById(`setupLabel${index + 1}`);
    const restLabel = document.getElementById(`restLabel${index + 1}`);
    const hangLabel = document.getElementById(`hangLabel${index + 1}`);

    // Clear the active label class from previous row
    if (index > 0) {
        document.getElementById(`setupLabel${index}`).classList.remove('active-label');
        document.getElementById(`restLabel${index}`).classList.remove('active-label');
        document.getElementById(`hangLabel${index}`).classList.remove('active-label');
    }

    // Apply the active label class to the current row
    setupLabel.classList.add('active-label');
    restLabel.classList.add('active-label');
    hangLabel.classList.add('active-label');

    let duration = durationOverride || (phase === 'rest' ? restTime : hangTime);
    remainingDuration = duration;
    currentPhase = phase;
    currentIndex = index;

    let increment = 100 / (duration / 100);
    let height = phase === 'rest' ? (currentHeight || 0) : (currentHeight || 100);
    let color = phase === 'rest' ? 'yellow' : 'green';
    bar.className = `progress-bar ${color}`;
    label.style.background = phase === 'rest' ? '#ffc13b' : '#4caf50';

    let lastBeepTime = 4; // Tracks when the last beep occurred

    currentInterval = setInterval(() => {
        height += (phase === 'rest' ? increment : -increment);
        bar.style.height = `${height}%`;
        currentHeight = height; // Track current height for resume

        const remainingSeconds = Math.ceil(duration / 1000 - (phase === 'rest' ? height : 100 - height) / 100 * (duration / 1000));
        countdownLabel.textContent = remainingSeconds;
        remainingDuration -= 100;

        // Play a 250ms, 1000Hz beep for each of the last 5 seconds, except the final second
        if (phase === 'rest' && 1 <= remainingSeconds && remainingSeconds <= 3 && remainingSeconds !== lastBeepTime) {
            playBeep(0.25, 1000);
            lastBeepTime = remainingSeconds;
        }
        if ((phase === 'rest' && height >= 100) || (phase === 'hang' && height <= 0)) {
            clearInterval(currentInterval);
            currentHeight = 0; // Reset height tracking for the next phase
            bar.classList.add('grey');
            label.style.background = 'none';
            label.classList.add('completed-label'); // Add completed class for grey and strikethrough

            // Apply strikethrough to setup label only after the hang phase completes
            if (phase === 'hang') {
                setupLabel.classList.add('completed-label');
            }

            if (phase === 'rest') {
                playBeep(0.500, 1500);
                startRoutine(index, 'hang');
            } else {
                playBeep(0.300, 2000);
                startRoutine(index + 1, 'rest');
            }
        }
    }, 100);
}

// Load default data on startup
async function loadDefaultData() {
    try {
        const response = await fetch('default_routine.tsv'); // Path to the .tsv file
        const text = await response.text();
        const rows = text.trim().split('\n');

        rows.forEach((row, i) => {
            const [label, rest, hang] = row.split('\t');

            // Check if there's an input row available, otherwise create one
            if (document.getElementById(`inputRow${i + 1}`)) {
                document.getElementById(`inputRow${i + 1}`).children[0].value = label || "";
                document.getElementById(`inputRow${i + 1}`).children[1].value = rest || "0";
                document.getElementById(`inputRow${i + 1}`).children[2].value = hang || "0";
            } else {
                // Clone and populate new rows if there are more entries than initially generated rows
                const newRow = document.getElementById('inputRowTemplate').cloneNode(true);
                newRow.id = `inputRow${i + 1}`;
                newRow.children[0].value = label || "";
                newRow.children[1].value = rest || "0";
                newRow.children[2].value = hang || "0";
                document.getElementById('routine-setup').appendChild(newRow);
            }
        });
    } catch (error) {
        console.error("Error loading default data:", error);
    }
    initializeRoutine();
}

// Set initial tab to "Main" when the page loads
window.addEventListener('load', () => {
    loadDefaultData();
    openTab('main');
});

// Toggle between "Setup" and "Main" tabs
const toggleEditButton = document.getElementById('edit-button');
toggleEditButton.addEventListener('click', () => {
    const setupTab = document.getElementById('setup');
    const mainTab = document.getElementById('main');
    setupTab.style.display = 'block';
    mainTab.style.display = 'none';
});

const toggleEditButton2 = document.getElementById('back-button');
toggleEditButton2.addEventListener('click', () => {
    const setupTab = document.getElementById('setup');
    const mainTab = document.getElementById('main');
    setupTab.style.display = 'none';
    mainTab.style.display = 'block';
    initializeRoutine();
});

// Function to calculate and display estimated completion time
function updateEstimatedCompletionTime() {
    const currentTime = new Date();
    let totalDurationInSeconds = 0;

    // Calculate total duration from remaining rest and hang times
    const rows = document.querySelectorAll('#routine-setup .input-row');
    rows.forEach((row, index) => {
        if (index < currentIndex) {
            // Skip rows that have already completed
            return;
        }

        const restTime = parseInt(row.children[1].value) || 0;
        const hangTime = parseInt(row.children[2].value) || 0;
        totalDurationInSeconds += restTime + hangTime;
    });
    console.log(currentTime);

    // Calculate the estimated completion time
    const completionTime = new Date(currentTime.getTime() + totalDurationInSeconds * 1000);
    console.log(completionTime);

    // Format the completion time as HH:MM AM/PM
    const hours = completionTime.getHours();
    const minutes = completionTime.getMinutes().toString().padStart(2, '0');
    const seconds = completionTime.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedTime = `routine will finish at ${(hours % 12) || 12}:${minutes}:${seconds} ${ampm}`;


    // Display the formatted time
    document.getElementById('completionTime').textContent = formattedTime;
}

document.addEventListener('DOMContentLoaded', function () {
    const toggleLinks = document.querySelectorAll('.text-toggle');

    toggleLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent the link from navigating
            // const triangle = this.querySelector('.triangle-css');
            const content = document.getElementById('grips-container');
            link.textContent = link.textContent === 'show grips ▼' ? 'hide grips ▲' : 'show grips ▼';

            // triangle.classList.toggle('rotated');
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        });
    });
});
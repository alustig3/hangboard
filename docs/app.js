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
const setupLabels = [];
for (let i = 1; i <= 10; i++) {
    const row = document.getElementById('inputRowTemplate').cloneNode(true);
    row.id = `inputRow${i}`;
    
    // Set default values for rest (10s) and hang (5s)
    row.children[0].value = "jake";
    row.children[1].value = 2;
    row.children[2].value = 3;

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

    for (let i = 0; i < 10; i++) {
        // Retrieve the label text directly from the input field each time
        const setupLabelText = document.getElementById(`inputRow${i + 1}`).children[0].value;

        const setupLabel = document.createElement('div');
        setupLabel.classList.add('label-item');
        setupLabel.textContent = setupLabelText || "Label"; // Use "Label" as a fallback
        setupLabel.id = `setupLabel${i + 1}`;
        setupLabelsContainer.appendChild(setupLabel);

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
    const setupLabel = document.getElementById(`setupLabel${index + 1}`); // Corresponding setup label
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

            // Apply strikethrough to setup label only after the hang phase completes
            if (phase === 'hang') {
                setupLabel.classList.add('completed-label');
            }

            if (phase === 'rest') {
                startRoutine(index, 'hang');
            } else {
                startRoutine(index + 1, 'rest');
            }
        }
    }, 100);
}

// Export Setup Data Button

// Export Setup Data Button
document.getElementById('exportData').addEventListener('click', () => {
    const rows = [];
    
    for (let i = 1; i <= 10; i++) {
        const label = document.getElementById(`inputRow${i}`).children[0].value || "Label";
        const rest = document.getElementById(`inputRow${i}`).children[1].value || "0";
        const hang = document.getElementById(`inputRow${i}`).children[2].value || "0";
        
        rows.push(`${label}\t${rest}\t${hang}`);
    }

    const exportData = rows.join('\n');
    
    navigator.clipboard.writeText(exportData).then(() => {
        alert("Exported data has been copied to the clipboard!");
    }).catch(err => {
        console.error("Could not copy text: ", err);
    });
});

// Import Setup Data Button
document.getElementById('importData').addEventListener('click', () => {
    const dataInput = document.getElementById('dataInput');
    dataInput.style.display = dataInput.style.display === 'none' ? 'block' : 'none';
});

// Load Data from Pasted String
document.getElementById('dataInput').addEventListener('input', () => {
    const data = document.getElementById('dataInput').value.trim();
    const rows = data.split('\n');

    rows.forEach((row, i) => {
        const [label, rest, hang] = row.split('\t');

        if (document.getElementById(`inputRow${i + 1}`)) {
            document.getElementById(`inputRow${i + 1}`).children[0].value = label || "";
            document.getElementById(`inputRow${i + 1}`).children[1].value = rest || "0";
            document.getElementById(`inputRow${i + 1}`).children[2].value = hang || "0";
        }
    });

    alert("Imported data successfully!");
    document.getElementById('dataInput').style.display = 'none'; // Hide textarea after importing
});

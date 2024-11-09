// Set up tabs for Setup and Main
function openTab(tabName) {
    document.getElementById('setup').style.display = tabName === 'setup' ? 'block' : 'none';
    document.getElementById('main').style.display = tabName === 'main' ? 'block' : 'none';
}

// Dynamically generate 10 rows in Setup
for (let i = 1; i <= 10; i++) {
    const row = document.getElementById('inputRowTemplate').cloneNode(true);
    row.id = `inputRow${i}`;
    document.getElementById('routine-setup').appendChild(row);
}
document.getElementById('inputRowTemplate').remove();

// Create progress bars in the Main tab based on Setup inputs
function initializeRoutine() {
    const progressContainer = document.getElementById('routine-progress');
    progressContainer.innerHTML = '';  // Clear previous bars

    for (let i = 1; i <= 10; i++) {
        const greenBar = document.createElement('div');
        const yellowBar = document.createElement('div');
        greenBar.classList.add('progress-bar', 'green');
        yellowBar.classList.add('progress-bar', 'yellow');
        greenBar.id = `hangBar${i}`;
        yellowBar.id = `restBar${i}`;

        const barContainer = document.createElement('div');
        barContainer.classList.add('progress-bar-container');
        barContainer.appendChild(greenBar);
        barContainer.appendChild(yellowBar);

        progressContainer.appendChild(barContainer);
    }
}

// Start Routine button behavior
document.getElementById('startRoutine').addEventListener('click', () => {
    initializeRoutine();
    startRoutine(1, 'hang');
});

// Function to run each bar sequence in order
function startRoutine(index, phase) {
    const hangDuration = parseInt(document.getElementById(`inputRow${index}`).children[1].value) * 1000;
    const restDuration = parseInt(document.getElementById(`inputRow${index}`).children[2].value) * 1000;
    const bar = document.getElementById(`${phase === 'hang' ? 'hangBar' : 'restBar'}${index}`);

    let duration = phase === 'hang' ? hangDuration : restDuration;
    let height = 0;

    const interval = setInterval(() => {
        height += 100 / (duration / 100);
        bar.style.width = `${height}%`;

        if (height >= 100) {
            clearInterval(interval);
            bar.classList.remove(phase === 'hang' ? 'green' : 'yellow');
            bar.classList.add('grey');
            
            if (phase === 'hang') {
                startRoutine(index, 'rest');
            } else if (index < 10) {
                startRoutine(index + 1, 'hang');
            }
        }
    }, 100);
}

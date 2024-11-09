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
        restLabel.classList.add('label-item', 'grey');
        restLabel.textContent = restDurations[i].value + 's';
        restLabel.id = `restLabel${i + 1}`;
        restLabels.appendChild(restLabel);

        const hangLabel = document.createElement('div');
        hangLabel.classList.add('label-item', 'grey');
        hangLabel.textContent = hangDurations[i].value + 's';
        hangLabel.id = `hangLabel${i + 1}`;
        hangLabels.appendChild(hangLabel);
    }
}

// Start Routine button behavior
document.getElementById('startRoutine').addEventListener('click', () => {
    initializeRoutine();
    startRoutine(0, 'rest');
});

// Function to run the routine with alternating rest and hang
function startRoutine(index, phase) {
    if (index >= 10) return;

    const restTime = parseInt(restDurations[index].value) * 1000;
    const hangTime = parseInt(hangDurations[index].value) * 1000;
    const bar = document.getElementById('progressBar');
    const label = document.getElementById(`${phase}Label${index + 1}`);

    let duration = phase === 'rest' ? restTime : hangTime;
    let increment = 100 / (duration / 100);
    let height = phase === 'rest' ? 0 : 100;
    let color = phase === 'rest' ? 'yellow' : 'green';
    let highlightClass = phase === 'rest' ? 'highlight-yellow' : 'highlight-green';

    bar.className = `progress-bar ${color}`;
    label.classList.add(highlightClass);

    const interval = setInterval(() => {
        height += (phase === 'rest' ? increment : -increment);
        bar.style.height = `${height}%`;

        if ((phase === 'rest' && height >= 100) || (phase === 'hang' && height <= 0)) {
            clearInterval(interval);
            bar.classList.add('grey');
            label.classList.remove(highlightClass);
            label.classList.add('grey');

            if (phase === 'rest') {
                startRoutine(index, 'hang');
            } else {
                startRoutine(index + 1, 'rest');
            }
        }
    }, 100);
}

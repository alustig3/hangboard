let timer;
let duration;
let progressInterval;

document.getElementById('start').addEventListener('click', () => {
    const seconds = parseInt(document.getElementById('timeInput').value);
    if (isNaN(seconds) || seconds <= 0) {
        alert("Please enter a valid number of seconds.");
        return;
    }

    duration = seconds;
    let startTime = Date.now();
    let endTime = startTime + duration * 1000;
    clearInterval(progressInterval);

    // Update the time label at the start
    document.getElementById('timeLabel').textContent = `${duration}s`;

    progressInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const remaining = Math.max(Math.ceil((endTime - now) / 1000), 0);
        const percentage = Math.min((elapsed / (duration * 1000)) * 100, 100);

        // Update the progress bar height
        document.getElementById('progressBar').style.height = `${percentage}%`;

        // Update the time label
        document.getElementById('timeLabel').textContent = `${remaining}s`;

        // Stop the timer when it reaches 100%
        if (now >= endTime) {
            clearInterval(progressInterval);
        }
    }, 100);
});

document.getElementById('stop').addEventListener('click', () => {
    clearInterval(progressInterval);
    document.getElementById('progressBar').style.height = '0';
    document.getElementById('timeLabel').textContent = '0s';
});
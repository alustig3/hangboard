let timer1, timer2;
let duration1, duration2;
let progressInterval1, progressInterval2;

function startTimer(inputId, labelId, progressBarId, intervalVar, durationVar) {
    const seconds = parseInt(document.getElementById(inputId).value);
    if (isNaN(seconds) || seconds <= 0) {
        alert("Please enter a valid number of seconds.");
        return;
    }

    durationVar = seconds;
    let startTime = Date.now();
    let endTime = startTime + durationVar * 1000;
    clearInterval(intervalVar);

    // Update the time label at the start
    document.getElementById(labelId).textContent = `${durationVar}s`;

    intervalVar = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const remaining = Math.max(Math.ceil((endTime - now) / 1000), 0);
        const percentage = Math.min((elapsed / (durationVar * 1000)) * 100, 100);

        // Update the progress bar height
        document.getElementById(progressBarId).style.height = `${percentage}%`;

        // Update the time label
        document.getElementById(labelId).textContent = `${remaining}s`;

        // Stop the timer when it reaches 100%
        if (now >= endTime) {
            clearInterval(intervalVar);
        }
    }, 100);

    // Save interval and duration variables for stopping
    if (inputId === "timeInput1") {
        progressInterval1 = intervalVar;
        duration1 = durationVar;
    } else {
        progressInterval2 = intervalVar;
        duration2 = durationVar;
    }
}

function stopTimer(progressBarId, labelId, intervalVar) {
    clearInterval(intervalVar);
    document.getElementById(progressBarId).style.height = '0';
    document.getElementById(labelId).textContent = '0s';
}

// Start and Stop for Timer 1
document.getElementById('start1').addEventListener('click', () => {
    startTimer('timeInput1', 'timeLabel1', 'progressBar1', progressInterval1, duration1);
});

document.getElementById('stop1').addEventListener('click', () => {
    stopTimer('progressBar1', 'timeLabel1', progressInterval1);
});

// Start and Stop for Timer 2
document.getElementById('start2').addEventListener('click', () => {
    startTimer('timeInput2', 'timeLabel2', 'progressBar2', progressInterval2, duration2);
});

document.getElementById('stop2').addEventListener('click', () => {
    stopTimer('progressBar2', 'timeLabel2', progressInterval2);
});
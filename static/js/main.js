Telegram.WebApp.ready();

const startBtn = document.getElementById('start_btn');
const slider = document.getElementById('timeout_slider');
const sliderValue = document.getElementById('slider_value');
const progressBar = document.getElementById('progress_bar');
const pingOutput = document.getElementById('ping_output');
const downloadOutput = document.getElementById('download_output');
const uploadOutput = document.getElementById('upload_output');
const clientInfoOutput = document.getElementById('client_info_output');
const serverInfoOutput = document.getElementById('server_info_output');
const networkInfoOutput = document.getElementById('network_info_output');
const logOutput = document.getElementById('log_output');

let clientInfo = '';

const log = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.textContent += `[${timestamp}] ${message}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
};

const formatSpeed = (speedBps) => {
    if (speedBps < 1e6) {
        return `${(speedBps / 1e3).toFixed(2)} Kbps`;
    }
    return `${(speedBps / 1e6).toFixed(2)} Mbps`;
};

const updateProgressBar = (percentage) => {
    progressBar.style.width = `${percentage}%`;
};

const getGeoInfo = async () => {
    log('Fetching geo information...');
    try {
        const response = await fetch('/get_geo_info');
        const data = await response.json();
        clientInfo = `${data.user.city}, ${data.user.country} (IP: ${data.user.ip})`;
        clientInfoOutput.textContent = clientInfo;
        serverInfoOutput.textContent = `${data.server.city}, ${data.server.country} (IP: ${data.server.ip})`;
        log('Geo information loaded.');
    } catch (error) {
        clientInfoOutput.textContent = 'Could not determine location';
        serverInfoOutput.textContent = 'Could not determine location';
        log('Error fetching geo info: ' + error);
    }
};

const getNetworkInfo = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
        const type = connection.effectiveType;
        networkInfoOutput.textContent = `~${type.charAt(0).toUpperCase() + type.slice(1)}`;
    } else {
        networkInfoOutput.textContent = 'Unknown';
    }
};

const runPingTest = async () => {
    log('Starting ping test...');
    pingOutput.textContent = 'Testing...';
    const latencies = [];
    const testCount = 5;
    for (let i = 0; i < testCount; i++) {
        const startTime = Date.now();
        try {
            await fetch('/ping', { cache: 'no-store' });
            const latency = Date.now() - startTime;
            latencies.push(latency);
            log(`Ping ${i + 1}/${testCount}: ${latency} ms`);
        } catch (error) {
            log('Ping test failed: ' + error);
            pingOutput.textContent = 'Error';
            return null;
        }
    }
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    pingOutput.innerHTML = `${Math.round(avgLatency)} <small>ms</small>`;
    log(`Ping test finished. Average latency: ${avgLatency.toFixed(2)} ms`);
    return avgLatency.toFixed(2);
};

const runDownloadTest = async (duration) => {
    log(`Starting download test for ${duration} seconds...`);
    downloadOutput.textContent = 'Testing...';
    let totalBytes = 0;
    const startTime = Date.now();
    const testEndTime = startTime + duration * 1000;

    const download = async () => {
        try {
            const response = await fetch('/download?size=4194304', { cache: 'no-store' });
            const reader = response.body.getReader();
            while (Date.now() < testEndTime) {
                const { done, value } = await reader.read();
                if (done) break;
                totalBytes += value.length;
                const elapsed = (Date.now() - startTime) / 1000;
                const speedBps = (totalBytes * 8) / elapsed;
                downloadOutput.innerHTML = `${formatSpeed(speedBps)} <small>Mbps</small>`;
            }
        } catch (error) {
            log('Download test error: ' + error);
        }
    };

    const streams = Array(4).fill(null).map(download);
    await Promise.all(streams);

    const totalElapsed = (Date.now() - startTime) / 1000;
    const finalSpeedBps = (totalBytes * 8) / totalElapsed;
    downloadOutput.innerHTML = `${formatSpeed(finalSpeedBps)} <small>Mbps</small>`;
    log(`Download test finished. Speed: ${formatSpeed(finalSpeedBps)}`);
    return formatSpeed(finalSpeedBps);
};

const runUploadTest = async (duration) => {
    log(`Starting upload test for ${duration} seconds...`);
    uploadOutput.textContent = 'Testing...';
    let totalBytes = 0;
    const startTime = Date.now();
    const testEndTime = startTime + duration * 1000;
    const chunkSize = 1024 * 1024;
    const chunk = new Uint8Array(chunkSize).fill(0);

    const upload = async () => {
        while (Date.now() < testEndTime) {
            try {
                await fetch('/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: chunk
                });
                totalBytes += chunkSize;
                const elapsed = (Date.now() - startTime) / 1000;
                const speedBps = (totalBytes * 8) / elapsed;
                uploadOutput.innerHTML = `${formatSpeed(speedBps)} <small>Mbps</small>`;
            } catch (error) {
                log('Upload test error: ' + error);
                break;
            }
        }
    };

    const streams = Array(4).fill(null).map(upload);
    await Promise.all(streams);

    const totalElapsed = (Date.now() - startTime) / 1000;
    const finalSpeedBps = (totalBytes * 8) / totalElapsed;
    uploadOutput.innerHTML = `${formatSpeed(finalSpeedBps)} <small>Mbps</small>`;
    log(`Upload test finished. Speed: ${formatSpeed(finalSpeedBps)}`);
    return formatSpeed(finalSpeedBps);
};

const runTest = async () => {
    startBtn.disabled = true;
    logOutput.textContent = '';
    log('Starting new speed test...');

    const testDuration = parseInt(slider.value, 10);
    const totalSteps = 3;
    let currentStep = 0;

    [pingOutput, downloadOutput, uploadOutput].forEach(el => el.textContent = '-');
    updateProgressBar(0);

    currentStep++;
    const pingResult = await runPingTest();
    updateProgressBar((currentStep / totalSteps) * 100);
    if (pingResult === null) {
        log('Test aborted due to ping failure.');
        startBtn.disabled = false;
        return;
    }

    currentStep++;
    const downloadResult = await runDownloadTest(testDuration);
    updateProgressBar((currentStep / totalSteps) * 100);

    currentStep++;
    const uploadResult = await runUploadTest(testDuration);
    updateProgressBar((currentStep / totalSteps) * 100);

    log('All tests completed.');
    startBtn.disabled = false;

    try {
        await fetch('/log_results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ping: `${pingResult} ms`,
                download: downloadResult,
                upload: uploadResult,
                clientInfo: clientInfo,
                fullLog: logOutput.textContent
            })
        });
        log('Results successfully logged on the server.');
    } catch (error) {
        log('Failed to log results to server: ' + error);
    }
};

startBtn.addEventListener('click', runTest);
slider.addEventListener('input', () => {
    sliderValue.textContent = slider.value;
});

document.addEventListener('DOMContentLoaded', () => {
    getGeoInfo();
    getNetworkInfo();
    log('Application initialized. Click "Start" to begin.');
});

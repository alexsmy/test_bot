Telegram.WebApp.ready();
Telegram.WebApp.expand();

const startBtn = document.getElementById('start_btn');
const startText = document.getElementById('start_text');
const progressBar = document.getElementById('progress_bar');

const pingOutput = document.getElementById('ping_output');
const downloadOutput = document.getElementById('download_output');
const uploadOutput = document.getElementById('upload_output');

const pingProgress = document.getElementById('ping_progress');
const downloadProgress = document.getElementById('download_progress');
const uploadProgress = document.getElementById('upload_progress');

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

const formatSpeed = (speedBps, unit = 'Mbps') => {
    if (unit === 'Kbps') {
        return (speedBps / 1e3).toFixed(2);
    }
    return (speedBps / 1e6).toFixed(2);
};

const updateProgressBar = (percentage) => {
    progressBar.style.width = `${percentage}%`;
};

const updateResultBar = (element, value, type) => {
    let percentage = 0;
    let color = 'var(--red)';

    if (type === 'ping') {
        // Чем ниже, тем лучше. Максимум для шкалы ~300ms
        percentage = Math.min(100, 100 - (value / 300) * 100);
        if (value < 50) color = 'var(--green)';
        else if (value < 150) color = 'var(--yellow)';
    } else { // download/upload
        // Чем выше, тем лучше. Максимум для шкалы ~100Mbps
        const speedMbps = value / 1e6;
        percentage = Math.min(100, (speedMbps / 100) * 100);
        if (speedMbps > 10) color = 'var(--green)';
        else if (speedMbps > 1) color = 'var(--yellow)';
    }
    
    element.style.width = `${percentage}%`;
    element.style.backgroundColor = color;
};


const getGeoInfo = async () => {
    try {
        const response = await fetch('/get_geo_info');
        const data = await response.json();
        clientInfo = `${data.user.city}, ${data.user.country} (IP: ${data.user.ip})`;
        clientInfoOutput.textContent = `${data.user.city}, ${data.user.country}`;
        serverInfoOutput.textContent = `${data.server.city}, ${data.server.country}`;
    } catch (error) {
        clientInfoOutput.textContent = 'Недоступно';
        serverInfoOutput.textContent = 'Недоступно';
    }
};

const getNetworkInfo = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
        networkInfoOutput.textContent = `~${connection.effectiveType}`;
    } else {
        networkInfoOutput.textContent = 'Неизвестно';
    }
};

const runPingTest = async () => {
    log('Starting ping test...');
    startText.textContent = 'Измерение пинга...';
    const latencies = [];
    const testCount = 5;
    for (let i = 0; i < testCount; i++) {
        const startTime = Date.now();
        try {
            await fetch('/ping', { cache: 'no-store' });
            const latency = Date.now() - startTime;
            latencies.push(latency);
            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            pingOutput.textContent = `${Math.round(avgLatency)} ms`;
            updateResultBar(pingProgress, avgLatency, 'ping');
        } catch (error) {
            log('Ping test failed: ' + error);
            pingOutput.textContent = 'Error';
            return null;
        }
    }
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    log(`Ping test finished. Average latency: ${avgLatency.toFixed(2)} ms`);
    return avgLatency.toFixed(2);
};

const runDownloadTest = async (duration) => {
    log(`Starting download test for ${duration} seconds...`);
    startText.textContent = 'Измерение загрузки...';
    let totalBytes = 0;
    const startTime = Date.now();
    const testEndTime = startTime + duration * 1000;

    const download = async () => {
        try {
            const response = await fetch('/download?size=8388608', { cache: 'no-store' });
            const reader = response.body.getReader();
            while (Date.now() < testEndTime) {
                const { done, value } = await reader.read();
                if (done) break;
                totalBytes += value.length;
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 0) {
                    const speedBps = (totalBytes * 8) / elapsed;
                    downloadOutput.textContent = `${formatSpeed(speedBps)} Mbps`;
                    updateResultBar(downloadProgress, speedBps, 'download');
                }
            }
        } catch (error) {
            log('Download test error: ' + error);
        }
    };

    const streams = Array(4).fill(null).map(download);
    await Promise.all(streams);

    const totalElapsed = (Date.now() - startTime) / 1000;
    const finalSpeedBps = totalElapsed > 0 ? (totalBytes * 8) / totalElapsed : 0;
    log(`Download test finished. Speed: ${formatSpeed(finalSpeedBps)} Mbps`);
    return `${formatSpeed(finalSpeedBps)} Mbps`;
};

const runUploadTest = async (duration) => {
    log(`Starting upload test for ${duration} seconds...`);
    startText.textContent = 'Измерение отправки...';
    let totalBytes = 0;
    const startTime = Date.now();
    const testEndTime = startTime + duration * 1000;
    const chunkSize = 1024 * 256; // 256KB
    const chunk = new Uint8Array(chunkSize).fill(0);

    const upload = async () => {
        while (Date.now() < testEndTime) {
            try {
                await fetch('/upload', {
                    method: 'POST',
                    body: chunk
                });
                totalBytes += chunkSize;
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 0) {
                    const speedBps = (totalBytes * 8) / elapsed;
                    uploadOutput.textContent = `${formatSpeed(speedBps)} Mbps`;
                    updateResultBar(uploadProgress, speedBps, 'upload');
                }
            } catch (error) {
                log('Upload test error: ' + error);
                break;
            }
        }
    };

    const streams = Array(4).fill(null).map(upload);
    await Promise.all(streams);

    const totalElapsed = (Date.now() - startTime) / 1000;
    const finalSpeedBps = totalElapsed > 0 ? (totalBytes * 8) / totalElapsed : 0;
    log(`Upload test finished. Speed: ${formatSpeed(finalSpeedBps)} Mbps`);
    return `${formatSpeed(finalSpeedBps)} Mbps`;
};

const runTest = async () => {
    startBtn.disabled = true;
    startBtn.innerHTML = '...';
    logOutput.textContent = '';
    log('Starting new speed test...');

    const testDuration = 12; // Фиксированное время для лучшего UX
    const totalSteps = 3;
    let currentStep = 0;

    // Сброс UI
    [pingOutput, downloadOutput, uploadOutput].forEach(el => el.textContent = '-');
    [pingProgress, downloadProgress, uploadProgress].forEach(el => {
        el.style.width = '0%';
        el.style.backgroundColor = 'var(--red)';
    });
    updateProgressBar(0);

    currentStep++;
    const pingResult = await runPingTest();
    updateProgressBar((currentStep / totalSteps) * 100);
    if (pingResult === null) {
        log('Test aborted due to ping failure.');
        startBtn.disabled = false;
        startBtn.innerHTML = '🚀';
        startText.textContent = 'Ошибка. Попробовать снова?';
        return;
    }

    currentStep++;
    const downloadResult = await runDownloadTest(testDuration);
    updateProgressBar((currentStep / totalSteps) * 100);

    currentStep++;
    const uploadResult = await runUploadTest(testDuration);
    updateProgressBar((currentStep / totalSteps) * 100);

    log('All tests completed.');
    startText.textContent = 'Тест завершен!';
    startBtn.innerHTML = '✅';

    const results = {
        ping: `${Math.round(pingResult)} ms`,
        download: downloadResult,
        upload: uploadResult,
    };

    // Отправляем данные в бот
    try {
        Telegram.WebApp.sendData(JSON.stringify(results));
        log('Results sent to Telegram bot.');
    } catch (error) {
        log('Failed to send results to bot: ' + error);
    }
    
    // Логируем на сервер (опционально)
    try {
        await fetch('/log_results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...results,
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

document.addEventListener('DOMContentLoaded', () => {
    getGeoInfo();
    getNetworkInfo();
});

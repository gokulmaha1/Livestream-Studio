const socket = io();

let currentStreamSession = null;
let currentView = 'dashboard';
let uptimeInterval = null;
let streamStartTime = null;
let mediaRecorder = null;
let streamTracks = null;

const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const viewTitle = document.getElementById('viewTitle');
const startStopBtn = document.getElementById('startStopBtn');
const statusIndicator = document.getElementById('statusIndicator');
const uptimeElement = document.getElementById('uptime');
const fpsValue = document.getElementById('fpsValue');
const bitrateValue = document.getElementById('bitrateValue');
const streamConfigForm = document.getElementById('streamConfigForm');
const streamKeyInput = document.getElementById('streamKey');
const resolutionSelect = document.getElementById('resolution');
const framerateSelect = document.getElementById('framerate');
const bitrateSelect = document.getElementById('bitrate');
const presetSelect = document.getElementById('preset');
const createOverlayBtn = document.getElementById('createOverlayBtn');
const overlayEditorModal = document.getElementById('overlayEditorModal');
const closeOverlayEditor = document.getElementById('closeOverlayEditor');
const htmlEditor = document.getElementById('htmlEditor');
const cssEditor = document.getElementById('cssEditor');
const jsEditor = document.getElementById('jsEditor');
const overlayPreview = document.getElementById('overlayPreview');
const saveOverlayBtn = document.getElementById('saveOverlay');
const overlaysGrid = document.getElementById('overlaysGrid');

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initStreamControls();
    initOverlayEditor();
    initMediaLibrary();
    loadSavedConfig();
    loadOverlays();
    initPreviewCanvas();
});

// Navigation
function initNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.dataset.view);
            if (item.dataset.view === 'media') loadMedia();
        });
    });
}

function switchView(viewName) {
    navItems.forEach(item => item.classList.toggle('active', item.dataset.view === viewName));
    views.forEach(view => view.classList.toggle('active', view.id === `${viewName}View`));
    const titles = { dashboard: 'Dashboard', stream: 'Stream Settings', overlays: 'HTML Overlays', media: 'Media Library', scenes: 'Scenes' };
    viewTitle.textContent = titles[viewName] || viewName;
    currentView = viewName;
}

// Stream Controls
function initStreamControls() {
    startStopBtn.addEventListener('click', () => currentStreamSession ? stopStream() : startStream());
    streamConfigForm.addEventListener('submit', (e) => { e.preventDefault(); saveStreamConfig(); });
}

async function startStream() {
    try {
        const config = getStreamConfig();
        if (!config.streamKey) { showToast('Please configure your stream key first', 'error'); switchView('stream'); return; }

        startStopBtn.disabled = true;
        startStopBtn.textContent = 'Starting server renderer...';

        // Start Backend Stream (which now uses Puppeteer)
        const response = await fetch('/api/stream/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
        const data = await response.json();

        if (data.success) {
            currentStreamSession = data.sessionId;
            streamStartTime = Date.now();
            socket.emit('join-stream', currentStreamSession);

            updateStreamStatus('live');
            startStopBtn.textContent = 'Stop Stream';
            startStopBtn.classList.remove('btn-primary');
            startStopBtn.classList.add('btn-secondary');
            startUptimeCounter();
            showToast('Stream started! Server is rendering content.', 'success');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showToast(`Failed to start stream: ${error.message}`, 'error');
        startStopBtn.disabled = false;
        startStopBtn.textContent = 'Start Stream';
    }
}

async function stopStream() {
    if (!currentStreamSession) return;
    try {
        startStopBtn.disabled = true;
        startStopBtn.textContent = 'Stopping...';
        const response = await fetch(`/api/stream/stop/${currentStreamSession}`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            socket.emit('leave-stream', currentStreamSession);
            currentStreamSession = null;
            streamStartTime = null;
            updateStreamStatus('offline');
            startStopBtn.textContent = 'Start Stream';
            startStopBtn.classList.remove('btn-secondary');
            startStopBtn.classList.add('btn-primary');
            stopUptimeCounter();
            showToast('Stream stopped', 'success');
        }
    } catch (error) { showToast(`Failed to stop stream: ${error.message}`, 'error'); }
    finally { startStopBtn.disabled = false; }
}

function updateStreamStatus(status) {
    const dot = statusIndicator.querySelector('.dot');
    const text = statusIndicator.querySelector('.text');
    if (status === 'live') { dot.classList.remove('offline'); dot.classList.add('live'); text.textContent = 'Live'; }
    else { dot.classList.remove('live'); dot.classList.add('offline'); text.textContent = 'Offline'; }
    document.getElementById('streamStatus').textContent = status === 'live' ? 'Streaming' : 'Not streaming';
}

function startUptimeCounter() {
    if (uptimeInterval) clearInterval(uptimeInterval);
    uptimeInterval = setInterval(() => {
        if (streamStartTime) {
            const s = Math.floor((Date.now() - streamStartTime) / 1000);
            uptimeElement.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
        }
    }, 1000);
}

function stopUptimeCounter() { if (uptimeInterval) { clearInterval(uptimeInterval); uptimeInterval = null; } uptimeElement.textContent = '00:00:00'; }
function pad(n) { return n.toString().padStart(2, '0'); }

// Config
function getStreamConfig() {
    return {
        streamKey: streamKeyInput.value || localStorage.getItem('streamKey') || '',
        resolution: resolutionSelect.value,
        framerate: parseInt(framerateSelect.value),
        bitrate: bitrateSelect.value,
        preset: presetSelect.value
    };
}

function saveStreamConfig() {
    const config = getStreamConfig();
    if (config.streamKey) localStorage.setItem('streamKey', config.streamKey);
    localStorage.setItem('streamConfig', JSON.stringify(config));
    document.getElementById('resolutionInfo').textContent = config.resolution;
    document.getElementById('framerateInfo').textContent = `${config.framerate} fps`;
    document.getElementById('bitrateInfo').textContent = `${config.bitrate.replace('k', '')} kbps`;
    showToast('Configuration saved successfully', 'success');
}

function loadSavedConfig() {
    const saved = localStorage.getItem('streamConfig');
    const savedKey = localStorage.getItem('streamKey');
    if (saved) { try { const c = JSON.parse(saved); if (c.resolution) resolutionSelect.value = c.resolution; if (c.framerate) framerateSelect.value = c.framerate; if (c.bitrate) bitrateSelect.value = c.bitrate; if (c.preset) presetSelect.value = c.preset; } catch (e) { } }
    if (savedKey) streamKeyInput.value = savedKey;
}

// Overlay Editor
function initOverlayEditor() {
    createOverlayBtn.addEventListener('click', () => openOverlayEditor());
    closeOverlayEditor.addEventListener('click', () => overlayEditorModal.classList.remove('active'));
    saveOverlayBtn.addEventListener('click', saveOverlay);
    document.getElementById('cancelOverlay').addEventListener('click', () => overlayEditorModal.classList.remove('active'));

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.code-input').forEach(e => { e.classList.remove('active'); if (e.id === `${tab.dataset.tab}Editor`) e.classList.add('active'); });
        });
    });

    document.getElementById('refreshPreview').addEventListener('click', updateOverlayPreview);
    let timeout;
    [htmlEditor, cssEditor, jsEditor].forEach(e => { e.addEventListener('input', () => { clearTimeout(timeout); timeout = setTimeout(updateOverlayPreview, 800); }); });

    // Website Embed Modal
    const websiteEmbedModal = document.getElementById('websiteEmbedModal');
    const websiteUrlInput = document.getElementById('websiteUrl');

    document.getElementById('embedWebsiteBtn').addEventListener('click', () => {
        websiteUrlInput.value = '';
        websiteEmbedModal.classList.add('active');
    });

    document.getElementById('closeWebsiteEmbed').addEventListener('click', () => websiteEmbedModal.classList.remove('active'));
    document.getElementById('cancelWebsiteEmbed').addEventListener('click', () => websiteEmbedModal.classList.remove('active'));

    document.getElementById('saveWebsiteEmbed').addEventListener('click', async () => {
        const url = websiteUrlInput.value.trim();
        if (!url) { showToast('Please enter a valid URL', 'error'); return; }

        // Generate Iframe Overlay
        const overlayData = {
            id: `overlay_${Date.now()}`,
            html: `<iframe src="${url}" width="100%" height="100%" frameborder="0" allow="autoplay; encrypted-media" style="width:100vw; height:100vh; border:none;"></iframe>`,
            css: 'body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }',
            js: '// Iframe Embed for ' + url
        };

        try {
            const response = await fetch('/api/overlay/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(overlayData) });
            const data = await response.json();
            if (data.success) {
                showToast('Website embedded successfully', 'success');
                websiteEmbedModal.classList.remove('active');
                loadOverlays();
            }
        } catch (error) { showToast('Failed to save embed', 'error'); }
    });
}

function openOverlayEditor(data = null) {
    if (data) { htmlEditor.value = data.html || ''; cssEditor.value = data.css || ''; jsEditor.value = data.js || ''; }
    else {
        htmlEditor.value = '<div class="overlay-container">\n  <h1>Stream Title</h1>\n  <div class="info">Your Name</div>\n</div>';
        cssEditor.value = '.overlay-container { font-family: Arial, sans-serif; padding: 20px; }\nh1 { color: #ffffff; font-size: 48px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); }\n.info { color: #ffaa00; font-size: 24px; }';
        jsEditor.value = '// Add your JavaScript here\nconsole.log("Overlay loaded");';
    }
    overlayEditorModal.classList.add('active');
    updateOverlayPreview();
}

function updateOverlayPreview() {
    const doc = `<!DOCTYPE html><html><head><style>body{margin:0;padding:0;background:transparent;}${cssEditor.value}</style></head><body>${htmlEditor.value}<script>${jsEditor.value}<\/script></body></html>`;
    overlayPreview.src = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
}

async function saveOverlay() {
    try {
        const overlayData = { id: `overlay_${Date.now()}`, html: htmlEditor.value, css: cssEditor.value, js: jsEditor.value };
        const response = await fetch('/api/overlay/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(overlayData) });
        const data = await response.json();
        if (data.success) { showToast('Overlay saved successfully', 'success'); overlayEditorModal.classList.remove('active'); loadOverlays(); }
    } catch (error) { showToast('Failed to save overlay', 'error'); }
}

async function loadOverlays() {
    try {
        const response = await fetch('/api/overlays');
        const data = await response.json();
        overlaysGrid.innerHTML = '';
        if (data.overlays.length === 0) { overlaysGrid.innerHTML = '<p style="color:var(--text-secondary)">No overlays yet. Create your first one!</p>'; return; }
        data.overlays.forEach(overlay => {
            const card = document.createElement('div');
            card.className = 'overlay-card';
            card.innerHTML = `<h4>Overlay</h4><p>Updated: ${new Date(overlay.updatedAt).toLocaleString()}</p><div class="actions"><button class="btn btn-small btn-primary" onclick="editOverlay('${overlay.id}')">Edit</button></div>`;
            overlaysGrid.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

async function editOverlay(id) {
    try { const r = await fetch(`/api/overlay/${id}`); openOverlayEditor(await r.json()); }
    catch (e) { showToast('Failed to load overlay', 'error'); }
}

// Preview Canvas
function initPreviewCanvas() {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1920; canvas.height = 1080;

    // Initial State
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#333'; ctx.font = '48px Arial'; ctx.textAlign = 'center';
    ctx.fillText('Waiting for stream...', canvas.width / 2, canvas.height / 2);

    socket.on('preview-frame', (base64Image) => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = 'data:image/jpeg;base64,' + base64Image;
    });
}

// Socket Events
socket.on('stream-stats', (stats) => { fpsValue.textContent = stats.fps || 0; bitrateValue.textContent = `${stats.bitrate || 0} kbps`; });
socket.on('stream-ended', () => { updateStreamStatus('offline'); currentStreamSession = null; stopUptimeCounter(); startStopBtn.textContent = 'Start Stream'; startStopBtn.classList.remove('btn-secondary'); startStopBtn.classList.add('btn-primary'); });
socket.on('stream-error', (data) => { showToast(`Stream error: ${data.error}`, 'error'); });

// Toast
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠';
    toast.innerHTML = `<span style="font-size:20px">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Quick actions
document.getElementById('addOverlayBtn').addEventListener('click', () => { switchView('overlays'); setTimeout(() => createOverlayBtn.click(), 100); });
document.getElementById('settingsBtn').addEventListener('click', () => switchView('stream'));

// Logs
const logsContent = document.getElementById('logsContent');
document.getElementById('clearLogsBtn').addEventListener('click', () => logsContent.innerHTML = '');

function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="timestamp">[${time}]</span>${message}`;
    logsContent.appendChild(entry);
    logsContent.scrollTop = logsContent.scrollHeight;
}

// Socket Events
socket.on('stream-stats', (stats) => { fpsValue.textContent = stats.fps || 0; bitrateValue.textContent = `${stats.bitrate || 0} kbps`; });
socket.on('stream-ended', () => {
    updateStreamStatus('offline');
    currentStreamSession = null;
    stopUptimeCounter();
    startStopBtn.textContent = 'Start Stream';
    startStopBtn.classList.remove('btn-secondary');
    startStopBtn.classList.add('btn-primary');
    addLog('Stream ended', 'warn');
});
socket.on('stream-error', (data) => {
    showToast(`Stream error: ${data.error}`, 'error');
    addLog(`Stream Error: ${data.error}`, 'error');
});
socket.on('server-log', (data) => {
    addLog(data.message, data.type);
});
const streamDesignerModal = document.getElementById('streamDesignerModal');
const designerCanvas = document.getElementById('designerCanvas');
const designerWorkspace = document.getElementById('designerWorkspace');
let selectedElement = null;
let designerScale = 1;
let isDragging = false;
let dragStartX, dragStartY, initialEleX, initialEleY;

function initStreamDesigner() {
    document.getElementById('openDesignerBtn').addEventListener('click', openDesigner);
    document.getElementById('closeStreamDesigner').addEventListener('click', () => streamDesignerModal.classList.remove('active'));

    // Tools
    document.getElementById('addTextBtn').addEventListener('click', () => addElement('text'));
    document.getElementById('addHtmlBtn').addEventListener('click', () => addElement('html'));
    // document.getElementById('addImageBtn').addEventListener('click', () => addElement('image')); // TODO: Media Library
    document.getElementById('deleteElementBtn').addEventListener('click', deleteSelected);

    // Canvas Helper
    window.addEventListener('resize', updateCanvasScale);

    // Properties
    const inputs = ['propContent', 'propX', 'propY', 'propWidth', 'propHeight', 'propColor', 'propFontSize', 'propZIndex'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateSelectedFromProps);
    });

    document.getElementById('saveSceneBtn').addEventListener('click', saveDesignerScene);
}

function openDesigner() {
    streamDesignerModal.classList.add('active');
    setTimeout(updateCanvasScale, 100);
}

function updateCanvasScale() {
    if (!streamDesignerModal.classList.contains('active')) return;
    const padding = 40;
    const availableWidth = designerWorkspace.clientWidth - padding;
    const availableHeight = designerWorkspace.clientHeight - padding;
    const scaleX = availableWidth / 1920;
    const scaleY = availableHeight / 1080;
    designerScale = Math.min(scaleX, scaleY);
    designerCanvas.style.transform = `scale(${designerScale})`;
}

function addElement(type) {
    const el = document.createElement('div');
    el.classList.add('stream-element');
    el.style.left = '100px';
    el.style.top = '100px';
    el.style.position = 'absolute';
    el.dataset.type = type;

    if (type === 'text') {
        el.innerText = 'New Text';
        el.style.fontSize = '48px';
        el.style.color = '#ffffff';
        el.style.fontFamily = 'Arial, sans-serif';
        el.style.whiteSpace = 'nowrap';
    }
    /* 
    else if (type === 'image') {
        const img = document.createElement('img');
        img.src = '/path/to/placeholder.png'; 
        el.appendChild(img);
    }
    */

    // Drag Logic
    el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectElement(el);
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialEleX = parseInt(el.style.left || 0);
        initialEleY = parseInt(el.style.top || 0);

        const moveHandler = (ev) => {
            if (!isDragging) return;
            const dx = (ev.clientX - dragStartX) / designerScale;
            const dy = (ev.clientY - dragStartY) / designerScale;
            el.style.left = `${initialEleX + dx}px`;
            el.style.top = `${initialEleY + dy}px`;
            updatePropsFromSelected();
        };

        const upHandler = () => {
            isDragging = false;
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };

        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    });

    designerCanvas.appendChild(el);
    selectElement(el);
}

function selectElement(el) {
    if (selectedElement) selectedElement.classList.remove('selected');
    selectedElement = el;
    el.classList.add('selected');
    updatePropsFromSelected();
}

function deleteSelected() {
    if (selectedElement) {
        selectedElement.remove();
        selectedElement = null;
    }
}

function updatePropsFromSelected() {
    if (!selectedElement) return;
    document.getElementById('propX').value = parseInt(selectedElement.style.left);
    document.getElementById('propY').value = parseInt(selectedElement.style.top);
    document.getElementById('propZIndex').value = selectedElement.style.zIndex || 0;

    if (selectedElement.dataset.type === 'text') {
        document.getElementById('propContent').value = selectedElement.innerText;
        document.getElementById('propFontSize').value = parseInt(selectedElement.style.fontSize);
        document.getElementById('propColor').value = rgbToHex(selectedElement.style.color);
    } else if (selectedElement.dataset.type === 'html') {
        document.getElementById('propContent').value = selectedElement.innerHTML;
    }
}

function updateSelectedFromProps() {
    if (!selectedElement) return;
    selectedElement.style.left = document.getElementById('propX').value + 'px';
    selectedElement.style.top = document.getElementById('propY').value + 'px';
    selectedElement.style.zIndex = document.getElementById('propZIndex').value;

    if (selectedElement.dataset.type === 'text') {
        selectedElement.innerText = document.getElementById('propContent').value;
        selectedElement.style.fontSize = document.getElementById('propFontSize').value + 'px';
        selectedElement.style.color = document.getElementById('propColor').value;
    } else if (selectedElement.dataset.type === 'html') {
        selectedElement.innerHTML = document.getElementById('propContent').value;
    }
}

function rgbToHex(rgb) {
    if (!rgb) return '#ffffff';
    if (rgb.startsWith('#')) return rgb;
    const sep = rgb.indexOf(',') > -1 ? ',' : ' ';
    const rgbArr = rgb.substr(4).split(')')[0].split(sep);
    let r = (+rgbArr[0]).toString(16), g = (+rgbArr[1]).toString(16), b = (+rgbArr[2]).toString(16);
    if (r.length == 1) r = "0" + r; if (g.length == 1) g = "0" + g; if (b.length == 1) b = "0" + b;
    return "#" + r + g + b;
}

async function saveDesignerScene() {
    // Generate HTML from Canvas
    // We clone the canvas, remove UI helpers (selection), and get innerHTML
    const clone = designerCanvas.cloneNode(true);
    clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

    const html = clone.innerHTML;
    const css = '.stream-element { position: absolute; }'; // Basic CSS

    const overlayData = {
        id: `scene_${Date.now()}`,
        html: html,
        css: css,
        js: '// Visual Designer Scene'
    };

    try {
        const response = await fetch('/api/overlay/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(overlayData) });
        const data = await response.json();
        if (data.success) { showToast('Scene saved successfully', 'success'); loadOverlays(); }
    } catch (e) { showToast('Failed to save scene', 'error'); }
}

// Initialize
initStreamDesigner();

// --- Media Library Logic ---
const mediaUploadInput = document.getElementById('mediaUploadInput');
const mediaGrid = document.getElementById('mediaGrid');
const mediaSelectorModal = document.getElementById('mediaSelectorModal');
const selectorGrid = document.getElementById('selectorGrid');
let onMediaSelectedCallback = null;

function initMediaLibrary() {
    document.getElementById('uploadMediaBtn').addEventListener('click', () => mediaUploadInput.click());
    mediaUploadInput.addEventListener('change', uploadMedia);
    document.getElementById('closeMediaSelector').addEventListener('click', () => mediaSelectorModal.classList.remove('active'));

    // Connect Designer Buttons
    document.getElementById('addImageBtn').addEventListener('click', () => {
        openMediaSelector((url) => addElement('image', url));
    });
    document.getElementById('addVideoBtn').addEventListener('click', () => {
        openMediaSelector((url) => addElement('video', url));
    });
}

async function loadMedia(gridElement = mediaGrid, isSelector = false) {
    try {
        const response = await fetch('/api/media');
        const data = await response.json();
        gridElement.innerHTML = '';

        if (data.files.length === 0) {
            gridElement.innerHTML = '<p style="color:var(--text-secondary)">No media found. Upload something!</p>';
            return;
        }

        data.files.forEach(file => {
            const card = document.createElement('div');
            card.className = 'overlay-card';
            card.style.padding = '10px';

            let preview = '';
            if (file.type === 'image') {
                preview = `<img src="${file.url}" style="width:100%; height:150px; object-fit:cover; border-radius:4px; margin-bottom:10px;">`;
            } else {
                preview = `<video src="${file.url}" style="width:100%; height:150px; object-fit:cover; border-radius:4px; margin-bottom:10px;"></video>`;
            }

            if (isSelector) {
                card.innerHTML = `${preview}<p style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${file.name}</p>`;
                card.style.cursor = 'pointer';
                card.onclick = () => {
                    if (onMediaSelectedCallback) onMediaSelectedCallback(file.url);
                    mediaSelectorModal.classList.remove('active');
                };
            } else {
                card.innerHTML = `
                    ${preview}
                    <div style="display:flex; justify-content:space-between; align-items:center">
                        <p style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px">${file.name}</p>
                        ${file.type === 'video' ? `<button class="btn btn-small btn-success" style="padding:2px 8px; font-size:10px" onclick="streamVideo('${file.url}', '${file.name}')">▶ Stream</button>` : ''}
                    </div>
                `;
            }

            gridElement.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

window.streamVideo = function (url, name) {
    if (confirm(`Stream this video: ${name}?`)) {
        socket.emit('stream-video', { url, name });
        showToast('Video switched!', 'success');
    }
};

async function uploadMedia() {
    const file = mediaUploadInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        showToast('Uploading...', 'warning');
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success) {
            showToast('Upload successful', 'success');
            loadMedia();
        } else {
            showToast('Upload failed', 'error');
        }
    } catch (e) { showToast('Upload failed', 'error'); }
    mediaUploadInput.value = '';
}

function openMediaSelector(callback) {
    onMediaSelectedCallback = callback;
    loadMedia(selectorGrid, true);
    mediaSelectorModal.classList.add('active');
}

// Update addElement to handle images/videos
const originalAddElement = addElement;
addElement = function (type, src) {
    if (type === 'text') {
        originalAddElement(type);
        return;
    }

    const el = document.createElement('div');
    el.classList.add('stream-element');
    el.style.left = '100px';
    el.style.top = '100px';
    el.style.position = 'absolute';
    el.dataset.type = type;

    if (type === 'image') {
        const img = document.createElement('img');
        img.src = src;
        img.style.maxWidth = '400px';
        img.style.maxHeight = '400px';
        img.style.pointerEvents = 'none'; // dragging parent
        el.appendChild(img);
    }
    else if (type === 'video') {
        const vid = document.createElement('video');
        vid.src = src;
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.style.width = '400px';
        vid.style.pointerEvents = 'none';
        el.appendChild(vid);
    }

    // Re-attach drag logic (copied from original as we're initializing fresh)
    el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectElement(el);
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialEleX = parseInt(el.style.left || 0);
        initialEleY = parseInt(el.style.top || 0);

        const moveHandler = (ev) => {
            if (!isDragging) return;
            const dx = (ev.clientX - dragStartX) / designerScale;
            const dy = (ev.clientY - dragStartY) / designerScale;
            el.style.left = `${initialEleX + dx}px`;
            el.style.top = `${initialEleY + dy}px`;
            updatePropsFromSelected();
        };
        const upHandler = () => {
            isDragging = false;
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    });

    designerCanvas.appendChild(el);
    selectElement(el);
};

// --- Refactored Drag & Scene Logic (Updated with Resizing) ---

function makeDraggable(el) {
    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return; // Don't drag if resizing
        e.stopPropagation();
        selectElement(el);
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialEleX = parseInt(el.style.left || 0);
        initialEleY = parseInt(el.style.top || 0);

        const moveHandler = (ev) => {
            if (!isDragging) return;
            const dx = (ev.clientX - dragStartX) / designerScale;
            const dy = (ev.clientY - dragStartY) / designerScale;
            el.style.left = `${initialEleX + dx}px`;
            el.style.top = `${initialEleY + dy}px`;
            updatePropsFromSelected();
        };
        const upHandler = () => {
            isDragging = false;
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    });

    makeResizable(el);
}

function makeResizable(el) {
    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(h => {
        let handle = el.querySelector(`.handle-${h}`);
        if (!handle) {
            handle = document.createElement('div');
            handle.className = `resize-handle handle-${h}`;
            el.appendChild(handle);
        }

        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = parseInt(el.style.width || el.offsetWidth);
            const startHeight = parseInt(el.style.height || el.offsetHeight);
            const startFontSize = parseInt(el.style.fontSize || 48); // For text

            const resizeHandler = (ev) => {
                const dx = (ev.clientX - startX) / designerScale;
                const dy = (ev.clientY - startY) / designerScale;

                if (el.dataset.type === 'text') {
                    // For text, we change font size based on drag (simplified interaction)
                    const newSize = Math.max(10, startFontSize + dx); // Use horizontal drag for size
                    el.style.fontSize = `${newSize}px`;
                } else {
                    // For boxes/images
                    // Simple SE resize logic for now
                    if (h === 'se') {
                        const newWidth = Math.max(50, startWidth + dx);
                        const newHeight = Math.max(50, startHeight + dy);

                        // Update container
                        el.style.width = `${newWidth}px`;
                        el.style.height = `${newHeight}px`;

                        // Update children (image/video)
                        Array.from(el.children).forEach(c => {
                            if (c.classList.contains('resize-handle')) return;
                            c.style.width = '100%';
                            c.style.height = '100%';
                            c.style.maxWidth = 'none';
                            c.style.maxHeight = 'none';
                        });
                    }
                }
                updatePropsFromSelected();
            };

            const stopResize = () => {
                document.removeEventListener('mousemove', resizeHandler);
                document.removeEventListener('mouseup', stopResize);
            };

            document.addEventListener('mousemove', resizeHandler);
            document.addEventListener('mouseup', stopResize);
        });
    });
}

// Redefine addElement to use makeDraggable
addElement = function (type, src) {
    if (type === 'text') {
        const el = document.createElement('div');
        el.classList.add('stream-element');
        el.style.left = '100px';
        el.style.top = '100px';
        el.style.position = 'absolute';
        el.dataset.type = 'text';
        el.innerText = 'New Text';
        el.style.fontSize = '48px';
        el.style.color = '#ffffff';
        el.style.fontFamily = 'Arial, sans-serif';
        el.style.whiteSpace = 'nowrap';

        designerCanvas.appendChild(el);
        makeDraggable(el);
        selectElement(el);
        return;
    }
    else if (type === 'html') {
        const el = document.createElement('div');
        el.classList.add('stream-element');
        el.style.left = '100px';
        el.style.top = '100px';
        el.style.position = 'absolute';
        el.dataset.type = 'html';
        el.innerHTML = '<div style="background:rgba(0,0,0,0.5); padding:10px; color:white; width:100%; height:100%;"><h3>HTML Overlay</h3><p>Edit content in properties</p></div>';
        el.style.width = '300px';
        el.style.height = '150px';

        designerCanvas.appendChild(el);
        makeDraggable(el);
        selectElement(el);
        return;
    }

    const el = document.createElement('div');
    el.classList.add('stream-element');
    el.style.left = '100px';
    el.style.top = '100px';
    el.style.position = 'absolute';
    el.dataset.type = type;

    if (type === 'image') {
        const img = document.createElement('img');
        img.src = src;
        img.style.width = '400px';
        img.style.height = 'auto';
        img.style.pointerEvents = 'none';
        el.appendChild(img);
        el.style.width = '400px';
    }
    else if (type === 'video') {
        const vid = document.createElement('video');
        vid.src = src;
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.style.width = '400px';
        vid.style.pointerEvents = 'none';
        el.appendChild(vid);
        el.style.width = '400px';
    }

    designerCanvas.appendChild(el);
    makeDraggable(el);
    selectElement(el);
};

// Override editOverlay
editOverlay = async function (id) {
    try {
        const r = await fetch(`/api/overlay/${id}`);
        const data = await r.json();

        if (data.js && data.js.includes('Visual Designer Scene')) {
            loadDesignerScene(data);
        } else {
            openOverlayEditor(data);
        }
    }
    catch (e) { showToast('Failed to load overlay', 'error'); }
};

function loadDesignerScene(data) {
    openDesigner();
    designerCanvas.innerHTML = data.html;
    const elements = designerCanvas.querySelectorAll('.stream-element');
    elements.forEach(el => {
        makeDraggable(el); // adds resize handles
        Array.from(el.children).forEach(c => {
            if (c.tagName !== 'DIV') c.style.pointerEvents = 'none'; // Ensure content isn't capturing clicks
        });
    });
}
const { ipcRenderer } = require('electron');

// State management
let overlayElements = [];
let selectedElement = null;
let isStreaming = false;
let streamStartTime = null;
let durationInterval = null;

// DOM Elements
const streamKey = document.getElementById('streamKey');
const resolution = document.getElementById('resolution');
const framerate = document.getElementById('framerate');
const bitrate = document.getElementById('bitrate');
const saveConfigBtn = document.getElementById('saveConfig');
const startStreamBtn = document.getElementById('startStream');
const stopStreamBtn = document.getElementById('stopStream');
const openPreviewBtn = document.getElementById('openPreview');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const durationText = document.getElementById('duration');
const cpuUsageText = document.getElementById('cpuUsage');
const overlayCanvas = document.getElementById('overlayCanvas');
const layersList = document.getElementById('layersList');

const addTextBtn = document.getElementById('addText');
const addImageBtn = document.getElementById('addImage');
const addWidgetBtn = document.getElementById('addWidget');
const clearOverlayBtn = document.getElementById('clearOverlay');

const textModal = document.getElementById('textModal');
const textContent = document.getElementById('textContent');
const fontSize = document.getElementById('fontSize');
const fontColor = document.getElementById('fontColor');
const bgColor = document.getElementById('bgColor');
const textOpacity = document.getElementById('textOpacity');
const addTextConfirm = document.getElementById('addTextConfirm');
const cancelText = document.getElementById('cancelText');

// Load configuration on startup
async function loadConfig() {
    const config = await ipcRenderer.invoke('get-config');
    if (config) {
        streamKey.value = config.streamKey || '';
        resolution.value = config.resolution || '1920x1080';
        framerate.value = config.framerate || 30;
        bitrate.value = config.bitrate || '4500k';
    }
}

// Save configuration
saveConfigBtn.addEventListener('click', async () => {
    const config = {
        streamKey: streamKey.value,
        resolution: resolution.value,
        framerate: parseInt(framerate.value),
        bitrate: bitrate.value
    };
    
    const result = await ipcRenderer.invoke('save-config', config);
    if (result.success) {
        showNotification('Settings saved successfully', 'success');
    }
});

// Start stream
startStreamBtn.addEventListener('click', async () => {
    if (!streamKey.value) {
        showNotification('Please enter your YouTube stream key', 'error');
        return;
    }
    
    const config = {
        streamKey: streamKey.value,
        resolution: resolution.value,
        framerate: parseInt(framerate.value),
        bitrate: bitrate.value
    };
    
    startStreamBtn.disabled = true;
    startStreamBtn.textContent = 'Starting...';
    
    const result = await ipcRenderer.invoke('start-stream', config);
    
    if (result.success) {
        isStreaming = true;
        streamStartTime = Date.now();
        updateStreamStatus('streaming');
        startDurationCounter();
        showNotification('Stream started successfully', 'success');
    } else {
        showNotification('Failed to start stream: ' + result.error, 'error');
        startStreamBtn.disabled = false;
        startStreamBtn.innerHTML = '<span class="icon">▶</span> Start Stream';
    }
});

// Stop stream
stopStreamBtn.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('stop-stream');
    if (result.success) {
        isStreaming = false;
        updateStreamStatus('stopped');
        stopDurationCounter();
        showNotification('Stream stopped', 'info');
    }
});

// Open preview window
openPreviewBtn.addEventListener('click', async () => {
    await ipcRenderer.invoke('open-preview');
});

// Update stream status UI
function updateStreamStatus(status) {
    if (status === 'streaming') {
        statusDot.classList.add('online');
        statusDot.classList.remove('offline');
        statusText.textContent = 'Live';
        startStreamBtn.disabled = true;
        stopStreamBtn.disabled = false;
        startStreamBtn.innerHTML = '<span class="icon">▶</span> Start Stream';
    } else {
        statusDot.classList.add('offline');
        statusDot.classList.remove('online');
        statusText.textContent = 'Offline';
        startStreamBtn.disabled = false;
        stopStreamBtn.disabled = true;
    }
}

// Duration counter
function startDurationCounter() {
    durationInterval = setInterval(() => {
        if (streamStartTime) {
            const elapsed = Date.now() - streamStartTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            durationText.textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

function stopDurationCounter() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
    durationText.textContent = '00:00:00';
}

// CPU usage monitoring (simplified)
setInterval(() => {
    if (isStreaming) {
        // In a real implementation, you'd get actual CPU usage
        cpuUsageText.textContent = (Math.random() * 15 + 10).toFixed(1) + '%';
    } else {
        cpuUsageText.textContent = '0%';
    }
}, 2000);

// Overlay Management
let elementIdCounter = 0;

// Add text overlay
addTextBtn.addEventListener('click', () => {
    textModal.classList.add('active');
});

cancelText.addEventListener('click', () => {
    textModal.classList.remove('active');
    resetTextForm();
});

addTextConfirm.addEventListener('click', () => {
    const element = {
        id: ++elementIdCounter,
        type: 'text',
        content: textContent.value || 'Sample Text',
        fontSize: parseInt(fontSize.value),
        fontColor: fontColor.value,
        bgColor: bgColor.value,
        opacity: parseInt(textOpacity.value) / 100,
        x: 50,
        y: 50,
        width: 200,
        height: 60
    };
    
    addOverlayElement(element);
    textModal.classList.remove('active');
    resetTextForm();
});

function resetTextForm() {
    textContent.value = '';
    fontSize.value = 32;
    fontColor.value = '#ffffff';
    bgColor.value = '#000000';
    textOpacity.value = 100;
}

// Add image overlay
addImageBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const element = {
                    id: ++elementIdCounter,
                    type: 'image',
                    src: event.target.result,
                    x: 100,
                    y: 100,
                    width: 200,
                    height: 200
                };
                addOverlayElement(element);
            };
            reader.readAsDataURL(file);
        }
    };
    
    input.click();
});

// Add widget overlay
addWidgetBtn.addEventListener('click', () => {
    const widgets = [
        { name: 'Clock', type: 'clock' },
        { name: 'Subscriber Count', type: 'subscribers' },
        { name: 'Chat Box', type: 'chat' },
        { name: 'Alert Box', type: 'alerts' }
    ];
    
    // Simple widget selection (in production, you'd have a proper modal)
    const widgetName = prompt('Select widget:\n1. Clock\n2. Subscriber Count\n3. Chat Box\n4. Alert Box');
    
    if (widgetName) {
        const element = {
            id: ++elementIdCounter,
            type: 'widget',
            widgetType: widgets[parseInt(widgetName) - 1]?.type || 'clock',
            x: 150,
            y: 150,
            width: 250,
            height: 100
        };
        addOverlayElement(element);
    }
});

// Clear all overlays
clearOverlayBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all overlays?')) {
        overlayElements = [];
        overlayCanvas.innerHTML = '';
        updateLayersList();
    }
});

// Add overlay element to canvas
function addOverlayElement(element) {
    overlayElements.push(element);
    renderOverlayElement(element);
    updateLayersList();
}

// Render overlay element
function renderOverlayElement(element) {
    const div = document.createElement('div');
    div.className = 'overlay-element';
    div.dataset.id = element.id;
    div.style.left = element.x + 'px';
    div.style.top = element.y + 'px';
    
    if (element.type === 'text') {
        div.classList.add('overlay-text');
        div.textContent = element.content;
        div.style.fontSize = element.fontSize + 'px';
        div.style.color = element.fontColor;
        div.style.backgroundColor = element.bgColor;
        div.style.opacity = element.opacity;
    } else if (element.type === 'image') {
        div.classList.add('overlay-image');
        const img = document.createElement('img');
        img.src = element.src;
        img.style.width = element.width + 'px';
        img.style.height = element.height + 'px';
        div.appendChild(img);
    } else if (element.type === 'widget') {
        div.classList.add('overlay-widget');
        div.style.width = element.width + 'px';
        div.style.height = element.height + 'px';
        div.style.background = 'rgba(0, 0, 0, 0.7)';
        div.style.padding = '10px';
        div.style.color = 'white';
        div.textContent = `Widget: ${element.widgetType}`;
    }
    
    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    div.appendChild(resizeHandle);
    
    // Make draggable
    makeDraggable(div, element);
    
    // Make resizable
    makeResizable(div, resizeHandle, element);
    
    // Click to select
    div.addEventListener('click', (e) => {
        e.stopPropagation();
        selectElement(element.id);
    });
    
    overlayCanvas.appendChild(div);
}

// Make element draggable
function makeDraggable(div, element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    div.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = element.x;
        initialY = element.y;
        
        div.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        element.x = initialX + dx;
        element.y = initialY + dy;
        
        div.style.left = element.x + 'px';
        div.style.top = element.y + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            div.style.cursor = 'move';
        }
    });
}

// Make element resizable
function makeResizable(div, handle, element) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = element.width || div.offsetWidth;
        startHeight = element.height || div.offsetHeight;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        element.width = Math.max(50, startWidth + dx);
        element.height = Math.max(30, startHeight + dy);
        
        if (element.type === 'image') {
            const img = div.querySelector('img');
            img.style.width = element.width + 'px';
            img.style.height = element.height + 'px';
        } else {
            div.style.width = element.width + 'px';
            div.style.height = element.height + 'px';
        }
    });
    
    document.addEventListener('mouseup', () => {
        isResizing = false;
    });
}

// Select element
function selectElement(id) {
    selectedElement = id;
    
    document.querySelectorAll('.overlay-element').forEach(el => {
        el.classList.remove('selected');
    });
    
    const element = document.querySelector(`[data-id="${id}"]`);
    if (element) {
        element.classList.add('selected');
    }
    
    updateLayersList();
}

// Update layers list
function updateLayersList() {
    layersList.innerHTML = '';
    
    if (overlayElements.length === 0) {
        layersList.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No layers</div>';
        return;
    }
    
    overlayElements.forEach(element => {
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        if (selectedElement === element.id) {
            layerItem.classList.add('active');
        }
        
        const layerName = document.createElement('span');
        layerName.className = 'layer-name';
        layerName.textContent = `${element.type} ${element.id}`;
        
        const layerActions = document.createElement('div');
        layerActions.className = 'layer-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'layer-btn';
        deleteBtn.textContent = '🗑';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteElement(element.id);
        };
        
        layerActions.appendChild(deleteBtn);
        layerItem.appendChild(layerName);
        layerItem.appendChild(layerActions);
        
        layerItem.onclick = () => selectElement(element.id);
        
        layersList.appendChild(layerItem);
    });
}

// Delete element
function deleteElement(id) {
    overlayElements = overlayElements.filter(el => el.id !== id);
    const element = document.querySelector(`[data-id="${id}"]`);
    if (element) {
        element.remove();
    }
    updateLayersList();
}

// Notification system
function showNotification(message, type = 'info') {
    // Simple console notification for now
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // In production, you'd show a proper toast notification
}

// Listen for stream status updates from main process
ipcRenderer.on('stream-status', (event, status) => {
    console.log('Stream status:', status);
    
    if (status.status === 'stopped' || status.status === 'error') {
        isStreaming = false;
        updateStreamStatus('stopped');
        stopDurationCounter();
    }
});

// Close modal when clicking outside
textModal.addEventListener('click', (e) => {
    if (e.target === textModal) {
        textModal.classList.remove('active');
    }
});

// Initialize
loadConfig();

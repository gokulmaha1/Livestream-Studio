// Widget System for Overlays
class WidgetFactory {
    static createWidget(type, config = {}) {
        switch (type) {
            case 'clock':
                return new ClockWidget(config);
            case 'timer':
                return new TimerWidget(config);
            case 'chat':
                return new ChatWidget(config);
            case 'alerts':
                return new AlertWidget(config);
            case 'counter':
                return new CounterWidget(config);
            case 'ticker':
                return new TickerWidget(config);
            default:
                return new BaseWidget(config);
        }
    }
}

class BaseWidget {
    constructor(config) {
        this.id = config.id || Date.now();
        this.type = config.type || 'base';
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || 200;
        this.height = config.height || 100;
        this.visible = config.visible !== false;
    }

    render() {
        return `<div class="widget" style="position: absolute; left: ${this.x}px; top: ${this.y}px; width: ${this.width}px; height: ${this.height}px;"></div>`;
    }

    update() {
        // Override in subclasses
    }
}

class ClockWidget extends BaseWidget {
    constructor(config) {
        super(config);
        this.type = 'clock';
        this.format = config.format || '24h';
        this.showDate = config.showDate || false;
        this.fontSize = config.fontSize || 32;
        this.fontColor = config.fontColor || '#ffffff';
        this.bgColor = config.bgColor || 'rgba(0, 0, 0, 0.7)';
    }

    render() {
        const now = new Date();
        const timeStr = this.format === '24h' 
            ? now.toLocaleTimeString('en-US', { hour12: false })
            : now.toLocaleTimeString('en-US', { hour12: true });
        
        const dateStr = this.showDate ? now.toLocaleDateString() : '';

        return `
            <div class="widget clock-widget" style="
                position: absolute;
                left: ${this.x}px;
                top: ${this.y}px;
                width: ${this.width}px;
                height: ${this.height}px;
                background: ${this.bgColor};
                color: ${this.fontColor};
                font-size: ${this.fontSize}px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                font-family: 'Arial', sans-serif;
                font-weight: bold;
            ">
                <div class="time">${timeStr}</div>
                ${this.showDate ? `<div class="date" style="font-size: ${this.fontSize * 0.5}px;">${dateStr}</div>` : ''}
            </div>
        `;
    }
}

class TimerWidget extends BaseWidget {
    constructor(config) {
        super(config);
        this.type = 'timer';
        this.duration = config.duration || 300; // seconds
        this.remaining = this.duration;
        this.running = false;
        this.fontSize = config.fontSize || 48;
        this.fontColor = config.fontColor || '#ffffff';
        this.bgColor = config.bgColor || 'rgba(255, 0, 0, 0.7)';
    }

    start() {
        this.running = true;
        this.interval = setInterval(() => {
            if (this.remaining > 0) {
                this.remaining--;
            } else {
                this.stop();
            }
        }, 1000);
    }

    stop() {
        this.running = false;
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    reset() {
        this.remaining = this.duration;
        this.stop();
    }

    render() {
        const minutes = Math.floor(this.remaining / 60);
        const seconds = this.remaining % 60;
        const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        return `
            <div class="widget timer-widget" style="
                position: absolute;
                left: ${this.x}px;
                top: ${this.y}px;
                width: ${this.width}px;
                height: ${this.height}px;
                background: ${this.bgColor};
                color: ${this.fontColor};
                font-size: ${this.fontSize}px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                font-family: 'Arial', sans-serif;
                font-weight: bold;
            ">
                ${timeStr}
            </div>
        `;
    }
}

class ChatWidget extends BaseWidget {
    constructor(config) {
        super(config);
        this.type = 'chat';
        this.messages = [];
        this.maxMessages = config.maxMessages || 10;
        this.fontSize = config.fontSize || 16;
        this.fontColor = config.fontColor || '#ffffff';
        this.bgColor = config.bgColor || 'rgba(0, 0, 0, 0.7)';
    }

    addMessage(username, message, color = '#ffffff') {
        this.messages.push({ username, message, color, timestamp: Date.now() });
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }
    }

    render() {
        const messagesHtml = this.messages.map(msg => `
            <div class="chat-message" style="margin-bottom: 8px;">
                <span style="color: ${msg.color}; font-weight: bold;">${msg.username}:</span>
                <span style="color: ${this.fontColor};">${msg.message}</span>
            </div>
        `).join('');

        return `
            <div class="widget chat-widget" style="
                position: absolute;
                left: ${this.x}px;
                top: ${this.y}px;
                width: ${this.width}px;
                height: ${this.height}px;
                background: ${this.bgColor};
                color: ${this.fontColor};
                font-size: ${this.fontSize}px;
                padding: 10px;
                border-radius: 8px;
                overflow-y: auto;
                font-family: 'Arial', sans-serif;
            ">
                ${messagesHtml || '<div style="color: #666;">No messages</div>'}
            </div>
        `;
    }
}

class AlertWidget extends BaseWidget {
    constructor(config) {
        super(config);
        this.type = 'alerts';
        this.currentAlert = null;
        this.fontSize = config.fontSize || 24;
        this.fontColor = config.fontColor || '#ffffff';
        this.bgColor = config.bgColor || 'rgba(255, 0, 0, 0.9)';
        this.duration = config.duration || 5000; // ms
    }

    showAlert(type, message, data = {}) {
        this.currentAlert = { type, message, data };
        
        setTimeout(() => {
            this.currentAlert = null;
        }, this.duration);
    }

    render() {
        if (!this.currentAlert) {
            return `<div class="widget alert-widget" style="display: none;"></div>`;
        }

        const { type, message, data } = this.currentAlert;
        let icon = '🔔';
        
        if (type === 'follow') icon = '👤';
        if (type === 'subscribe') icon = '⭐';
        if (type === 'donation') icon = '💰';

        return `
            <div class="widget alert-widget" style="
                position: absolute;
                left: ${this.x}px;
                top: ${this.y}px;
                width: ${this.width}px;
                height: ${this.height}px;
                background: ${this.bgColor};
                color: ${this.fontColor};
                font-size: ${this.fontSize}px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                font-family: 'Arial', sans-serif;
                animation: slideIn 0.3s ease-out;
            ">
                <span style="font-size: ${this.fontSize * 1.5}px; margin-right: 10px;">${icon}</span>
                <span>${message}</span>
            </div>
        `;
    }
}

class CounterWidget extends BaseWidget {
    constructor(config) {
        super(config);
        this.type = 'counter';
        this.count = config.initialCount || 0;
        this.label = config.label || 'Count';
        this.fontSize = config.fontSize || 32;
        this.fontColor = config.fontColor || '#ffffff';
        this.bgColor = config.bgColor || 'rgba(0, 0, 0, 0.7)';
    }

    increment() {
        this.count++;
    }

    decrement() {
        this.count--;
    }

    reset() {
        this.count = 0;
    }

    render() {
        return `
            <div class="widget counter-widget" style="
                position: absolute;
                left: ${this.x}px;
                top: ${this.y}px;
                width: ${this.width}px;
                height: ${this.height}px;
                background: ${this.bgColor};
                color: ${this.fontColor};
                font-size: ${this.fontSize}px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                font-family: 'Arial', sans-serif;
                font-weight: bold;
            ">
                <div style="font-size: ${this.fontSize * 0.6}px; opacity: 0.8;">${this.label}</div>
                <div>${this.count}</div>
            </div>
        `;
    }
}

class TickerWidget extends BaseWidget {
    constructor(config) {
        super(config);
        this.type = 'ticker';
        this.text = config.text || 'Breaking News';
        this.speed = config.speed || 2; // pixels per frame
        this.offset = 0;
        this.fontSize = config.fontSize || 24;
        this.fontColor = config.fontColor || '#ffffff';
        this.bgColor = config.bgColor || 'rgba(255, 0, 0, 0.9)';
    }

    update() {
        this.offset -= this.speed;
        if (this.offset < -this.width) {
            this.offset = this.width;
        }
    }

    render() {
        return `
            <div class="widget ticker-widget" style="
                position: absolute;
                left: ${this.x}px;
                top: ${this.y}px;
                width: ${this.width}px;
                height: ${this.height}px;
                background: ${this.bgColor};
                color: ${this.fontColor};
                font-size: ${this.fontSize}px;
                overflow: hidden;
                border-radius: 8px;
                font-family: 'Arial', sans-serif;
            ">
                <div style="
                    position: absolute;
                    white-space: nowrap;
                    transform: translateX(${this.offset}px);
                    line-height: ${this.height}px;
                    padding: 0 20px;
                ">
                    ${this.text}
                </div>
            </div>
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WidgetFactory, ClockWidget, TimerWidget, ChatWidget, AlertWidget, CounterWidget, TickerWidget };
}

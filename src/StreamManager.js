const { desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');

class StreamManager {
    constructor() {
        this.scenes = [];
        this.activeScene = null;
        this.sources = [];
    }

    // Scene Management
    async createScene(name) {
        const scene = {
            id: Date.now(),
            name: name,
            sources: [],
            overlays: []
        };
        this.scenes.push(scene);
        return scene;
    }

    switchScene(sceneId) {
        const scene = this.scenes.find(s => s.id === sceneId);
        if (scene) {
            this.activeScene = scene;
            return true;
        }
        return false;
    }

    deleteScene(sceneId) {
        this.scenes = this.scenes.filter(s => s.id !== sceneId);
        if (this.activeScene && this.activeScene.id === sceneId) {
            this.activeScene = this.scenes[0] || null;
        }
    }

    // Source Management
    async addSource(sceneId, sourceConfig) {
        const scene = this.scenes.find(s => s.id === sceneId);
        if (!scene) return null;

        const source = {
            id: Date.now(),
            type: sourceConfig.type, // 'display', 'window', 'camera', 'image', 'video'
            config: sourceConfig,
            transform: {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                rotation: 0
            }
        };

        scene.sources.push(source);
        return source;
    }

    // Screen Capture
    async getAvailableScreens() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 150, height: 150 }
            });
            
            return sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL()
            }));
        } catch (error) {
            console.error('Error getting screens:', error);
            return [];
        }
    }

    // Overlay Management
    addOverlay(sceneId, overlay) {
        const scene = this.scenes.find(s => s.id === sceneId);
        if (scene) {
            scene.overlays.push({
                id: Date.now(),
                ...overlay
            });
            return true;
        }
        return false;
    }

    updateOverlay(sceneId, overlayId, updates) {
        const scene = this.scenes.find(s => s.id === sceneId);
        if (scene) {
            const overlay = scene.overlays.find(o => o.id === overlayId);
            if (overlay) {
                Object.assign(overlay, updates);
                return true;
            }
        }
        return false;
    }

    removeOverlay(sceneId, overlayId) {
        const scene = this.scenes.find(s => s.id === sceneId);
        if (scene) {
            scene.overlays = scene.overlays.filter(o => o.id !== overlayId);
            return true;
        }
        return false;
    }

    // Export/Import
    exportConfig() {
        return {
            scenes: this.scenes,
            activeSceneId: this.activeScene ? this.activeScene.id : null
        };
    }

    importConfig(config) {
        this.scenes = config.scenes || [];
        if (config.activeSceneId) {
            this.activeScene = this.scenes.find(s => s.id === config.activeSceneId);
        }
    }

    saveToFile(filepath) {
        const config = this.exportConfig();
        fs.writeFileSync(filepath, JSON.stringify(config, null, 2));
    }

    loadFromFile(filepath) {
        if (fs.existsSync(filepath)) {
            const config = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            this.importConfig(config);
            return true;
        }
        return false;
    }
}

module.exports = StreamManager;

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a 3D water slide demo website that showcases an interactive 3D model viewer with AR capabilities. The project demonstrates the "Tailspin" water slide with multiple interactive features and camera positions.

## Technology Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no build tools required)
- **3D Graphics**: Three.js (main demo) + Google Model-Viewer (enhanced AR demo)
- **AR Support**: WebXR API for ARKit compatibility on iOS Safari + Model-Viewer AR modes
- **Model Format**: GLB/GLTF 3D models

## Development

### Running the Project
```bash
# Serve files locally (required for WebXR)
python -m http.server 8000
# or
npx serve .
```

### Key Files
- `index.html` - Main Three.js demo with responsive grid layout
- `ar-viewer.html` - Enhanced Model-Viewer demo with advanced controls
- `debug-camera.html` - Debug utility for testing camera interactions
- `styles.css` - Responsive CSS with mobile-first design
- `script.js` - Three.js implementation with WaterSlideViewer class

## Architecture

### Two Demo Implementations

#### 1. Three.js Demo (`index.html`)
- **WaterSlideViewer Class** - Custom Three.js implementation
- **Responsive Grid Layout** - 60/40 split with accordion controls
- **Basic AR Support** - WebXR with iOS Safari fallbacks

#### 2. Model-Viewer Demo (`ar-viewer.html`) - **Recommended**
- **Google Model-Viewer Component** - Production-ready 3D viewer
- **Advanced Camera Controls** - Real-time position tracking with `getCameraOrbit()`
- **Superior AR Support** - Cross-platform AR with multiple modes
- **Enhanced Interaction** - Better touch controls and camera management

### Interactive Features
- Feature preset camera positions for water slide highlights
- Real-time camera position display and copy functionality
- Zoom controls (2m-200m range for large installations)
- Auto-rotation with speed controls
- Screenshot export functionality
- Cross-platform AR support (iOS Safari, Android Chrome)

## Model-Viewer Camera API (Key Learning)

### Reading Camera Position in Real-Time
The crucial breakthrough was using `getCameraOrbit()` method instead of trying to read the `cameraOrbit` property:

```javascript
// ❌ Wrong - cameraOrbit property is write-only
const orbit = modelViewer.cameraOrbit; 

// ✅ Correct - getCameraOrbit() returns live values
const orbit = modelViewer.getCameraOrbit();
// Returns: { theta: radians, phi: radians, radius: meters }
```

### Camera Position Conversion
```javascript
function updateCameraInfo() {
    const orbit = modelViewer.getCameraOrbit();
    
    // Convert radians to degrees for display
    const azimuth = orbit.theta * (180 / Math.PI);
    const elevation = orbit.phi * (180 / Math.PI);
    const radius = orbit.radius;
    
    // Format for camera-orbit attribute
    const orbitString = `${azimuth.toFixed(1)}deg ${elevation.toFixed(1)}deg ${radius.toFixed(1)}m`;
}
```

### Camera Presets
Feature camera positions using spherical coordinates:
- `first-drop`: '45deg 85deg 6m' - Close-up angled view
- `water-effects`: '-60deg 70deg 7m' - Side perspective  
- `sound-light`: '0deg 90deg 12m' - Top-down overview
- `extreme-gs`: '120deg 60deg 8m' - Dynamic angle

### AR Integration
- **iOS Safari**: AR Quick Look with GLB files
- **Android Chrome**: Scene Viewer integration  
- **WebXR**: Immersive AR on compatible devices
- **Fallback**: Enhanced web viewer on unsupported devices

## Model Integration

The current implementation loads `GLB test.glb` from the project root. To use a different model:
1. Replace `GLB test.glb` with your new GLB file, or
2. Update the file path in the `loadModel()` method in script.js:
   ```javascript
   loader.load(encodeURI('your-model.glb'), (gltf) => {
       // Model loading and configuration handled automatically
   });
   ```

The model is automatically:
- Centered and scaled to fit the viewer
- Enhanced with shadows and lighting
- Configured with proper materials and environment mapping
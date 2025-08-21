import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class WaterSlideViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        
        this.cameraPositions = {
            'first-drop': {
                position: new THREE.Vector3(5, 8, 12),
                target: new THREE.Vector3(0, 5, 0)
            },
            'water-effects': {
                position: new THREE.Vector3(-8, 6, 8),
                target: new THREE.Vector3(-2, 3, 0)
            },
            'sound-light': {
                position: new THREE.Vector3(0, 12, 0),
                target: new THREE.Vector3(0, 0, 0)
            },
            'extreme-gs': {
                position: new THREE.Vector3(8, 4, -8),
                target: new THREE.Vector3(2, 2, -2)
            }
        };
        
        this.init();
        this.setupUI();
    }
    
    init() {
        const canvas = document.getElementById('three-canvas');
        const container = document.getElementById('three-d-viewer');
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2c3e50);
        
        this.camera = new THREE.PerspectiveCamera(
            60, // Slightly narrower FOV for better framing
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(12, 10, 18);
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        
        // WebXR setup for AR
        this.renderer.xr.enabled = true;
        this.setupWebXR();
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 3, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.maxDistance = 40;
        this.controls.minDistance = 8;
        this.controls.maxPolarAngle = Math.PI * 0.85;
        
        this.setupLighting();
        this.loadModel();
        this.setupEventListeners();
        
        this.animate();
    }
    
    setupWebXR() {
        const arButton = document.getElementById('ar-button');
        const arLink = document.getElementById('ar-link');
        
        // Check for different AR capabilities
        if (this.isIOSSafari()) {
            // iOS Safari - use AR Quick Look link
            arButton.style.display = 'none';
            arLink.classList.remove('hidden');
        } else if ('xr' in navigator) {
            // WebXR compatible browsers
            navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                if (supported) {
                    arButton.textContent = 'View in AR';
                    arButton.addEventListener('click', this.startWebXR.bind(this));
                } else {
                    this.setupARFallback();
                }
            }).catch(() => {
                this.setupARFallback();
            });
        } else {
            this.setupARFallback();
        }
    }
    
    isIOSSafari() {
        const userAgent = navigator.userAgent;
        return /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/CriOS|FxiOS|OPiOS|mercury/.test(userAgent);
    }
    
    setupARFallback() {
        const arButton = document.getElementById('ar-button');
        if (this.isIOSSafari()) {
            arButton.textContent = 'View in AR (iOS)';
            arButton.addEventListener('click', this.startIOSAR.bind(this));
        } else {
            arButton.textContent = 'AR not supported';
            arButton.disabled = true;
            arButton.style.opacity = '0.5';
        }
    }
    
    async startWebXR() {
        if (this.renderer.xr.isPresenting) return;
        
        try {
            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test']
            });
            this.renderer.xr.setSession(session);
            
            session.addEventListener('end', () => {
                this.renderer.xr.setSession(null);
            });
        } catch (error) {
            console.error('Failed to start WebXR session:', error);
            alert('AR is not available on this device or browser.');
        }
    }
    
    async startIOSAR() {
        try {
            // For iOS AR Quick Look, we need to convert the GLB to USDZ
            // or use a direct GLB link with rel="ar"
            const arLink = document.createElement('a');
            arLink.rel = 'ar';
            arLink.href = encodeURI('GLB test.glb');
            
            // Add some metadata for AR Quick Look
            arLink.appendChild(document.createElement('img'));
            
            // Trigger the AR Quick Look
            document.body.appendChild(arLink);
            arLink.click();
            document.body.removeChild(arLink);
            
        } catch (error) {
            console.error('Failed to start iOS AR:', error);
            
            // Fallback: try to open the model directly
            const fallbackMessage = `
                To view this model in AR on iOS:
                1. Make sure you're using Safari on iOS 12+
                2. Tap and hold the AR button
                3. Select "Download Linked File"
                4. Open the file in AR Quick Look
            `;
            alert(fallbackMessage);
        }
    }
    
    setupLighting() {
        // Soft ambient lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Main directional light (sun-like)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(15, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -25;
        directionalLight.shadow.camera.right = 25;
        directionalLight.shadow.camera.top = 25;
        directionalLight.shadow.camera.bottom = -25;
        directionalLight.shadow.bias = -0.0001;
        this.scene.add(directionalLight);
        
        // Fill light for water slide colors
        const fillLight = new THREE.DirectionalLight(0x4ecdc4, 0.4);
        fillLight.position.set(-10, 8, -10);
        this.scene.add(fillLight);
        
        // Rim light for edge definition
        const rimLight = new THREE.DirectionalLight(0x667eea, 0.3);
        rimLight.position.set(5, -8, 15);
        this.scene.add(rimLight);
        
        // Add hemisphere light for natural outdoor feeling
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.4);
        this.scene.add(hemisphereLight);
        
        // Create environment map for reflections
        this.createEnvironmentMap();
    }
    
    createEnvironmentMap() {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        
        // Create a simple sky gradient
        const renderTarget = pmremGenerator.fromScene(this.createSkyScene());
        this.scene.environment = renderTarget.texture;
        
        pmremGenerator.dispose();
    }
    
    createSkyScene() {
        const skyScene = new THREE.Scene();
        const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x87ceeb,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        skyScene.add(sky);
        return skyScene;
    }
    
    loadModel() {
        const loader = new GLTFLoader();
        const loadingScreen = document.getElementById('loading-screen');
        
        loader.load(
            encodeURI('GLB test.glb'),
            (gltf) => {
                this.model = gltf.scene;
                
                // Configure model properties
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Enhance materials
                        if (child.material) {
                            child.material.needsUpdate = true;
                            
                            // Add some environmental mapping if available
                            if (child.material.isMeshStandardMaterial) {
                                child.material.envMapIntensity = 0.5;
                            }
                        }
                    }
                });
                
                // Scale and position the model appropriately
                const box = new THREE.Box3().setFromObject(this.model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                
                // Center the model
                this.model.position.x = -center.x;
                this.model.position.y = -center.y;
                this.model.position.z = -center.z;
                
                // Scale the model to fill more of the viewer
                const maxDimension = Math.max(size.x, size.y, size.z);
                const scale = 55 / maxDimension; // Increased scale for better visibility
                this.model.scale.setScalar(scale);
                
                console.log('Model dimensions:', size);
                console.log('Applied scale:', scale);
                
                this.scene.add(this.model);
                
                // Update camera positions based on model bounds
                this.updateCameraPositionsForModel(size, scale);
                
                // Hide loading screen
                loadingScreen.classList.add('hidden');
                
                console.log('Model loaded successfully:', this.model);
            },
            (progress) => {
                const percentComplete = (progress.loaded / progress.total) * 100;
                console.log('Loading progress:', percentComplete + '%');
            },
            (error) => {
                console.error('Error loading GLB model:', error);
                loadingScreen.classList.add('hidden');
                alert('Could not load the 3D model. Please check the file path and try again.');
            }
        );
    }
    
    updateCameraPositionsForModel(modelSize, scale) {
        const scaledSize = modelSize.clone().multiplyScalar(scale);
        const maxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);
        
        // Update camera positions to work better with the actual model
        this.cameraPositions = {
            'first-drop': {
                position: new THREE.Vector3(maxDim * 0.8, maxDim * 1.1, maxDim * 0.8),
                target: new THREE.Vector3(0, scaledSize.y * 0.8, 0)
            },
            'water-effects': {
                position: new THREE.Vector3(-maxDim * 0.7, maxDim * 0.8, maxDim * 0.7),
                target: new THREE.Vector3(-scaledSize.x * 0.1, scaledSize.y * 0.4, 0)
            },
            'sound-light': {
                position: new THREE.Vector3(0, maxDim * 1.2, maxDim * 0.2),
                target: new THREE.Vector3(0, scaledSize.y * 0.2, 0)
            },
            'extreme-gs': {
                position: new THREE.Vector3(maxDim * 0.7, maxDim * 0.6, -maxDim * 0.7),
                target: new THREE.Vector3(scaledSize.x * 0.1, scaledSize.y * 0.3, -scaledSize.z * 0.1)
            }
        };
        
        // Update initial camera position to frame the model better
        this.camera.position.set(maxDim * 0.9, maxDim * 0.8, maxDim * 0.9);
        this.controls.target.set(0, scaledSize.y * 0.4, 0);
        this.controls.update();
    }

    setupUI() {
        // Accordion functionality
        const accordionItems = document.querySelectorAll('.accordion-item');
        
        accordionItems.forEach(item => {
            const header = item.querySelector('.accordion-header');
            const content = item.querySelector('.accordion-content');
            const icon = item.querySelector('.accordion-icon');
            
            header.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Close all other accordion items
                accordionItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                        otherItem.querySelector('.accordion-content').classList.remove('expanded');
                        otherItem.querySelector('.accordion-icon').textContent = '+';
                    }
                });
                
                // Toggle current item
                if (isActive) {
                    item.classList.remove('active');
                    content.classList.remove('expanded');
                    icon.textContent = '+';
                } else {
                    item.classList.add('active');
                    content.classList.add('expanded');
                    icon.textContent = '—';
                    
                    // Animate camera to target
                    const target = item.getAttribute('data-camera-target');
                    this.animateCamera(target);
                }
            });
        });
    }
    
    animateCamera(targetKey) {
        if (!this.cameraPositions[targetKey]) return;
        
        const targetPos = this.cameraPositions[targetKey];
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        
        const duration = 2000;
        const startTime = Date.now();
        
        const animateStep = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth easing function
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Interpolate camera position
            this.camera.position.lerpVectors(startPos, targetPos.position, easeProgress);
            this.controls.target.lerpVectors(startTarget, targetPos.target, easeProgress);
            
            this.controls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animateStep);
            }
        };
        
        animateStep();
    }
    
    setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Touch handling for mobile
        let touching = false;
        this.renderer.domElement.addEventListener('touchstart', (e) => {
            touching = true;
            e.preventDefault();
        });
        
        this.renderer.domElement.addEventListener('touchend', () => {
            touching = false;
        });
        
        this.renderer.domElement.addEventListener('touchmove', (e) => {
            if (touching) {
                e.preventDefault();
            }
        });
    }
    
    onWindowResize() {
        const container = document.getElementById('three-d-viewer');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    animate() {
        this.renderer.setAnimationLoop(() => {
            if (this.controls) {
                this.controls.update();
            }
            
            this.renderer.render(this.scene, this.camera);
        });
    }
}

// Initialize the viewer when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new WaterSlideViewer();
});
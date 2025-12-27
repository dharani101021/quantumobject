import * as THREE from 'three';

// --- 1. SETUP & GEOMETRY ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const particleCount = 10000;
const geometry = new THREE.BufferGeometry();

// Multiple target buffers for shapes
const spherePos = new Float32Array(particleCount * 3);
const cubePos = new Float32Array(particleCount * 3);
const pyramidPos = new Float32Array(particleCount * 3);
const randomPos = new Float32Array(particleCount * 3);
const currentPos = new Float32Array(particleCount * 3);

// Initialize Positions
for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;

    // 1. Sphere Math
    const phi = Math.acos(-1 + (2 * i) / particleCount);
    const theta = Math.sqrt(particleCount * Math.PI) * phi;
    spherePos[i3] = 2.5 * Math.cos(theta) * Math.sin(phi);
    spherePos[i3+1] = 2.5 * Math.sin(theta) * Math.sin(phi);
    spherePos[i3+2] = 2.5 * Math.cos(phi);

    // 2. Cube Math
    cubePos[i3] = (Math.random() - 0.5) * 4;
    cubePos[i3+1] = (Math.random() - 0.5) * 4;
    cubePos[i3+2] = (Math.random() - 0.5) * 4;

    // 3. Pyramid Math
    let px = (Math.random() - 0.5) * 4;
    let pz = (Math.random() - 0.5) * 4;
    let py = Math.random() * 4;
    let limit = (4 - py) / 2;
    px = THREE.MathUtils.clamp(px, -limit, limit);
    pz = THREE.MathUtils.clamp(pz, -limit, limit);
    pyramidPos[i3] = px; pyramidPos[i3+1] = py - 2; pyramidPos[i3+2] = pz;

    // 4. Chaos
    randomPos[i3] = (Math.random() - 0.5) * 15;
    randomPos[i3+1] = (Math.random() - 0.5) * 15;
    randomPos[i3+2] = (Math.random() - 0.5) * 15;
}

geometry.setAttribute('position', new THREE.BufferAttribute(currentPos, 3));
const material = new THREE.PointsMaterial({ color: 0x00ffcc, size: 0.02, transparent: true, blending: THREE.AdditiveBlending });
const points = new THREE.Points(geometry, material);
scene.add(points);
camera.position.z = 7;

// --- 2. MULTI-FUNCTIONALITY STATE ---
let activeTarget = spherePos; 
let formationFactor = 0;
let fingertips = [];

// Allow manual shape switching with keys 1, 2, 3
window.addEventListener('keydown', (e) => {
    if(e.key === '1') activeTarget = spherePos;
    if(e.key === '2') activeTarget = cubePos;
    if(e.key === '3') activeTarget = pyramidPos;
});

// --- 3. THE INTERACTION LOOP ---
function onResults(results) {
    fingertips = [];
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        document.getElementById('mode').innerText = "SYSTEM ACTIVE: 5-FINGER INPUT";
        formationFactor += (1 - formationFactor) * 0.1;

        const hand = results.multiHandLandmarks[0];
        // Capture all 5 fingertips
        [4, 8, 12, 16, 20].forEach(index => {
            fingertips.push(new THREE.Vector3((hand[index].x - 0.5) * 10, -(hand[index].y - 0.5) * 10, -(hand[index].z * 10)));
        });

        // AUTO-SHAPE SWITCHING: Detect "fist" to go to cube
        const distThumbIndex = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y);
        activeTarget = (distThumbIndex < 0.05) ? cubePos : spherePos;

    } else {
        document.getElementById('mode').innerText = "MODE: CHAOS DRIFT";
        formationFactor += (0 - formationFactor) * 0.02;
    }

    const posAttr = geometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // INTERPOLATE GROUP SHAPE
        const targetX = randomPos[i3] + (activeTarget[i3] - randomPos[i3]) * formationFactor;
        const targetY = randomPos[i3+1] + (activeTarget[i3+1] - randomPos[i3+1]) * formationFactor;
        const targetZ = randomPos[i3+2] + (activeTarget[i3+2] - randomPos[i3+2]) * formationFactor;

        posAttr[i3] += (targetX - posAttr[i3]) * 0.1;
        posAttr[i3+1] += (targetY - posAttr[i3+1]) * 0.1;
        posAttr[i3+2] += (targetZ - posAttr[i3+2]) * 0.1;

        // 5-FINGER INTERACTION
        fingertips.forEach((finger, index) => {
            const dx = posAttr[i3] - finger.x;
            const dy = posAttr[i3+1] - finger.y;
            const dz = posAttr[i3+2] - finger.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

            if (dist < 1.2) {
                // Different function per finger:
                // Index & Middle push, Thumb & Ring pull
                const force = (index === 0 || index === 3) ? -0.05 : 0.15; 
                posAttr[i3] += dx * force * (1.2 - dist);
                posAttr[i3+1] += dy * force * (1.2 - dist);
                posAttr[i3+2] += dz * force * (1.2 - dist);
            }
        });
    }
    geometry.attributes.position.needsUpdate = true;
}
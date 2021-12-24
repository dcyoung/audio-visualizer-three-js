import AudioMotionAnalyzer from 'https://cdn.skypack.dev/audiomotion-analyzer?min';
import * as THREE from 'https://cdn.skypack.dev/three@v0.136.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@v0.136.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/three@v0.136.0/examples/jsm/libs/lil-gui.module.min.js';
import Stats from 'https://cdn.skypack.dev/three@v0.136.0/examples/jsm/libs/stats.module.js';

let AppSettings = class {
    constructor() {
        this.cubeSideLength = 0.02;
        this.nGridRows = 150;
        this.nGridCols = 150;
    }
    get gridSizeX() {
        return this.nGridRows * 1.1 * this.cubeSideLength;
    }

    get gridSizeY() {
        return this.nGridCols * 1.1 * this.cubeSideLength;
    }
};

const appSettings = new AppSettings();
const audioEl = document.getElementById('audio');
let freqBinValues, container, stats, geometry, material, camera, scene, renderer, mesh, controls, dirGroup, ambientLight, spotLight, dirLight;
let lastTime = 0;

init();
animate();

function init() {
    initScene();

    container = document.getElementById('container');
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    if (renderer.capabilities.isWebGL2 === false && renderer.extensions.has('ANGLE_instanced_arrays') === false) {
        document.getElementById('notSupported').style.display = '';
        return;
    }

    stats = new Stats();
    container.appendChild(stats.dom);
    window.addEventListener('resize', onWindowResize);

    initGui();
    initControls();
}
function initGui() {
    const gui = new GUI({ width: 350 });
    // listen for app changes that require modifying the mesh...
    var proxiedAppSettings = new Proxy(appSettings, {
        set: function (target, prop, value) {
            const val = Reflect.set(target, prop, value);
            scene.remove(mesh);
            mesh = new THREE.InstancedMesh(geometry, material, appSettings.nGridRows * appSettings.nGridCols);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            return val
        }
    });
    gui.add(proxiedAppSettings, 'nGridRows', 1, 500, 1);
    gui.add(proxiedAppSettings, 'nGridCols', 1, 500, 1);

}
function initControls() {
    controls = new OrbitControls(camera, renderer.domElement);

}

function initScene() {
    // CAMERA
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 0, 10);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222244);
    scene.fog = new THREE.Fog(0x222244, 50, 100);

    // GROUND PLANE
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshPhongMaterial({
            color: 0x999999,
            shininess: 0,
            specular: 0x111111
        })
    );

    ground.castShadow = true;
    ground.receiveShadow = true;
    scene.add(ground);
    ground.position.z = -0.05;


    // LIGHTING
    ambientLight = new THREE.AmbientLight(0x444444);
    scene.add(ambientLight);

    spotLight = new THREE.SpotLight(0xff8888);
    spotLight.angle = Math.PI / 5;
    spotLight.penumbra = 0.3;
    spotLight.position.set(8, 10, 5);
    spotLight.castShadow = true;
    spotLight.shadow.camera.near = 8;
    spotLight.shadow.camera.far = 200;
    spotLight.shadow.mapSize.width = 256;
    spotLight.shadow.mapSize.height = 256;
    spotLight.shadow.bias = - 0.002;
    spotLight.shadow.radius = 4;
    scene.add(spotLight);


    dirLight = new THREE.DirectionalLight(0x8888ff);
    dirLight.position.set(3, 12, 17);
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.right = 17;
    dirLight.shadow.camera.left = - 17;
    dirLight.shadow.camera.top = 17;
    dirLight.shadow.camera.bottom = - 17;
    dirLight.shadow.mapSize.width = 512;
    dirLight.shadow.mapSize.height = 512;
    dirLight.shadow.radius = 4;
    dirLight.shadow.bias = - 0.0005;

    dirGroup = new THREE.Group();
    dirGroup.add(dirLight);
    scene.add(dirGroup);


    // GEOMETRY
    geometry = new THREE.BoxGeometry(
        appSettings.cubeSideLength,
        appSettings.cubeSideLength,
        appSettings.cubeSideLength,
        1);
    // material
    material = new THREE.MeshPhongMaterial({
        color: 0x999999,
        shininess: 0,
        specular: 0x222222
    });


    // per instance data
    const matrix = new THREE.Matrix4();
    const offset = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let x, y, z, idx, normGridX, normGridY;

    mesh = new THREE.InstancedMesh(geometry, material, appSettings.nGridRows * appSettings.nGridCols);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function getValueForNormalizedCoord(bars, normalizedCoord) {
    if (!bars || bars.length == 0) {
        return 0;
    }
    // Interpolate from the bar values based on the normalized Coord
    let rawIdx = normalizedCoord * (bars.length - 1);
    let valueBelow = bars[Math.floor(rawIdx)];
    let valueAbove = bars[Math.ceil(rawIdx)];
    return valueBelow + (rawIdx % 1) * (valueAbove - valueBelow);
}

function updateGrid(bars) {
    const matrix = new THREE.Matrix4();
    const offset = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let x, y, z, idx, normGridX, normGridY;

    for (let row = 0; row < appSettings.nGridRows; row++) {
        for (let col = 0; col < appSettings.nGridCols; col++) {
            idx = row * appSettings.nGridCols + col;
            normGridX = row / appSettings.nGridRows;
            normGridY = col / appSettings.nGridCols;
            x = appSettings.gridSizeX * (normGridX - 0.5);
            y = appSettings.gridSizeY * (normGridY - 0.5);
            let normRadialOffset = Math.sqrt(Math.pow(normGridX - 0.5, 2) + Math.pow(normGridY - 0.5, 2));

            z = getValueForNormalizedCoord(bars, normRadialOffset);
            // z = amplitude * Math.sin(b * normRadialOffset + phaseShift);
            offset.set(x, y, z);
            matrix.compose(offset, orientation, scale);
            mesh.setMatrixAt(idx, matrix);
        }
    }

    mesh.instanceMatrix.needsUpdate = true;
}
//

function animate() {
    requestAnimationFrame(animate);
    render();
    stats.update();
}

function render() {
    const time = performance.now();
    const delta = (time - lastTime) / 5000;
    // let angularFreq = 1.0
    // let periodSec = 0.5
    // let amplitude = 100;
    // let b = 2 * Math.PI / periodSec;
    // let phaseShift = time / 1000;

    dirGroup.rotation.y += 0.7 * delta;
    dirLight.position.z = 17 + Math.sin(time * 0.001) * 5;
    lastTime = time;
    renderer.render(scene, camera);

}
const audioMotion = new AudioMotionAnalyzer(null, {
    source: audioEl,
    mode: 2,
    useCanvas: false, // don't use the canvas
    onCanvasDraw: instance => {
        const maxHeight = container.clientHeight;

        // get analyzer bars data
        if (!freqBinValues) {
            freqBinValues = new Array(instance.getBars().length);
        }
        let barIdx = 0;
        for (const bar of instance.getBars()) {
            freqBinValues[barIdx] = bar.value[0];
            barIdx++;
        }
        updateGrid(freqBinValues);
    }
});

// play stream
document.getElementById('live').addEventListener('click', () => {
    audioEl.src = 'https://icecast2.ufpel.edu.br/live';
    audioEl.play();
});
// file upload
document.getElementById('upload').addEventListener('change', e => {
    const fileBlob = e.target.files[0];

    if (fileBlob) {
        audioEl.src = URL.createObjectURL(fileBlob);
        audioEl.play();
    }
});
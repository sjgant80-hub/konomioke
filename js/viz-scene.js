class VizEngine {
  constructor(audioFabric) {
    this.fabric = audioFabric;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;
    this.enabled = true;

    // Orb components
    this.orbMesh = null;
    this.ringParticles = [];       // 7 particle systems, one per ring
    this.singerClusters = new Map();
    this.fieldLines = [];

    // Uniforms for orb shader
    this._time = 0;
    this._orbMaterial = null;

    // Ring colors
    this._ringColors = [
      new THREE.Color(0xff2244),
      new THREE.Color(0xff8800),
      new THREE.Color(0xffcc00),
      new THREE.Color(0x00ff88),
      new THREE.Color(0x00ccff),
      new THREE.Color(0x4466ff),
      new THREE.Color(0xaa00ff)
    ];

    this._goldColor = new THREE.Color(0xd4af37);
  }

  async boot() {
    this.canvas = document.getElementById('orb-canvas');
    if (!this.canvas || typeof THREE === 'undefined') {
      this.enabled = false;
      return this;
    }

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06060c);
    this.scene.fog = new THREE.FogExp2(0x06060c, 0.015);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 50);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Build the orb
    this._buildOrb();
    this._buildRingParticles();
    this._buildFieldLines();

    // Ambient light
    const ambient = new THREE.AmbientLight(0x222244, 0.5);
    this.scene.add(ambient);

    // Point light at center
    const pointLight = new THREE.PointLight(0xd4af37, 0.5, 100);
    this.scene.add(pointLight);

    // Resize handler
    window.addEventListener('resize', () => this._onResize());

    return this;
  }

  _buildOrb() {

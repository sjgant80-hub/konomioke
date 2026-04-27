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
    // Central orb — semi-transparent sphere with custom shader
    const geometry = new THREE.SphereGeometry(6, 64, 64);

    this._orbMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        vagalTone: { value: 0 },
        coherence: { value: 0 },
        ringValues: { value: [0, 0, 0, 0, 0, 0, 0] },
        ringColors: { value: this._ringColors.map(c => c.clone()) }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        uniform float time;
        uniform float vagalTone;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;

          // Subtle breathing deformation
          float breath = sin(time * 1.5 * (0.5 + vagalTone)) * 0.15 + 1.0;
          vec3 pos = position * breath;

          // Per-vertex noise displacement
          float noise = sin(position.x * 3.0 + time) * sin(position.y * 3.0 + time * 0.7) * 0.2 * vagalTone;
          pos += normal * noise;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float vagalTone;
        uniform float coherence;
        uniform float ringValues[7];
        uniform vec3 ringColors[7];

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          // Fresnel glow
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);

          // Color from ring values
          vec3 color = vec3(0.02, 0.02, 0.04);
          for (int i = 0; i < 7; i++) {
            color += ringColors[i] * ringValues[i] * 0.15;
          }

          // Golden coherence tint
          vec3 gold = vec3(0.83, 0.69, 0.22);
          color = mix(color, gold, coherence * coherence * 0.6);

          // Pulse
          float pulse = 0.6 + 0.4 * sin(time * 2.0 * (0.3 + vagalTone));

          // Internal glow pattern
          float pattern = sin(vUv.x * 20.0 + time * 2.0) * sin(vUv.y * 20.0 + time * 1.5);
          color += vec3(0.03) * pattern * vagalTone;

          float alpha = fresnel * pulse * 0.5 + 0.05;
          gl_FragColor = vec4(color * pulse * 1.5, alpha);
        }
      `
    });

    this.orbMesh = new THREE.Mesh(geometry, this._orbMaterial);
    this.scene.add(this.orbMesh);
  }

  _buildRingParticles() {
    const particlesPerRing = 1400;  // ~10,000 total across 7 rings

    for (let r = 0; r < 7; r++) {
      const radius = 8 + r * 2.5;
      const tubeRadius = 1.0 + r * 0.3;
      const geometry = new THREE.BufferGeometry();

      const positions = new Float32Array(particlesPerRing * 3);
      const colors = new Float32Array(particlesPerRing * 3);
      const sizes = new Float32Array(particlesPerRing);
      const phases = new Float32Array(particlesPerRing); // for animation

      const color = this._ringColors[r];

      for (let i = 0; i < particlesPerRing; i++) {
        const u = (i / particlesPerRing) * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;

        positions[i * 3] = (radius + tubeRadius * Math.cos(v)) * Math.cos(u);
        positions[i * 3 + 1] = (radius + tubeRadius * Math.cos(v)) * Math.sin(u);
        positions[i * 3 + 2] = tubeRadius * Math.sin(v);

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = 0.15 + Math.random() * 0.2;
        phases[i] = Math.random() * Math.PI * 2;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });

      const points = new THREE.Points(geometry, material);
      this.scene.add(points);

      this.ringParticles.push({
        points,
        geometry,
        positions: positions.slice(),  // original positions
        phases,
        radius,
        tubeRadius,
        particleCount: particlesPerRing
      });
    }
  }

  _buildFieldLines() {
    // Toroidal field lines connecting rings
    for (let i = 0; i < 12; i++) {
      const curve = new THREE.CatmullRomCurve3([]);
      const points = [];
      const angle = (i / 12) * Math.PI * 2;

      for (let t = 0; t <= 1; t += 0.05) {
        const r = 8 + t * 17.5;
        const y = Math.sin(t * Math.PI) * 8;
        points.push(new THREE.Vector3(
          r * Math.cos(angle + t * 0.5),
          y,
          r * Math.sin(angle + t * 0.5)
        ));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x1a1a2e,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending
      });

      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.fieldLines.push({ line, material });
    }
  }

  // Add a singer cluster
  addSingerCluster(peerId, colorHex) {
    const count = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const color = new THREE.Color(colorHex);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 12 + Math.random() * 4;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.4,
      color: color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.singerClusters.set(peerId, { points, geometry, positions: positions.slice(), color, orbitAngle: Math.random() * Math.PI * 2 });
  }

  removeSingerCluster(peerId) {
    const cluster = this.singerClusters.get(peerId);
    if (cluster) {
      this.scene.remove(cluster.points);
      cluster.geometry.dispose();
      this.singerClusters.delete(peerId);
    }
  }

  // Main render loop
  update(dt) {
    if (!this.enabled || !this.renderer) return;

    this._time += dt;

    const rings = this.fabric.smoothRings;
    const composite = this.fabric.compositeRings;
    const coherence = this.fabric.coherence;
    const vagalTone = this.fabric.vagalTone;

    // Update orb shader uniforms
    if (this._orbMaterial) {
      this._orbMaterial.uniforms.time.value = this._time;
      this._orbMaterial.uniforms.vagalTone.value = vagalTone;
      this._orbMaterial.uniforms.coherence.value = coherence;
      for (let i = 0; i < 7; i++) {
        this._orbMaterial.uniforms.ringValues.value[i] = composite[i];
      }
    }

    // Update ring particles
    for (let r = 0; r < this.ringParticles.length; r++) {
      const rp = this.ringParticles[r];
      const activity = composite[r];
      const posAttr = rp.geometry.attributes.position;
      const origPositions = rp.positions;

      for (let i = 0; i < rp.particleCount; i++) {
        const phase = rp.phases[i];
        const speed = 0.3 + activity * 2;
        const wobble = activity * 1.5;

        // Orbital motion
        const u = (i / rp.particleCount) * Math.PI * 2 + this._time * speed * 0.1;
        const v = phase + this._time * 0.5;
        const noiseX = Math.sin(phase + this._time * 1.3) * wobble;
        const noiseY = Math.cos(phase + this._time * 0.9) * wobble;
        const noiseZ = Math.sin(phase + this._time * 1.1) * wobble;

        posAttr.array[i * 3] = origPositions[i * 3] * (1 + activity * 0.1) + noiseX;
        posAttr.array[i * 3 + 1] = origPositions[i * 3 + 1] * (1 + activity * 0.1) + noiseY;
        posAttr.array[i * 3 + 2] = origPositions[i * 3 + 2] + noiseZ;
      }
      posAttr.needsUpdate = true;

      // Opacity follows activity
      rp.points.material.opacity = 0.15 + activity * 0.7;
    }

    // Update singer clusters
    for (const [pid, cluster] of this.singerClusters) {
      cluster.orbitAngle += dt * 0.3;
      const peerRings = this.fabric.peerAnalysers.get(pid);
      const activity = peerRings ? peerRings.rings[0] : 0.1;
      const posAttr = cluster.geometry.attributes.position;

      for (let i = 0; i < posAttr.count; i++) {
        const baseR = 12 + activity * 6;
        const theta = (i / posAttr.count) * Math.PI * 2 + cluster.orbitAngle;
        const phi = cluster.positions[i * 3 + 2] / 16 * Math.PI;
        const wobble = Math.sin(this._time * 2 + i * 0.1) * activity * 2;

        posAttr.array[i * 3] = (baseR + wobble) * Math.sin(phi) * Math.cos(theta);
        posAttr.array[i * 3 + 1] = (baseR + wobble) * Math.sin(phi) * Math.sin(theta);
        posAttr.array[i * 3 + 2] = (baseR + wobble) * Math.cos(phi);
      }
      posAttr.needsUpdate = true;

      // Coherence golden flash
      if (coherence > 0.618) {
        cluster.points.material.color.lerp(this._goldColor, (coherence - 0.618) * 2.6);
      } else {
        cluster.points.material.color.lerp(cluster.color, 0.1);
      }
    }

    // Update field lines
    for (const fl of this.fieldLines) {
      fl.material.opacity = 0.05 + vagalTone * 0.15;
      if (coherence > 0.618) {
        fl.material.color.lerp(this._goldColor, 0.05);
      } else {
        fl.material.color.set(0x1a1a2e);
      }
    }

    // Camera gentle sway
    this.camera.position.x = Math.sin(this._time * 0.1) * 3;
    this.camera.position.y = Math.cos(this._time * 0.07) * 2;
    this.camera.lookAt(0, 0, 0);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && this.renderer) {
      this.renderer.clear();
    }
  }
}

// ─────────────────────────────────────────────────────────
// p=17  LAUNCHER — Boot sequence, UI, the stage
// ─────────────────────────────────────────────────────────

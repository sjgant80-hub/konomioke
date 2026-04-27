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

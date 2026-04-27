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


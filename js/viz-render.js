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

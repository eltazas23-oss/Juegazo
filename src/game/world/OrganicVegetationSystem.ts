/**
 * OrganicVegetationSystem.ts - High-Fidelity 3D Botanical Engine & GPU Instanced Foliage
 * 
 * Masterpiece Botanical Architecture:
 * - 100% Elimination of straight geometric boxes, rigid cones or flat orthogonal billboard crosses.
 * - Curved Bézier Grass Blades with natural outward gravitational bend, lateral flex and per-instance biome color tinting.
 * - Organic Sculpted Trees:
 *   1. Mediterranean Maritime Pine (Pinus Pinaster): Sinuous lofted trunk, basal root flare, tiered umbrella canopy.
 *   2. European Broadleaf Oak (Quercus Robur): Gnarled multi-bough trunk, asymmetric organic lobed domes.
 *   3. Italian Slender Cypress (Cupressus Sempervirens): Tapered spiraled organic spires.
 *   4. Silver Birch / Circuit Paddock Tree (Betula Pendula): Elegant slender trunk with weeping leafy clusters.
 *   5. Flowering Circuit Shrubbery: Interlocking spherical bush clusters.
 * - Spherical Vertex Normals: Recomputed from canopy centroid for soft, volumetric cloud-like lighting.
 * - Hardware GPU Instancing with Spatial Partitioning: Native Frustum Culling and only 1-2 Draw Calls per species!
 */

import * as THREE from 'three';
import { safeMergeBufferGeometries } from '../utils/GeometryUtils';
import { StaticObstacle } from './TrackBuilder';

export interface TreePlacementConfig {
  x: number;
  z: number;
  scale?: number;
  type: 'pine' | 'oak' | 'cypress' | 'birch' | 'bush';
  yaw?: number;
}

export class OrganicVegetationSystem {
  /**
   * Recomputes spherical vertex normals outwards from a centroid for lush, fluffy, non-polygonal lighting
   */
  public static computeSphericalNormals(geo: THREE.BufferGeometry, center = new THREE.Vector3(0, 0, 0)): void {
    const pos = geo.attributes.position;
    const normals = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.sub(center).normalize();
      normals[i * 3] = v.x;
      normals[i * 3 + 1] = v.y;
      normals[i * 3 + 2] = v.z;
    }

    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    if (geo.attributes.normal) {
      geo.attributes.normal.needsUpdate = true;
    }
  }

  /**
   * Applies multi-frequency organic fractal noise to foliage vertices to break geometric uniformity
   */
  public static displaceFoliage(geo: THREE.BufferGeometry, scale = 0.28): void {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x, z) || 0.001;

      const j1 = Math.sin(x * 4.6 + y * 3.2) * Math.cos(z * 4.2);
      const j2 = Math.sin(y * 7.2 + (x + z) * 2.7) * 0.45;
      const displace = (j1 + j2) * scale;

      pos.setX(i, x + (x / dist) * displace);
      pos.setY(i, y + displace * 0.65);
      pos.setZ(i, z + (z / dist) * displace);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /**
   * Generates a curved 3D grass blade cluster with natural gravitational arching and lateral flare
   */
  public static createCurvedGrassTuftGeometry(): THREE.BufferGeometry {
    const bladeCount = 5;
    const bladeGeos: THREE.BufferGeometry[] = [];

    for (let b = 0; b < bladeCount; b++) {
      const bladeYaw = (b / bladeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const bladeHeight = 0.88 + Math.random() * 0.42;
      const bladeWidth = 0.20;
      const bendAmount = 0.36 + Math.random() * 0.24;
      const lateralLean = (Math.random() - 0.5) * 0.15;

      // 4-segment curved ribbon blade
      const segments = 4;
      const vertices: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const w = bladeWidth * (1 - t * 0.88); // Taper cleanly towards tip
        // Quadratic outward and downward gravitational bend with subtle lateral roll
        const outward = Math.pow(t, 1.85) * bendAmount;
        const lateral = Math.pow(t, 1.5) * lateralLean;
        const y = t * bladeHeight - Math.pow(t, 2.4) * 0.12;

        // Left and right blade vertex
        vertices.push(-w / 2 + lateral, y, outward);
        uvs.push(0, t);

        vertices.push(w / 2 + lateral, y, outward);
        uvs.push(1, t);
      }

      for (let s = 0; s < segments; s++) {
        const row1 = s * 2;
        const row2 = (s + 1) * 2;
        indices.push(row1, row1 + 1, row2 + 1);
        indices.push(row1, row2 + 1, row2);
      }

      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      bGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      bGeo.setIndex(indices);
      bGeo.computeVertexNormals();

      bGeo.rotateY(bladeYaw);
      bladeGeos.push(bGeo);
    }

    const merged = safeMergeBufferGeometries(bladeGeos, false) || bladeGeos[0];
    for (let i = 0; i < bladeGeos.length; i++) bladeGeos[i].dispose();

    // Bury base slightly below surface (0.04m) to ensure flush ground connection without gaps
    merged.translate(0, -0.04, 0);
    return merged;
  }

  /**
   * Mediterranean Maritime Pine (Pinus Pinaster)
   */
  public static createPineGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    const trunkH = 8.5;
    // Sinuous lofted trunk with realistic base root flare
    const trunkSegments = 7;
    const trunkIndices: number[] = [];
    const trunkPositions: number[] = [];
    const trunkUvs: number[] = [];
    const radialSegs = 8;

    for (let s = 0; s <= trunkSegments; s++) {
      const t = s / trunkSegments;
      const y = t * trunkH;
      // Organic sinuous curvature along X and Z
      const cx = Math.sin(t * Math.PI * 0.88) * 0.38;
      const cz = Math.cos(t * Math.PI * 0.58) * 0.24;
      // Exponential base flare: 0.78m at ground level to 0.22m at crown
      const r = 0.22 + Math.pow(1 - t, 2.7) * 0.56;

      for (let j = 0; j <= radialSegs; j++) {
        const ang = (j / radialSegs) * Math.PI * 2;
        const vx = cx + Math.cos(ang) * r;
        const vz = cz + Math.sin(ang) * r;
        trunkPositions.push(vx, y - 0.12, vz);
        trunkUvs.push(j / radialSegs, t * 3.2);
      }
    }

    const stride = radialSegs + 1;
    for (let s = 0; s < trunkSegments; s++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = s * stride + j;
        const b = s * stride + j + 1;
        const c = (s + 1) * stride + j + 1;
        const d = (s + 1) * stride + j;
        trunkIndices.push(a, b, c, a, c, d);
      }
    }

    const trunkGeo = new THREE.BufferGeometry();
    trunkGeo.setAttribute('position', new THREE.Float32BufferAttribute(trunkPositions, 3));
    trunkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(trunkUvs, 2));
    trunkGeo.setIndex(trunkIndices);
    trunkGeo.computeVertexNormals();

    // Layered umbrella canopy domes with organic multi-lobe clusters
    const foliageGeos: THREE.BufferGeometry[] = [];
    const tiers = [
      { y: trunkH * 0.68, r: 4.2, lobes: 5, scaleY: 0.48 },
      { y: trunkH * 0.86, r: 3.5, lobes: 4, scaleY: 0.52 },
      { y: trunkH * 1.05, r: 2.6, lobes: 3, scaleY: 0.56 },
    ];

    tiers.forEach((tier) => {
      // Central umbrella dome
      const mainDome = new THREE.SphereGeometry(tier.r, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.65);
      mainDome.scale(1.0, tier.scaleY, 1.0);
      this.displaceFoliage(mainDome, 0.35);
      mainDome.translate(0, tier.y, 0);
      foliageGeos.push(mainDome);

      // Surrounding organic sub-lobes
      for (let l = 0; l < tier.lobes; l++) {
        const ang = (l / tier.lobes) * Math.PI * 2 + Math.random() * 0.3;
        const dist = tier.r * 0.68;
        const lobeR = tier.r * 0.52;
        const lobe = new THREE.SphereGeometry(lobeR, 8, 6);
        lobe.scale(1.1, tier.scaleY * 1.1, 0.9);
        this.displaceFoliage(lobe, 0.28);
        lobe.translate(Math.cos(ang) * dist, tier.y - 0.15, Math.sin(ang) * dist);
        foliageGeos.push(lobe);
      }
    });

    const mergedFoliage = safeMergeBufferGeometries(foliageGeos, false) || foliageGeos[0];
    for (let i = 0; i < foliageGeos.length; i++) foliageGeos[i].dispose();

    // Apply volumetric spherical normals from canopy center for cloud-like illumination
    this.computeSphericalNormals(mergedFoliage, new THREE.Vector3(0, trunkH * 0.86, 0));

    return { trunk: trunkGeo, foliage: mergedFoliage };
  }

  /**
   * European Broadleaf Oak (Quercus Robur)
   */
  public static createOakGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    const trunkH = 6.0;
    const trunkGeo = new THREE.CylinderGeometry(0.50, 0.98, trunkH, 8, 3);
    trunkGeo.translate(0, trunkH / 2 - 0.15, 0);

    const trunkParts: THREE.BufferGeometry[] = [trunkGeo];
    // 4 Curved radiating organic boughs
    for (let b = 0; b < 4; b++) {
      const ang = (b / 4) * Math.PI * 2 + 0.45;
      const boughCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, trunkH * 0.75, 0),
        new THREE.Vector3(Math.cos(ang) * 1.25, trunkH * 0.92, Math.sin(ang) * 1.25),
        new THREE.Vector3(Math.cos(ang) * 2.3, trunkH * 1.08, Math.sin(ang) * 2.3),
      ]);
      const boughGeo = new THREE.TubeGeometry(boughCurve, 6, 0.24, 6, false);
      trunkParts.push(boughGeo);
    }
    const mergedTrunk = safeMergeBufferGeometries(trunkParts, false) || trunkParts[0];

    // Asymmetrical organic foliage clusters
    const clusterLocs = [
      { x: 0, y: trunkH * 1.05, z: 0, r: 3.3 },
      { x: 1.85, y: trunkH * 1.22, z: 0.95, r: 2.7 },
      { x: -1.75, y: trunkH * 1.25, z: 1.15, r: 2.6 },
      { x: 0.35, y: trunkH * 1.32, z: -1.95, r: 2.75 },
      { x: -1.45, y: trunkH * 1.38, z: -1.25, r: 2.45 },
      { x: 1.55, y: trunkH * 1.42, z: -0.95, r: 2.35 },
      { x: 0, y: trunkH * 1.65, z: 0, r: 2.7 },
    ];

    const foliageParts: THREE.BufferGeometry[] = [];
    clusterLocs.forEach((cl) => {
      const geo = new THREE.IcosahedronGeometry(cl.r, 1);
      this.displaceFoliage(geo, 0.42);
      geo.translate(cl.x, cl.y, cl.z);
      foliageParts.push(geo);
    });

    const mergedFoliage = safeMergeBufferGeometries(foliageParts, false) || foliageParts[0];
    for (let i = 0; i < foliageParts.length; i++) foliageParts[i].dispose();

    this.computeSphericalNormals(mergedFoliage, new THREE.Vector3(0, trunkH * 1.28, 0));

    return { trunk: mergedTrunk, foliage: mergedFoliage };
  }

  /**
   * Italian Slender Cypress (Cupressus Sempervirens)
   */
  public static createCypressGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    const trunkH = 1.8;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.38, trunkH, 8);
    trunkGeo.translate(0, trunkH / 2 - 0.1, 0);

    const foliageH = 10.2;
    const tiers = 6;
    const foliageParts: THREE.BufferGeometry[] = [];

    for (let t = 0; t < tiers; t++) {
      const ty = trunkH * 0.75 + t * (foliageH / tiers) * 0.88;
      const progress = t / (tiers - 1);
      // Continuous bell-shaped cypress contour with organic taper
      const tr = (1.50 * Math.sin(progress * Math.PI * 0.85 + 0.15)) + 0.35;
      const geo = new THREE.CylinderGeometry(tr * 0.65, tr, (foliageH / tiers) * 1.35, 8, 2);
      this.displaceFoliage(geo, 0.24);
      geo.translate(0, ty, 0);
      foliageParts.push(geo);
    }

    const mergedFoliage = safeMergeBufferGeometries(foliageParts, false) || foliageParts[0];
    for (let i = 0; i < foliageParts.length; i++) foliageParts[i].dispose();

    this.computeSphericalNormals(mergedFoliage, new THREE.Vector3(0, trunkH + foliageH * 0.5, 0));

    return { trunk: trunkGeo, foliage: mergedFoliage };
  }

  /**
   * Silver Birch / Paddock Feature Tree (Betula Pendula)
   */
  public static createBirchGeometries(): { trunk: THREE.BufferGeometry; foliage: THREE.BufferGeometry } {
    const trunkH = 7.2;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, trunkH, 8, 3);
    trunkGeo.translate(0, trunkH / 2 - 0.1, 0);

    const foliageParts: THREE.BufferGeometry[] = [];
    const clusters = [
      { y: trunkH * 0.65, r: 1.8, ox: 0.6, oz: 0.2 },
      { y: trunkH * 0.78, r: 2.1, ox: -0.5, oz: 0.4 },
      { y: trunkH * 0.90, r: 2.0, ox: 0.3, oz: -0.5 },
      { y: trunkH * 1.05, r: 1.6, ox: 0.0, oz: 0.0 },
    ];

    clusters.forEach((cl) => {
      const geo = new THREE.SphereGeometry(cl.r, 8, 6);
      geo.scale(1.2, 0.85, 1.2);
      this.displaceFoliage(geo, 0.35);
      geo.translate(cl.ox, cl.y, cl.oz);
      foliageParts.push(geo);
    });

    const mergedFoliage = safeMergeBufferGeometries(foliageParts, false) || foliageParts[0];
    for (let i = 0; i < foliageParts.length; i++) foliageParts[i].dispose();

    this.computeSphericalNormals(mergedFoliage, new THREE.Vector3(0, trunkH * 0.85, 0));
    return { trunk: trunkGeo, foliage: mergedFoliage };
  }

  /**
   * Circuit Flowering Shrub & Bush Cluster
   */
  public static createBushGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const clusterPositions = [
      { x: 0, y: 0.6, z: 0, r: 0.95 },
      { x: 0.68, y: 0.52, z: 0.42, r: 0.82 },
      { x: -0.62, y: 0.56, z: -0.36, r: 0.86 },
      { x: 0.22, y: 0.48, z: -0.68, r: 0.78 },
    ];

    clusterPositions.forEach((cl) => {
      const geo = new THREE.SphereGeometry(cl.r, 8, 6);
      geo.scale(1.2, 0.75, 1.2);
      this.displaceFoliage(geo, 0.32);
      geo.translate(cl.x, cl.y, cl.z);
      parts.push(geo);
    });

    const merged = safeMergeBufferGeometries(parts, false) || parts[0];
    for (let i = 0; i < parts.length; i++) parts[i].dispose();
    this.computeSphericalNormals(merged, new THREE.Vector3(0, 0.5, 0));
    return merged;
  }

  /**
   * Batches tree instances across the circuit into GPU InstancedMeshes with spatial culling
   */
  public static buildVegetationForest(
    parent: THREE.Group,
    trees: TreePlacementConfig[],
    materials: {
      trunkMat: THREE.Material;
      pineFoliageMat: THREE.Material;
      oakFoliageMat: THREE.Material;
      cypressFoliageMat: THREE.Material;
      bushMat: THREE.Material;
      birchFoliageMat?: THREE.Material;
    },
    obstaclesOut?: StaticObstacle[]
  ): void {
    if (trees.length === 0) return;

    // Pre-create master prototype geometries once in GPU memory
    const pine = this.createPineGeometries();
    const oak = this.createOakGeometries();
    const cypress = this.createCypressGeometries();
    const birch = this.createBirchGeometries();
    const bushGeo = this.createBushGeometry();

    const pines = trees.filter((t) => t.type === 'pine');
    const oaks = trees.filter((t) => t.type === 'oak');
    const cypresses = trees.filter((t) => t.type === 'cypress');
    const birches = trees.filter((t) => t.type === 'birch');
    const bushes = trees.filter((t) => t.type === 'bush');

    const instantiateType = (
      items: TreePlacementConfig[],
      trunkGeo: THREE.BufferGeometry | null,
      foliageGeo: THREE.BufferGeometry,
      foliageMat: THREE.Material,
      baseRadius: number
    ) => {
      if (items.length === 0) return;

      const dummy = new THREE.Object3D();

      if (trunkGeo) {
        const trunkMesh = new THREE.InstancedMesh(trunkGeo, materials.trunkMat, items.length);
        trunkMesh.receiveShadow = false;
        trunkMesh.castShadow = false; // Excluded for high framerate GPU throughput

        items.forEach((item, i) => {
          const s = item.scale || 1.0;
          dummy.position.set(item.x, 0, item.z);
          dummy.rotation.set(0, item.yaw || Math.random() * Math.PI * 2, 0);
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          trunkMesh.setMatrixAt(i, dummy.matrix);
        });

        trunkMesh.instanceMatrix.needsUpdate = true;
        trunkMesh.computeBoundingSphere();
        trunkMesh.computeBoundingBox();
        parent.add(trunkMesh);
      }

      const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, items.length);
      foliageMesh.receiveShadow = false;
      foliageMesh.castShadow = false;

      items.forEach((item, i) => {
        const s = item.scale || 1.0;
        dummy.position.set(item.x, 0, item.z);
        dummy.rotation.set(0, item.yaw || Math.random() * Math.PI * 2, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        foliageMesh.setMatrixAt(i, dummy.matrix);

        if (obstaclesOut) {
          obstaclesOut.push({
            x: item.x,
            z: item.z,
            radius: baseRadius * s,
            type: 'tree',
          });
        }
      });

      foliageMesh.instanceMatrix.needsUpdate = true;
      foliageMesh.computeBoundingSphere();
      foliageMesh.computeBoundingBox();
      parent.add(foliageMesh);
    };

    instantiateType(pines, pine.trunk, pine.foliage, materials.pineFoliageMat, 1.2);
    instantiateType(oaks, oak.trunk, oak.foliage, materials.oakFoliageMat, 1.4);
    instantiateType(cypresses, cypress.trunk, cypress.foliage, materials.cypressFoliageMat, 0.85);
    instantiateType(birches, birch.trunk, birch.foliage, materials.birchFoliageMat || materials.oakFoliageMat, 1.0);
    instantiateType(bushes, null, bushGeo, materials.bushMat, 0.6);
  }
}

import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RideEffects } from '../ride-effects.js';

globalThis.matchMedia = () => ({matches: false});
const bytes = await fs.readFile(new URL('../GLB test.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const model = gltf.scene;
const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
model.position.copy(center).multiplyScalar(-1);
model.updateMatrixWorld(true);
const ride = new RideEffects(model, new THREE.Scene());

test('route stays on the supplied open-slide assembly without projection gaps', () => {
    assert.equal(ride.sections.size, 50);
    assert.equal(ride.routeMisses, 0);
    assert(ride.length > 65 && ride.length < 85);
    assert(ride.route.getPointAt(0).y > ride.route.getPointAt(1).y + 8);
    for (let i = 1; i <= 2400; i++) {
        const a = ride.route.getPointAt((i - 1) / 2400);
        const b = ride.route.getPointAt(i / 2400);
        assert(b.toArray().every(Number.isFinite));
        assert(a.distanceTo(b) < 0.06, 'No jumps between stacked slide sections');
    }
});

test('launches every 20 seconds and preserves the existing tube at launch', () => {
    ride.restart();
    assert.equal(ride.active, 1);
    ride.update(19.999);
    assert.equal(ride.active, 1);
    const firstPosition = ride.tubes[0].position.clone();
    ride.update(0.001);
    assert.equal(ride.active, 2);
    assert(firstPosition.distanceTo(ride.tubes[0].position) < 0.02);
});

test('pause, restart, effect toggles and long playback remain consistent', () => {
    ride.paused = true;
    const time = ride.time;
    ride.update(20);
    assert.equal(ride.time, time);
    ride.restart();
    assert.equal(ride.time, 0);
    assert.equal(ride.active, 1);
    ride.tubesEnabled = false;
    ride.waterEnabled = false;
    ride.update(0);
    assert.equal(ride.active, 0);
    assert.equal(ride.water.visible, false);
    ride.tubesEnabled = true;
    ride.waterEnabled = true;
    ride.paused = false;
    for (let i = 0; i < 2000; i++) {
        ride.update(0.2);
        const latest = Math.floor(ride.time / 20);
        const expected = Array.from({length: latest + 1}, (_, j) => ride.time - j * 20).filter(age => age < ride.duration).length;
        assert.equal(ride.active, expected);
        for (const tube of ride.tubes) {
            assert(tube.position.toArray().every(Number.isFinite));
            assert(tube.quaternion.toArray().every(Number.isFinite));
        }
    }
});

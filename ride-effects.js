import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const LAUNCH_INTERVAL = 20;

// The AB assembly numbers in this KeyShot export run from the exit (1)
// to the loading platform (50). Keep the route tied to the source geometry.
export class RideEffects {
    constructor(model, scene) {
        this.group = new THREE.Group();
        this.group.name = 'Water and tube preview';
        scene.add(this.group);
        this.time = 0;
        this.paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.follow = false;
        this.tubesEnabled = true;
        this.waterEnabled = true;
        this.ray = new THREE.Raycaster();
        const sections = new Map();
        model.updateMatrixWorld(true);
        model.traverse(mesh => {
            if (!mesh.isMesh || !mesh.name.startsWith('WWI-FRP-SP-AB')) return;
            const match = mesh.parent.name.match(/AB\((\d+)\)/);
            if (!match) return;
            const id = Number(match[1]);
            if (!sections.has(id)) sections.set(id, []);
            sections.get(id).push(mesh);
        });
        if (sections.size < 40) throw new Error('The open slide assembly could not be identified.');
        this.sections = sections;
        this.anchors = [...sections.entries()].sort((a, b) => b[0] - a[0]).map(([id, meshes]) => {
            // Extension panels rise above the trough: choose the lowest component.
            const candidates = meshes.map(mesh => ({mesh, box: new THREE.Box3().setFromObject(mesh)}));
            candidates.sort((a, b) => {
                if (id === 50) return b.mesh.geometry.attributes.position.count - a.mesh.geometry.attributes.position.count;
                return a.box.getCenter(new THREE.Vector3()).y - b.box.getCenter(new THREE.Vector3()).y;
            });
            const box = candidates[0].box;
            const point = box.getCenter(new THREE.Vector3());
            point.y = this.floorAt(point, meshes, point.y).y;
            return {id, point};
        });
        // Stop before the exit's end cap; begin at the open entry tray.
        this.anchors.pop();
        const last = this.anchors.at(-1).point.clone();
        last.x += 0.55;
        this.anchors.push({id: 2, point: last});
        const guide = new THREE.CatmullRomCurve3(this.anchors.map(a => a.point), false, 'centripetal');
        const count = 1200;
        const centers = [];
        const edges = [];
        let misses = 0;
        for (let i = 0; i <= count; i++) {
            const t = i / count;
            const p = guide.getPoint(t);
            const anchor = Math.min(this.anchors.length - 1, Math.round(t * (this.anchors.length - 1)));
            const nearby = this.anchors.slice(Math.max(0, anchor - 1), anchor + 2).flatMap(a => sections.get(a.id));
            const hit = this.floorAt(p, nearby, p.y);
            if (!hit.found) misses++;
            p.y = hit.y + 0.025;
            const tangent = guide.getTangent(t);
            const side = new THREE.Vector3().crossVectors(tangent, UP).normalize();
            centers.push(p);
            edges.push([-1, 1].map(sign => {
                const edge = p.clone().addScaledVector(side, sign * 0.22);
                edge.y = this.floorAt(edge, nearby, p.y).y + 0.045;
                return edge;
            }));
        }
        // Smooth export seams for tube motion; the water retains surface contact.
        const smooth = centers.map((p, i) => {
            const result = new THREE.Vector3();
            let weight = 0;
            for (let j = Math.max(0, i - 5); j <= Math.min(count, i + 5); j++) {
                const w = 6 - Math.abs(i - j);
                result.addScaledVector(centers[j], w);
                weight += w;
            }
            return i === 0 || i === count ? p.clone() : result.divideScalar(weight);
        });
        this.route = new THREE.CatmullRomCurve3(smooth, false, 'centripetal');
        this.surfaceNormals = edges.map((pair, i) => {
            const across = pair[1].clone().sub(pair[0]).normalize();
            const tangent = this.route.getTangent(i / count);
            const normal = new THREE.Vector3().crossVectors(across, tangent).normalize();
            if (normal.y < 0) normal.negate();
            return normal;
        });
        this.route.arcLengthDivisions = 2400;
        this.length = this.route.getLength();
        this.duration = this.length / 3.2;
        this.routeMisses = misses;
        this.makeWater(centers, edges);
        this.makeTubes();
        this.update(0);
    }

    floorAt(point, meshes, expectedY) {
        this.ray.set(new THREE.Vector3(point.x, expectedY + 1.5, point.z), new THREE.Vector3(0, -1, 0));
        this.ray.far = 3;
        const hits = this.ray.intersectObjects(meshes, false).filter(hit => Math.abs(hit.point.y - expectedY) < 1.2);
        if (!hits.length) return {y: expectedY, found: false};
        // At a fixed X/Z the upper face of the floor is the visible water contact.
        return {y: hits[0].point.y, found: true};
    }

    makeWater(centers, edges) {
        const vertices = [], uv = [], indices = [];
        let distance = 0;
        for (let i = 0; i < centers.length; i++) {
            if (i) distance += centers[i].distanceTo(centers[i - 1]);
            for (const sign of [-1, 1]) {
                const p = edges[i][(sign + 1) / 2];
                vertices.push(p.x, p.y, p.z);
                uv.push((sign + 1) / 2, distance);
            }
            if (i < centers.length - 1) {
                const j = i * 2;
                indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        this.waterMaterial = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, side: THREE.DoubleSide,
            uniforms: {time: {value: 0}},
            vertexShader: `varying vec2 vUv;
                void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
            fragmentShader: `uniform float time; varying vec2 vUv;
                void main(){
                    float flow=vUv.y-time*2.4;
                    float ripple=sin(flow*13.0+sin(vUv.x*7.0+flow*0.6)*1.4)*0.5+0.5;
                    float streak=pow(max(0.0,sin(vUv.x*48.0+sin(flow*1.8))),12.0);
                    float foam=pow(ripple,18.0)*0.24+streak*0.12;
                    float edge=smoothstep(0.0,0.12,vUv.x)*smoothstep(0.0,0.12,1.0-vUv.x);
                    vec3 color=mix(vec3(0.04,0.54,0.69),vec3(0.85,0.98,1.0),foam);
                    gl_FragColor=vec4(color,(0.48+foam*0.4)*edge);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }`
        });
        this.water = new THREE.Mesh(geometry, this.waterMaterial);
        this.water.renderOrder = 1;
        this.group.add(this.water);
    }

    makeTubes() {
        const geometry = new THREE.TorusGeometry(0.25, 0.095, 12, 36);
        geometry.rotateX(Math.PI / 2);
        const handleGeometry = new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI);
        const handleMaterial = new THREE.MeshStandardMaterial({color: 0x243245, roughness: 0.75});
        this.tubes = Array.from({length: Math.ceil(this.duration / LAUNCH_INTERVAL) + 1}, (_, i) => {
            const group = new THREE.Group();
            const ring = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: [0xffc542, 0xff7957, 0xf5edc5][i % 3], roughness: 0.35, metalness: 0.03}));
            ring.castShadow = true;
            group.add(ring);
            for (const sign of [-1, 1]) {
                const handle = new THREE.Mesh(handleGeometry, handleMaterial);
                handle.position.set(sign * 0.25, 0.09, 0);
                group.add(handle);
            }
            this.group.add(group);
            return group;
        });
    }

    update(dt) {
        if (!this.paused) this.time += dt;
        this.water.visible = this.waterEnabled;
        this.waterMaterial.uniforms.time.value = this.time;
        const latest = Math.floor(this.time / LAUNCH_INTERVAL);
        let active = 0;
        this.lead = null;
        this.tubes.forEach((tube, slot) => {
            const launch = latest - ((latest - slot) % this.tubes.length + this.tubes.length) % this.tubes.length;
            const age = this.time - launch * LAUNCH_INTERVAL;
            tube.visible = this.tubesEnabled && launch >= 0 && age < this.duration;
            if (!tube.visible) return;
            active++;
            // Gentle acceleration from the loading tray and braking in the runout.
            const t = age / this.duration;
            const u = t - Math.sin(2 * Math.PI * t) * 0.075;
            const p = this.route.getPointAt(u);
            const tangent = this.route.getTangentAt(u).normalize();
            const routeT = this.route.getUtoTmapping(u);
            const normalIndex = routeT * (this.surfaceNormals.length - 1);
            const low = Math.floor(normalIndex), high = Math.min(low + 1, this.surfaceNormals.length - 1);
            const surfaceUp = this.surfaceNormals[low].clone().lerp(this.surfaceNormals[high], normalIndex - low).normalize();
            const right = new THREE.Vector3().crossVectors(surfaceUp, tangent).normalize();
            const normal = new THREE.Vector3().crossVectors(tangent, right).normalize();
            tube.position.copy(p).addScaledVector(normal, 0.13);
            tube.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, normal, tangent));
            if (!this.lead || age > this.lead.age) this.lead = {position: tube.position.clone(), age};
        });
        this.active = active;
        this.nextLaunch = LAUNCH_INTERVAL - this.time % LAUNCH_INTERVAL;
    }

    restart() { this.time = 0; this.update(0); }
}

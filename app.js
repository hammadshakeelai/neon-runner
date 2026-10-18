/*
 * Neon Runner — an original cyberpunk-styled WebGL2 driving sandbox.
 * No external dependencies. No commercial game assets. Not affiliated
 * with any game studio. Everything here is generated procedurally.
 */
"use strict";

(function () {
  const canvas = document.getElementById("gl");
  const speedEl = document.getElementById("speed");
  const gl = canvas.getContext("webgl2", {
    antialias: true,
    powerPreference: "high-performance",
  });

  if (!gl) {
    document.getElementById("fallback").style.display = "grid";
    return;
  }

  /* ------------------------------------------------------------------ */
  /* Minimal column-major 4x4 matrix math                               */
  /* ------------------------------------------------------------------ */

  function identity(m) {
    m.fill(0);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  }

  function perspective(m, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    m.fill(0);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) * nf;
    m[11] = -1;
    m[14] = 2 * far * near * nf;
    return m;
  }

  function lookAt(m, eye, center, up) {
    let z0 = eye[0] - center[0];
    let z1 = eye[1] - center[1];
    let z2 = eye[2] - center[2];
    let len = 1 / Math.hypot(z0, z1, z2);
    z0 *= len; z1 *= len; z2 *= len;

    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    if (len === 0) {
      x0 = 0; x1 = 0; x2 = 0;
    } else {
      len = 1 / len; x0 *= len; x1 *= len; x2 *= len;
    }

    let y0 = z1 * x2 - z2 * x1;
    let y1 = z2 * x0 - z0 * x2;
    let y2 = z0 * x1 - z1 * x0;

    m[0] = x0; m[1] = y0; m[2] = z0; m[3] = 0;
    m[4] = x1; m[5] = y1; m[6] = z1; m[7] = 0;
    m[8] = x2; m[9] = y2; m[10] = z2; m[11] = 0;
    m[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    m[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    m[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    m[15] = 1;
    return m;
  }

  function multiply(out, a, b) {
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  function fromYRotation(m, angle, x, y, z) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    m[0] = c;  m[1] = 0; m[2] = -s; m[3] = 0;
    m[4] = 0;  m[5] = 1; m[6] = 0;  m[7] = 0;
    m[8] = s;  m[9] = 0; m[10] = c; m[11] = 0;
    m[12] = x; m[13] = y; m[14] = z; m[15] = 1;
    return m;
  }

  /* ------------------------------------------------------------------ */
  /* Shaders                                                            */
  /* ------------------------------------------------------------------ */

  const CITY_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec3 aColor;
uniform mat4 uViewProj;
uniform mat4 uModel;
out vec3 vNormal;
out vec2 vUV;
out vec3 vColor;
out vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vColor = aColor;
  gl_Position = uViewProj * world;
}`;

  const CITY_FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUV;
in vec3 vColor;
in vec3 vWorld;
uniform vec3 uCam;
uniform vec3 uFog;
out vec4 frag;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 col = vec3(0.015, 0.015, 0.03);
  float roof = step(0.6, abs(vNormal.y));
  if (roof < 0.5) {
    vec2 uv = vUV * vec2(0.4, 0.55);
    vec2 cells = floor(uv);
    vec2 f = fract(uv);
    float frame = step(0.10, f.x) * step(f.x, 0.84) * step(0.16, f.y) * step(f.y, 0.72);
    float on = step(0.55, hash(cells));
    vec3 neon = mix(vec3(1.0, 0.1, 0.75), vec3(0.1, 0.9, 1.0), hash(cells + 7.0));
    col += frame * on * neon * 1.6;
  }
  float diff = max(dot(normalize(vNormal), normalize(vec3(0.4, 0.85, 0.35))), 0.0);
  col += vColor * diff * 0.22;
  float dist = length(vWorld - uCam);
  col = mix(col, uFog, clamp(1.0 - exp(-dist * 0.011), 0.0, 1.0));
  frag = vec4(col, 1.0);
}`;

  const CAR_FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUV;
in vec3 vColor;
in vec3 vWorld;
uniform vec3 uCam;
uniform vec3 uFog;
out vec4 frag;
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, normalize(vec3(0.45, 0.85, 0.3))), 0.0);
  float rim = pow(1.0 - max(dot(n, normalize(uCam - vWorld)), 0.0), 2.0);
  vec3 col = vColor * (0.3 + diff * 0.8);
  col += vec3(0.10, 0.85, 1.0) * rim * 0.55;
  float dist = length(vWorld - uCam);
  col = mix(col, uFog, clamp(1.0 - exp(-dist * 0.011), 0.0, 1.0));
  frag = vec4(col, 1.0);
}`;

  const GROUND_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uViewProj;
out vec3 vWorld;
void main() {
  vWorld = aPos;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

  const GROUND_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
uniform vec3 uCam;
uniform vec3 uFog;
out vec4 frag;
float grid(vec2 p, float s) {
  vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s);
  return 1.0 - min(min(g.x, g.y), 1.0);
}
void main() {
  vec2 xz = vWorld.xz;
  float minor = grid(xz, 4.0);
  float major = grid(xz, 20.0);
  vec3 col = vec3(0.012, 0.008, 0.02);
  col += vec3(0.15, 0.70, 1.0) * minor * 0.35;
  col += vec3(1.0, 0.12, 0.70) * major * 0.90;
  float dist = length(vWorld - uCam);
  col = mix(col, uFog, clamp(1.0 - exp(-dist * 0.011), 0.0, 1.0));
  frag = vec4(col, 1.0);
}`;

  function compile(type, source) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
    }
    return sh;
  }

  function link(vsSource, fsSource, attribs) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
    attribs.forEach((name, i) => gl.bindAttribLocation(prog, i, name));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "program link failed");
    }
    return prog;
  }

  const cityProgram = link(CITY_VS, CITY_FS, ["aPos", "aNormal", "aUV", "aColor"]);
  const carProgram = link(CITY_VS, CAR_FS, ["aPos", "aNormal", "aUV", "aColor"]);
  const groundProgram = link(GROUND_VS, GROUND_FS, ["aPos"]);

  const cityU = {
    viewProj: gl.getUniformLocation(cityProgram, "uViewProj"),
    model: gl.getUniformLocation(cityProgram, "uModel"),
    cam: gl.getUniformLocation(cityProgram, "uCam"),
    fog: gl.getUniformLocation(cityProgram, "uFog"),
  };
  const carU = {
    viewProj: gl.getUniformLocation(carProgram, "uViewProj"),
    model: gl.getUniformLocation(carProgram, "uModel"),
    cam: gl.getUniformLocation(carProgram, "uCam"),
    fog: gl.getUniformLocation(carProgram, "uFog"),
  };
  const groundU = {
    viewProj: gl.getUniformLocation(groundProgram, "uViewProj"),
    cam: gl.getUniformLocation(groundProgram, "uCam"),
    fog: gl.getUniformLocation(groundProgram, "uFog"),
  };

  /* ------------------------------------------------------------------ */
  /* Procedural city                                                    */
  /* ------------------------------------------------------------------ */

  let seed = 20261018;
  function rnd() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  const PALETTE = [
    [1.0, 0.10, 0.70],
    [0.10, 0.90, 1.00],
    [0.90, 0.20, 0.60],
    [0.20, 1.00, 0.80],
    [1.00, 0.60, 0.10],
  ];

  function faceAxes(n) {
    if (Math.abs(n[0]) > 0.5) return [2, 1];
    if (Math.abs(n[1]) > 0.5) return [0, 2];
    return [0, 1];
  }

  function pushBox(out, cx, cy, cz, hx, hy, hz, col) {
    const faces = [
      { n: [1, 0, 0],  v: [[hx, -hy, -hz], [hx, -hy, hz], [hx, hy, hz], [hx, hy, -hz]] },
      { n: [-1, 0, 0], v: [[-hx, -hy, hz], [-hx, -hy, -hz], [-hx, hy, -hz], [-hx, hy, hz]] },
      { n: [0, 1, 0],  v: [[-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]] },
      { n: [0, -1, 0], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, -hy, -hz], [-hx, -hy, -hz]] },
      { n: [0, 0, 1],  v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
      { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    ];
    const order = [0, 2, 1, 0, 3, 2];
    for (const face of faces) {
      const axes = faceAxes(face.n);
      for (const i of order) {
        const p = face.v[i];
        const wx = cx + p[0];
        const wy = cy + p[1];
        const wz = cz + p[2];
        const uv = [wx, wy, wz];
        out.push(
          wx, wy, wz,
          face.n[0], face.n[1], face.n[2],
          uv[axes[0]], uv[axes[1]],
          col[0], col[1], col[2]
        );
      }
    }
  }

  const cityVertices = [];
  const colliders = [];
  const HALF = 14;

  for (let gx = -HALF; gx <= HALF; gx++) {
    for (let gz = -HALF; gz <= HALF; gz++) {
      const baseX = gx * 20;
      const baseZ = gz * 20;
      const count = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < count; k++) {
        const w = 6 + rnd() * 8;
        const d = 6 + rnd() * 8;
        const h = 8 + Math.pow(rnd(), 2) * 62;
        const ox = (rnd() - 0.5) * (20 - w - 4);
        const oz = (rnd() - 0.5) * (20 - d - 4);
        const cx = baseX + ox;
        const cz = baseZ + oz;
        const col = PALETTE[Math.floor(rnd() * PALETTE.length)];
        pushBox(cityVertices, cx, h / 2, cz, w / 2, h / 2, d / 2, col);
        colliders.push({
          minx: cx - w / 2, maxx: cx + w / 2,
          minz: cz - d / 2, maxz: cz + d / 2,
        });
      }
    }
  }

  const cityVertexCount = cityVertices.length / 11;

  const groundVertices = new Float32Array([
    -600, 0, -600,  600, 0, 600,  600, 0, -600,
    -600, 0, -600,  -600, 0, 600,  600, 0, 600,
  ]);

  const carVertices = [];
  const BODY = [0.16, 0.18, 0.26];
  const GLASS = [0.42, 0.50, 0.62];
  const NEON = [0.10, 0.90, 1.00];
  const LAMP = [1.00, 0.95, 0.80];
  const TAIL = [1.00, 0.15, 0.45];
  const TYRE = [0.04, 0.04, 0.06];

  pushBox(carVertices, 0, 0, 0, 0.82, 0.28, 1.62, BODY);
  pushBox(carVertices, 0, 0.62, -0.15, 0.60, 0.30, 0.72, GLASS);
  pushBox(carVertices, 0, -0.30, 0, 0.86, 0.06, 1.66, NEON);
  pushBox(carVertices, 0, 0.05, 1.64, 0.60, 0.09, 0.06, LAMP);
  pushBox(carVertices, 0, 0.05, -1.64, 0.60, 0.09, 0.06, TAIL);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      pushBox(carVertices, sx * 0.86, -0.20, sz * 1.05, 0.14, 0.30, 0.32, TYRE);
    }
  }
  const carVertexCount = carVertices.length / 11;

  /* ------------------------------------------------------------------ */
  /* Buffers                                                            */
  /* ------------------------------------------------------------------ */

  function makeCityVao(vertices, floatsPerVertex, locations) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const stride = floatsPerVertex * 4;
    locations.forEach((loc) => {
      const size = loc.size;
      gl.enableVertexAttribArray(loc.index);
      gl.vertexAttribPointer(loc.index, size, gl.FLOAT, false, stride, loc.offset * 4);
    });
    gl.bindVertexArray(null);
    return vao;
  }

  const cityVao = makeCityVao(new Float32Array(cityVertices), 11, [
    { index: 0, size: 3, offset: 0 },
    { index: 1, size: 3, offset: 3 },
    { index: 2, size: 2, offset: 6 },
    { index: 3, size: 3, offset: 8 },
  ]);

  const carVao = makeCityVao(new Float32Array(carVertices), 11, [
    { index: 0, size: 3, offset: 0 },
    { index: 1, size: 3, offset: 3 },
    { index: 2, size: 2, offset: 6 },
    { index: 3, size: 3, offset: 8 },
  ]);

  const groundVao = gl.createVertexArray();
  gl.bindVertexArray(groundVao);
  const groundVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, groundVbo);
  gl.bufferData(gl.ARRAY_BUFFER, groundVertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /* ------------------------------------------------------------------ */
  /* Input                                                              */
  /* ------------------------------------------------------------------ */

  const keys = Object.create(null);
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    if (e.code === "KeyR") resetCar();
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });

  /* ------------------------------------------------------------------ */
  /* Car state & simulation                                             */
  /* ------------------------------------------------------------------ */

  const CAR_RADIUS = 1.8;
  const BOUND = HALF * 20 - 8;

  function blocked(x, z) {
    if (x < -BOUND || x > BOUND || z < -BOUND || z > BOUND) return true;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (
        x > c.minx - CAR_RADIUS && x < c.maxx + CAR_RADIUS &&
        z > c.minz - CAR_RADIUS && z < c.maxz + CAR_RADIUS
      ) return true;
    }
    return false;
  }

  function clearAround(x, z) {
    return !blocked(x, z) &&
      !blocked(x + 3, z) && !blocked(x - 3, z) &&
      !blocked(x, z + 3) && !blocked(x, z - 3);
  }

  function runIn(x, z, dx, dz) {
    const STEP = 2;
    let d = 0;
    while (d < 240 && !blocked(x + dx * d, z + dz * d)) d += STEP;
    return d;
  }

  function findSpawn() {
    let best = null;
    let bestScore = -1;
    for (let r = 0; r < 100; r++) {
      const radius = r * 2.5;
      const steps = r === 0 ? 1 : 48;
      for (let s = 0; s < steps; s++) {
        const t = (s / steps) * Math.PI * 2;
        const x = Math.cos(t) * radius;
        const z = Math.sin(t) * radius;
        if (!clearAround(x, z)) continue;

        const px = runIn(x, z, 1, 0);
        const mx = runIn(x, z, -1, 0);
        const pz = runIn(x, z, 0, 1);
        const mz = runIn(x, z, 0, -1);
        const rx = px + mx;
        const rz = pz + mz;
        if (Math.min(rx, rz) < 8) continue;

        const score = rx + rz;
        if (score > bestScore) {
          bestScore = score;
          const a = rx >= rz
            ? (px >= mx ? Math.PI / 2 : -Math.PI / 2)
            : (pz >= mz ? 0 : Math.PI);
          best = { x: x, z: z, a: a };
        }
      }
      if (bestScore >= 140) break;
    }
    return best || { x: 0, z: 0, a: 0 };
  }

  const spawn = findSpawn();
  const car = { x: spawn.x, z: spawn.z, a: spawn.a, speed: 0 };

  function resetCar() {
    car.x = spawn.x; car.z = spawn.z; car.a = spawn.a; car.speed = 0;
  }

  function updateCar(dt) {
    const ACCEL = 34;
    const BRAKE = 55;
    const MAX_FWD = 58;
    const MAX_REV = -16;
    const TURN = 1.9;

    let force = 0;
    const up = keys.KeyW || keys.ArrowUp;
    const down = keys.KeyS || keys.ArrowDown;
    const boost = keys.ShiftLeft || keys.ShiftRight;

    if (up) force += ACCEL;
    if (down) force -= BRAKE;
    if (boost && force > 0) force *= 1.7;

    if (!up && !down) car.speed *= Math.max(0, 1 - 1.6 * dt);
    car.speed += force * dt;

    const topSpeed = MAX_FWD * (boost ? 1.6 : 1);
    car.speed = Math.max(MAX_REV, Math.min(topSpeed, car.speed));

    let steer = 0;
    if (keys.KeyA || keys.ArrowLeft) steer += 1;
    if (keys.KeyD || keys.ArrowRight) steer -= 1;

    if (steer !== 0) {
      const grip = Math.min(1, Math.abs(car.speed) / 6 + 0.25);
      car.a += steer * TURN * grip * dt * (car.speed < 0 ? -1 : 1);
    }

    const fx = Math.sin(car.a);
    const fz = Math.cos(car.a);

    const nx = car.x + fx * car.speed * dt;
    const nz = car.z + fz * car.speed * dt;

    let hit = false;
    if (!blocked(nx, car.z)) car.x = nx; else hit = true;
    if (!blocked(car.x, nz)) car.z = nz; else hit = true;
    if (hit) car.speed *= 0.5;
  }

  /* ------------------------------------------------------------------ */
  /* Render loop                                                        */
  /* ------------------------------------------------------------------ */

  const FOG = new Float32Array([0.03, 0.012, 0.06]);
  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const viewProj = new Float32Array(16);
  const model = new Float32Array(16);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clearColor(FOG[0], FOG[1], FOG[2], 1.0);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  window.addEventListener("resize", resize);
  resize();

  let last = performance.now();
  let speedTimer = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    updateCar(dt);
    resize();

    const aspect = canvas.width / canvas.height || 1;
    perspective(proj, Math.PI / 3, aspect, 0.1, 900);

    const fx = Math.sin(car.a);
    const fz = Math.cos(car.a);
    const eye = [car.x - fx * 9, 4.6, car.z - fz * 9];
    const target = [car.x + fx * 7, 1.0, car.z + fz * 7];

    lookAt(view, eye, target, [0, 1, 0]);
    multiply(viewProj, proj, view);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(groundProgram);
    gl.uniformMatrix4fv(groundU.viewProj, false, viewProj);
    gl.uniform3fv(groundU.cam, eye);
    gl.uniform3fv(groundU.fog, FOG);
    gl.bindVertexArray(groundVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(cityProgram);
    gl.uniformMatrix4fv(cityU.viewProj, false, viewProj);
    gl.uniform3fv(cityU.cam, eye);
    gl.uniform3fv(cityU.fog, FOG);

    identity(model);
    gl.uniformMatrix4fv(cityU.model, false, model);
    gl.bindVertexArray(cityVao);
    gl.drawArrays(gl.TRIANGLES, 0, cityVertexCount);

    gl.useProgram(carProgram);
    gl.uniformMatrix4fv(carU.viewProj, false, viewProj);
    gl.uniform3fv(carU.cam, eye);
    gl.uniform3fv(carU.fog, FOG);
    fromYRotation(model, car.a, car.x, 0.55, car.z);
    gl.uniformMatrix4fv(carU.model, false, model);
    gl.bindVertexArray(carVao);
    gl.drawArrays(gl.TRIANGLES, 0, carVertexCount);

    speedTimer += dt;
    if (speedTimer > 0.1) {
      speedTimer = 0;
      speedEl.textContent = String(Math.round(Math.abs(car.speed) * 3.6));
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

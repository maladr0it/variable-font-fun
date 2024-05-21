/// <reference lib="dom" />

import { RECT_VERTS } from "./data/rect.ts";
import { CUBE_VERTS } from "./data/cube.ts";

import { VERTS as MONKEY_VERTS } from "./data/monkey.ts";

import { getDataURL, loadImage } from "./utils.ts";
import { log_clear, log_getContent, log_write } from "./log.ts";

import { shader_load } from "./shader.ts";

import { Mat4, mat4_identity, mat4_mul, mat4_proj, mat4_rot, mat4_translate } from "./mat4.ts";
import { vec3_create, vec3_mulMat4, vec3_normalize } from "./vec3.ts";
import { quat_axisAngle, quat_identity, quat_mul } from "./quat.ts";
import { mat4_transpose } from "./mat4.ts";
import { mat4_inverseAffine } from "./mat4.ts";
import { mat4_scale } from "./mat4.ts";

const GLOBAL_UP = vec3_create(0, 1, 0);

const FOV = Math.PI / 2;
const Z_NEAR = 0.1;
const Z_FAR = 100_000;

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 512;
const CANVAS_SCALING_FACTOR = 2;

const SVG_WIDTH = 450;
const SVG_HEIGHT = 94;
const SVG_SCALING_FACTOR = 2; // improve the quality of the SVG

const VERT_SIZE = 8; // assume all meshes have 8 floats per vertex for now

// TODO: revist this function to understand wtf is actually happening
// given a depth, and canvas coords (pixels from top-left), figure out the world position that should be used (assume camera is at the origin looking in -z direction)
const canvasPosToScenePos = (x: number, y: number, depth: number, projMat: Mat4, viewMat: Mat4) => {
  const ndcX = (2 * x) / CANVAS_WIDTH - 1;
  const ndcY = 1 - (2 * y) / CANVAS_HEIGHT;
  // WHY DONT WE NEED THIS?
  // const ndcZ = ((Z_FAR + Z_NEAR) + (2 * Z_FAR * Z_NEAR) / depth) / (Z_FAR - Z_NEAR);

  const ndcCoords = vec3_create(ndcX, ndcY, 0); // z coord can be anything since we will overwrite it
  const viewProjMat = mat4_mul(viewMat, projMat);

  // Invert the combined view-projection matrix
  const inverseViewProjMat = mat4_inverseAffine(viewProjMat)!;

  // Convert NDC to world coordinates using vec3_mulMat4
  const worldPos = vec3_mulMat4(ndcCoords, inverseViewProjMat);
  worldPos[0] *= depth;
  worldPos[1] *= depth;
  worldPos[2] = -depth;

  return worldPos;
};

const createVao = (gl: WebGL2RenderingContext, vertexData: Float32Array) => {
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // position
  gl.vertexAttribPointer(
    0,
    3,
    gl.FLOAT,
    false,
    VERT_SIZE * vertexData.BYTES_PER_ELEMENT,
    0 * vertexData.BYTES_PER_ELEMENT,
  );
  gl.enableVertexAttribArray(0);

  // tex-coords
  gl.vertexAttribPointer(
    1,
    2,
    gl.FLOAT,
    false,
    VERT_SIZE * vertexData.BYTES_PER_ELEMENT,
    3 * vertexData.BYTES_PER_ELEMENT,
  );
  gl.enableVertexAttribArray(1);

  // normals
  gl.vertexAttribPointer(
    2,
    3,
    gl.FLOAT,
    false,
    VERT_SIZE * vertexData.BYTES_PER_ELEMENT,
    5 * vertexData.BYTES_PER_ELEMENT,
  );
  gl.enableVertexAttribArray(2);

  // clean up
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return vao;
};

const start = async () => {
  //
  // State
  //
  // relative to canvas
  let mouseX = 0;
  let mouseY = 0;

  const projMat = mat4_proj(FOV, CANVAS_WIDTH / CANVAS_HEIGHT, Z_NEAR, Z_FAR);
  const viewMat = mat4_identity();

  const svgPos = canvasPosToScenePos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 200, projMat, viewMat);

  let glassyPos = vec3_create(0, 0, -1);
  let glassyRot = quat_identity();

  const logEl = document.getElementById("log") as HTMLElement;

  // gl setup
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  const gl = canvas.getContext("webgl2")!;
  canvas.style.width = `${CANVAS_WIDTH}px`;
  canvas.style.height = `${CANVAS_HEIGHT}px`;
  canvas.width = CANVAS_WIDTH * globalThis.devicePixelRatio * CANVAS_SCALING_FACTOR;
  canvas.height = CANVAS_HEIGHT * globalThis.devicePixelRatio * CANVAS_SCALING_FACTOR;
  // read textures top-first
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(1, 1, 1, 1);

  // load shaders
  const program = (await shader_load(gl, "./shaders/vert.vs", "./shaders/frag.fs"))!;
  const refractiveProgram = (await shader_load(gl, "./shaders/vert.vs", "./shaders/refractive.fs"))!;
  const reflectiveProgram = (await shader_load(gl, "./shaders/reflective.vs", "./shaders/reflective.fs"))!;

  //
  // Create textures
  //
  const fTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, fTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, await loadImage("./images/f-texture.png"));
  gl.generateMipmap(gl.TEXTURE_2D);

  const frameTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, frameTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    canvas.width,
    canvas.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const skyboxTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTexture);
  const skyboxPaths = [
    "./images/sky/px.jpg",
    "./images/sky/nx.jpg",
    "./images/sky/py.jpg",
    "./images/sky/ny.jpg",
    "./images/sky/pz.jpg",
    "./images/sky/nz.jpg",
  ];
  for (let i = 0; i < 6; i += 1) {
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      await loadImage(skyboxPaths[i]),
    );
  }
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

  gl.bindTexture(gl.TEXTURE_2D, null);

  //
  // SVG stuff
  //
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = SVG_WIDTH * globalThis.devicePixelRatio * SVG_SCALING_FACTOR;
  textureCanvas.height = SVG_HEIGHT * globalThis.devicePixelRatio * SVG_SCALING_FACTOR;
  const textureCtx = textureCanvas.getContext("2d")!;

  const fontDataBase64 = await getDataURL("./AROneSans-VariableFont_ARRR,wght.ttf");
  const svgTexture = gl.createTexture()!;

  const updateSvgTexture = async (weight: number) => {
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" id="text-image" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" fill="black" style="background-color: transparent;">
        <style>
          @font-face {
            font-family: "var-font";
            src: url("${fontDataBase64}");
            font-weight: 400 700;
            font-synthesis: none;
          }

          text {
            --local-weight: ${weight};
            --weight: var(--global-weight, var(--local-weight));
            font-size: 72px;
            font-family: "var-font", sans-serif;
            font-variation-settings: "wght" var(--weight);
          }
        </style>
        <text class="test" x="50%" y="72" text-anchor="middle">Expressive</text>
      </svg>
  `;

    const img = await loadImage(`data:image/svg+xml,${encodeURIComponent(svgString)}`);

    textureCtx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
    textureCtx.drawImage(img, 0, 0, textureCanvas.width, textureCanvas.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, svgTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      textureCanvas,
    );
    gl.generateMipmap(gl.TEXTURE_2D);

    document.documentElement.style.setProperty("--global-weight", weight.toString());
  };

  const rectVao = createVao(gl, RECT_VERTS);
  const cubeVao = createVao(gl, CUBE_VERTS);
  const monkeyVao = createVao(gl, MONKEY_VERTS);

  //
  // Event handlers
  //
  const weightInput = document.getElementById("weight") as HTMLInputElement;
  const onInput = (event: any) => {
    const weight = event.target.value;
    updateSvgTexture(weight);
  };
  weightInput.addEventListener("input", onInput);
  await updateSvgTexture(parseInt(weightInput.value));

  canvas.addEventListener("mousemove", (event) => {
    // get the mouse position relative to the canvas
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    mouseX = (event.clientX - rect.x) * scaleX;
    mouseY = (event.clientY - rect.y) * scaleY;
  });

  const tick = async (frameTime: number) => {
    //
    // update
    //

    const svgRot = quat_mul(
      quat_axisAngle(vec3_normalize(vec3_create(0, 1, 0))!, frameTime / 1000),
      quat_axisAngle(vec3_create(1, 0, 0), -Math.PI / 8),
    );

    glassyPos = canvasPosToScenePos(mouseX, mouseY, 100, projMat, viewMat);
    glassyRot = quat_axisAngle(vec3_create(0, 1, 0), frameTime / 1000);

    //
    // render
    //
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // render plain svg texture
    {
      // const modelPos = svgPos;
      // const modelScale = vec3_create(SVG_WIDTH, SVG_HEIGHT, 1);

      // let modelMat = mat4_identity();
      // modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      // modelMat = mat4_mul(modelMat, mat4_translate(modelPos));
      // const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      // gl.useProgram(program);

      // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projMat"), false, projMat);
      // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_viewMat"), false, viewMat);
      // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_modelMat"), false, modelMat);
      // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_normalMat"), false, normalMat);

      // gl.activeTexture(gl.TEXTURE0);
      // gl.bindTexture(gl.TEXTURE_2D, svgTexture);
      // gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);

      // gl.bindVertexArray(rectVao);
      // gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);
    }

    // render reflective svg texture
    {
      const modelPos = svgPos;
      const modelRot = svgRot;
      const modelScale = vec3_create(SVG_WIDTH, SVG_HEIGHT, 1);

      let modelMat = mat4_identity();
      modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      modelMat = mat4_mul(modelMat, mat4_rot(modelRot));
      modelMat = mat4_mul(modelMat, mat4_translate(modelPos));
      const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      gl.useProgram(reflectiveProgram);

      gl.uniformMatrix4fv(gl.getUniformLocation(reflectiveProgram, "u_projMat"), false, projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(reflectiveProgram, "u_viewMat"), false, viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(reflectiveProgram, "u_modelMat"), false, modelMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(reflectiveProgram, "u_normalMat"), false, normalMat);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, svgTexture);
      gl.uniform1i(gl.getUniformLocation(reflectiveProgram, "u_texture"), 0);

      gl.activeTexture(gl.TEXTURE0 + 1);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTexture);
      gl.uniform1i(gl.getUniformLocation(reflectiveProgram, "u_cubemap"), 1);

      gl.bindVertexArray(rectVao);
      gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);
    }

    // Store the scene so far in a texture, we will sample it when rendering the refractive object
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, canvas.width, canvas.height, 0);
    gl.generateMipmap(gl.TEXTURE_2D);

    // change modes for glassy rendering
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // render glassy object
    {
      const modelPos = glassyPos;
      const modelRot = glassyRot;
      const modelScale = vec3_create(32, 32, 32);

      let modelMat = mat4_identity();
      modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      modelMat = mat4_mul(modelMat, mat4_rot(modelRot));
      modelMat = mat4_mul(modelMat, mat4_translate(modelPos));
      const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      gl.useProgram(refractiveProgram);

      gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_projMat"), false, projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_viewMat"), false, viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_modelMat"), false, modelMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_normalMat"), false, normalMat);
      gl.uniform3fv(gl.getUniformLocation(refractiveProgram, "u_cameraPos"), vec3_create(0, 0, 0));

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, frameTexture);
      gl.uniform1i(gl.getUniformLocation(refractiveProgram, "u_texture"), 0);

      gl.bindVertexArray(monkeyVao);
      gl.drawArrays(gl.TRIANGLES, 0, MONKEY_VERTS.length / 8);
    }

    //
    // Write to output
    //
    logEl.innerText = log_getContent();
    log_clear();

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

start();

/// <reference lib="dom" />

import { RECT_VERTS } from "./data/rect.ts";
import { CUBE_VERTS } from "./data/cube.ts";
import { VERTS as MONKEY_VERTS } from "./data/monkey.ts";

import { log_clear, log_getContent, log_write } from "./static/log.ts";
import { shader_load } from "./shader.ts";
import { debounce, delay, getDataURL, loadImage } from "./utils.ts";
import { mat4_identity, mat4_mul, mat4_ortho, mat4_proj, mat4_rot, mat4_translate } from "./mat4.ts";
import { vec3_add, vec3_create, vec3_mulMat4 } from "./vec3.ts";
import { quat_axisAngle, quat_identity, quat_mul } from "./quat.ts";
import { mat4_transpose } from "./mat4.ts";
import { mat4_inverseAffine } from "./mat4.ts";
import { mat4_scale } from "./mat4.ts";

const FOV = Math.PI / 2;
const Z_NEAR = 0.1;
const Z_FAR = 100_000;
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 256;

const SVG_WIDTH = 450;
const SVG_HEIGHT = 94;

const VERT_SIZE = 8; // assume all meshes have 8 floats per vertex for now

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
  const mat = mat4_identity();
  mat[0] = 2;
  mat[5] = 3;
  mat[10] = 4;
  mat[14] = -100;

  console.log(mat);

  const inv = mat4_inverseAffine(mat)!;

  console.log(inv);

  const normal = mat4_transpose(inv);

  console.log(normal);

  //
  // State
  //
  // relative to canvas
  let mouseX = 0;
  let mouseY = 0;

  let svgPos = vec3_create(0, 0, -200);
  let glassyPos = vec3_create(0, 0, -100);
  let glassyRot = quat_identity();

  const logEl = document.getElementById("log") as HTMLElement;

  // gl setup
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  const gl = canvas.getContext("webgl2")!;
  canvas.style.width = `${CANVAS_WIDTH}px`;
  canvas.style.height = `${CANVAS_HEIGHT}px`;
  canvas.width = CANVAS_WIDTH * globalThis.devicePixelRatio;
  canvas.height = CANVAS_HEIGHT * globalThis.devicePixelRatio;
  // canvas.width = CANVAS_WIDTH;
  // canvas.height = CANVAS_HEIGHT;
  // read textures top-first
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(1, 1, 1, 1);

  // load shaders
  const program = (await shader_load(gl, "./shaders/vert.vs", "./shaders/frag.fs"))!;
  const refractiveProgram = (await shader_load(gl, "./shaders/vert.vs", "./shaders/refractive.fs"))!;

  // create textures
  const fTexture = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, await loadImage("./images/f-texture.png"));
  gl.generateMipmap(gl.TEXTURE_2D);

  //
  // SVG stuff
  //
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = SVG_WIDTH * globalThis.devicePixelRatio;
  textureCanvas.height = SVG_HEIGHT * globalThis.devicePixelRatio;
  const textureCtx = textureCanvas.getContext("2d")!;

  const fontDataBase64 = await getDataURL("./AROneSans-VariableFont_ARRR,wght.ttf");
  const svgTexture = gl.createTexture()!;

  const updateSvgTexture = async (weight: number) => {
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" id="text-image" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" fill="black" style="background-color: pink;">
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
        <text class="test" x="0" y="72">asdfjkl;</text>
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

    const svgContainer = document.getElementById("text-image-container") as HTMLElement;

    // TODO: tidy this up later
    if (!svgContainer.innerHTML) {
      document.getElementById("text-image-container")!.innerHTML = svgString;
    }

    document.documentElement.style.setProperty("--global-weight", weight.toString());
  };

  //
  // Framebuffer stuff
  //
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
  gl.bindTexture(gl.TEXTURE_2D, null);

  const colorRenderbuffer = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, colorRenderbuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, canvas.width, canvas.height);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  const depthRenderbuffer = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderbuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, canvas.width, canvas.height);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  // gl.framebufferTexture2D(
  //   gl.FRAMEBUFFER,
  //   gl.COLOR_ATTACHMENT0,
  //   gl.TEXTURE_2D,
  //   frameTexture,
  //   0,
  // );

  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorRenderbuffer);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderbuffer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    console.error("Framebuffer is not complete.");
  }

  const rectVao = createVao(gl, RECT_VERTS);
  const cubeVao = createVao(gl, CUBE_VERTS);
  const monkeyVao = createVao(gl, MONKEY_VERTS);

  // // create vbo
  // const vbo = gl.createBuffer();
  // gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  // gl.bufferData(gl.ARRAY_BUFFER, RECT_VERTS, gl.STATIC_DRAW);

  // // create vao, using the bound vbo
  // const vao = gl.createVertexArray();

  // // set vertex attributes
  // //
  // // pos
  // gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 8 * Float32Array.BYTES_PER_ELEMENT, 0 * Float32Array.BYTES_PER_ELEMENT);
  // gl.enableVertexAttribArray(0);
  // // tex-coords
  // gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
  // gl.enableVertexAttribArray(1);
  // // normal
  // gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 8 * Float32Array.BYTES_PER_ELEMENT, 5 * Float32Array.BYTES_PER_ELEMENT);
  // gl.enableVertexAttribArray(2);

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

  const tick = async (_frameTime: number) => {
    //
    // update
    //
    glassyPos = vec3_create(mouseX - CANVAS_WIDTH / 2, -mouseY + CANVAS_HEIGHT / 2, glassyPos[2]);
    glassyRot = quat_axisAngle(vec3_create(0, 1, 0), _frameTime / 1000);
    // glassyRot = quat_axisAngle(vec3_create(0, 1, 0), Math.PI / 4);

    //
    // render
    //
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const projMat = mat4_proj(FOV, CANVAS_WIDTH / CANVAS_HEIGHT, Z_NEAR, Z_FAR);
    // const projMat = mat4_ortho(
    //   -CANVAS_WIDTH / 2,
    //   +CANVAS_WIDTH / 2,
    //   -CANVAS_HEIGHT / 2,
    //   +CANVAS_HEIGHT / 2,
    //   Z_NEAR,
    //   Z_FAR,
    // );
    const viewMat = mat4_identity();

    // Render scene to framebuffer
    //
    // render svg texture
    {
      const modelPos = svgPos;
      const modelScale = vec3_create(SVG_WIDTH, SVG_HEIGHT, 1);

      let modelMat = mat4_identity();
      modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      modelMat = mat4_mul(modelMat, mat4_translate(modelPos));

      const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      gl.useProgram(program);

      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projMat"), false, projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_viewMat"), false, viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_modelMat"), false, modelMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_normalMat"), false, normalMat);
      gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
      gl.bindTexture(gl.TEXTURE_2D, svgTexture);

      gl.bindVertexArray(rectVao);
      gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);
    }

    // Store the scene so far in a texture, we will sample it when rendering the refractive object
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, canvas.width, canvas.height, 0);
    gl.generateMipmap(gl.TEXTURE_2D);

    // render refractive object
    {
      // HERE
      const modelPos = glassyPos;
      const modelRot = glassyRot;
      const modelScale = vec3_create(64, 64, 64);

      let modelMat = mat4_identity();
      modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      // modelMat = mat4_mul(modelMat, mat4_rot(modelRot));
      modelMat = mat4_mul(modelMat, mat4_translate(modelPos));
      const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      gl.useProgram(refractiveProgram);

      gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_projMat"), false, projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_viewMat"), false, viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_modelMat"), false, modelMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_normalMat"), false, normalMat);

      gl.uniform3fv(gl.getUniformLocation(refractiveProgram, "u_cameraPos"), vec3_create(0, 0, 0));
      gl.uniform1i(gl.getUniformLocation(refractiveProgram, "u_texture"), 0);
      gl.bindTexture(gl.TEXTURE_2D, frameTexture);

      // gl.bindVertexArray(cubeVao);
      // gl.drawArrays(gl.TRIANGLES, 0, CUBE_VERTS.length / 8);

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

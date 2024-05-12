/// <reference lib="dom" />

import { RECT_VERTS } from "./data/rect.ts";
import { CUBE_VERTS } from "./data/cube.ts";

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

const start = async () => {
  //
  // State
  //
  let modelRot = quat_identity();

  const logEl = document.getElementById("log") as HTMLElement;

  // gl setup
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const gl = canvas.getContext("webgl2")!;
  // read textures top-first
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

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
  const fontDataBase64 = await getDataURL("./AROneSans-VariableFont_ARRR,wght.ttf");
  const svgTexture = gl.createTexture()!;

  //
  // Framebuffer stuff
  //

  const frameTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, frameTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    frameTexture,
    0,
  );

  // gl.bindFramebuffer(gl.FRAMEBUFFER, envMapFbos[i]);
  //     gl.viewport(0, 0, ENV_MAP_SIZE, ENV_MAP_SIZE);

  // create cubemap
  // const cubemap = gl.createTexture()!;
  // gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap);
  // const cubemapPaths = [
  //   "./images/debug/px.png",
  //   "./images/debug/nx.png",
  //   "./images/debug/py.png",
  //   "./images/debug/ny.png",
  //   "./images/debug/pz.png",
  //   "./images/debug/nz.png",
  // ];
  // for (let i = 0; i < cubemapPaths.length; i += 1) {
  //   gl.texImage2D(
  //     gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
  //     0,
  //     gl.RGBA,
  //     gl.RGBA,
  //     gl.UNSIGNED_BYTE,
  //     await loadImage(cubemapPaths[i]),
  //   );
  // }
  // gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

  // create vbo
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, RECT_VERTS, gl.STATIC_DRAW);

  // create vao, using the bound vbo
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // set vertex attributes
  //
  // pos
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 8 * Float32Array.BYTES_PER_ELEMENT, 0 * Float32Array.BYTES_PER_ELEMENT);
  gl.enableVertexAttribArray(0);
  // tex-coords
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
  gl.enableVertexAttribArray(1);
  // normal
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 8 * Float32Array.BYTES_PER_ELEMENT, 5 * Float32Array.BYTES_PER_ELEMENT);
  gl.enableVertexAttribArray(2);

  const updateSvgTexture = async (weight: number) => {
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" id="text-image" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" fill="blue">
        <style>
          @font-face {
            font-family: "var-font";
            src: url("${fontDataBase64}");
            font-weight: 400 700;
            font-synthesis: none;
          }
  
          text {
            --weight: ${weight};
            font-size: 72px;
            font-family: "var-font", sans-serif;
            font-variation-settings: "wght" var(--weight);
          }
        </style>
        <text class="test" x="0" y="72">The quick</text>
      </svg>
  `;

    const img = await loadImage(`data:image/svg+xml,${encodeURIComponent(svgString)}`);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, svgTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      img,
    );
    gl.generateMipmap(gl.TEXTURE_2D);

    document.getElementById("text-image-container")!.innerHTML = svgString;
  };

  const weightInput = document.getElementById("weight") as HTMLInputElement;
  const onInput = (event: any) => {
    const weight = event.target.value;
    updateSvgTexture(weight);
  };
  weightInput.addEventListener("input", debounce(onInput, 250));

  await updateSvgTexture(parseInt(weightInput.value));

  const tick = async (_frameTime: number) => {
    //
    // update
    //
    // modelPos = vec3_add(modelPos, vec3_create(0, 0, +0.01));
    // modelRot = quat_mul(modelRot, quat_axisAngle(vec3_create(0, 1, 0), 0.01));

    //
    // render
    //
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // const projMat = mat4_proj(FOV, CANVAS_WIDTH / CANVAS_HEIGHT, Z_NEAR, Z_FAR);
    const projMat = mat4_ortho(-CANVAS_WIDTH, +CANVAS_WIDTH, -CANVAS_HEIGHT, +CANVAS_HEIGHT, Z_NEAR, Z_FAR);
    const viewMat = mat4_identity();

    // render to screen, later we will render to framebuffer instead
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gl.clearColor(1, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // render svg texture
    {
      const modelPos = vec3_create(0, 0, -100);
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

      gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);

      const p = vec3_mulMat4(vec3_create(-1, -1, 0), modelMat);
      log_write("svg", p);
    }

    // render f-texture
    {
      const modelPos = vec3_create(0, 0, -150);
      const modelScale = vec3_create(100, 100, 1);
      modelRot = quat_mul(modelRot, quat_axisAngle(vec3_create(0, 1, 0), 0.01));

      let modelMat = mat4_identity();

      modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      modelMat = mat4_mul(modelMat, mat4_rot(modelRot));
      modelMat = mat4_mul(modelMat, mat4_translate(modelPos));
      const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      const p = vec3_mulMat4(vec3_create(-1, -1, 0), modelMat);
      log_write("f", p);

      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projMat"), false, projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_viewMat"), false, viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_modelMat"), false, modelMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_normalMat"), false, normalMat);
      gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
      gl.bindTexture(gl.TEXTURE_2D, fTexture);

      gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);
    }

    // // render the same scene to framebuffer
    // gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    // gl.viewport(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // gl.clearColor(0, 0, 1, 1);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);

    // gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    // gl.generateMipmap(gl.TEXTURE_2D);
    // }

    // render refractive material
    // {
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // let modelMat = mat4_identity();
    // modelMat = mat4_mul(modelMat, mat4_translate(vec3_create(0, 0, -2)));
    // const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

    // gl.useProgram(program);

    // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projMat"), false, projMat);
    // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_viewMat"), false, viewMat);
    // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_modelMat"), false, modelMat);
    // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_normalMat"), false, normalMat);
    // gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);

    // gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    // gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);
    // }

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

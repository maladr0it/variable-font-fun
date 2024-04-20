/// <reference lib="dom" />

import { RECT_VERTS } from "./data/rect.ts";
import { CUBE_VERTS } from "./data/cube.ts";
import { shader_load } from "./shader.ts";
import { delay, getDataURL, loadImage } from "./utils.ts";
import { mat4_identity, mat4_mul, mat4_ortho, mat4_proj, mat4_rot, mat4_translate } from "./mat4.ts";
import { vec3_add, vec3_create } from "./vec3.ts";
import { quat_axisAngle, quat_identity, quat_mul } from "./quat.ts";
import { mat4_transpose } from "./mat4.ts";
import { mat4_inverseAffine } from "./mat4.ts";
import { mat4_scale } from "./mat4.ts";

const FOV = Math.PI / 2;
const Z_NEAR = 0.01;
const Z_FAR = 1000;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

const weightInput = document.getElementById("weight")!;

weightInput.addEventListener("input", (event: any) => {
  document.documentElement.style.setProperty("--weight", event.target.value);
});

const start = async () => {
  //
  //
  //

  //
  // State
  //
  let modelPos = vec3_create(0, 0, -1);
  let modelScale = vec3_create(4, 1, 1);
  let modelRot = quat_identity();

  // gl setup
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const gl = canvas.getContext("webgl2")!;
  // read textures top-first
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // load shaders
  const program = (await shader_load(gl, "./shaders/vert.vs", "./shaders/frag.fs"))!;

  // create textures
  const fTexture = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, await loadImage("./images/f-texture.png"));
  gl.generateMipmap(gl.TEXTURE_2D);

  //
  // SVG STUFF
  //
  const fontDataBase64 = await getDataURL("./AROneSans-VariableFont_ARRR,wght.ttf");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" id="text-image" width="1024" height="166" viewBox="0 0 1024 166" fill="blue">
      <style>
        @font-face {
          font-family: "var-font";
          src: url("${fontDataBase64}");
          font-weight: 400 700;
          font-synthesis: none;
        }

        text {
          --weight: 400;

          font-size: 128px;
          font-family: "var-font", sans-serif;
          font-variation-settings: "wght" var(--weight);
        }
      </style>
      <text class="test" x="0" y="128">The quick</text>
    </svg>
  `;

  document.getElementById("text-image-container")!.innerHTML = svg;

  const img = await loadImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);

  const svgTexture = gl.createTexture()!;
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

  // create cubemap
  const cubemap = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap);
  const cubemapPaths = [
    "./images/debug/px.png",
    "./images/debug/nx.png",
    "./images/debug/py.png",
    "./images/debug/ny.png",
    "./images/debug/pz.png",
    "./images/debug/nz.png",
  ];
  for (let i = 0; i < cubemapPaths.length; i += 1) {
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      await loadImage(cubemapPaths[i]),
    );
  }
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

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

  const tick = (_frameTime: number) => {
    //
    // update
    //
    // modelPos = vec3_add(modelPos, vec3_create(0, 0, +0.01));
    // modelRot = quat_mul(modelRot, quat_axisAngle(vec3_create(0, 1, 0), 0.01));

    //
    // render
    //
    gl.clearColor(0, 1, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    const projMat = mat4_proj(FOV, CANVAS_WIDTH / CANVAS_HEIGHT, Z_NEAR, Z_FAR);
    // const projMat = mat4_ortho(-1.5, 1.5, -1, 1, 0, Z_FAR);
    const viewMat = mat4_identity();

    // render obj1
    {
      let modelMat = mat4_identity();
      modelMat = mat4_mul(modelMat, mat4_rot(modelRot));
      modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      modelMat = mat4_mul(modelMat, mat4_translate(modelPos));
      const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projMat"), false, projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_viewMat"), false, viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_modelMat"), false, modelMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_normalMat"), false, normalMat);
      gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);

      gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);
    }

    // render obj2
    {
      // let modelMat = mat4_identity();
      // // modelMat = mat4_mul(modelMat, mat4_rot(modelRot));
      // // modelMat = mat4_mul(modelMat, mat4_scale(vec3_create(2, 2, 2)));
      // modelMat = mat4_mul(modelMat, mat4_translate(vec3_add(modelPos, vec3_create(0, 0, -2))));
      // const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projMat"), false, projMat);
      // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_viewMat"), false, viewMat);
      // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_modelMat"), false, modelMat);
      // gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_normalMat"), false, normalMat);
      // gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);

      // gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

start();

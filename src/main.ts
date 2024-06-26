/// <reference lib="dom" />

import { RECT_VERTS as RECT_VERTS_RAW } from "./data/rect.ts";
import { CUBE_VERTS as CUBE_VERTS_RAW } from "./data/cube.ts";

import { getDataURL, loadImage } from "./utils.ts";
import { log_clear, log_getContent } from "./log.ts";

import { shader_load } from "./shader.ts";
import { Mat4, mat4_identity, mat4_lookAt, mat4_mul, mat4_proj, mat4_rot, mat4_translate } from "./mat4.ts";
import { vec3_create, vec3_mul, vec3_mulMat4, vec3_sub } from "./vec3.ts";
import { quat_axisAngle } from "./quat.ts";
import { mat4_transpose } from "./mat4.ts";
import { mat4_inverseAffine } from "./mat4.ts";
import { mat4_scale } from "./mat4.ts";
import { vec2_create, vec2_sub } from "./vec2.ts";
import { quat_fromRotMat } from "./quat.ts";
import { quat_mul } from "./quat.ts";
import { vec3_add } from "./vec3.ts";

const GLOBAL_UP = vec3_create(0, 1, 0);

const FOV = Math.PI / 2;
const Z_NEAR = 0.1;
const Z_FAR = 1000;

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 512;
const CANVAS_SCALING_FACTOR = 2;

const BUTTON_WIDTH = 240;
const BUTTON_HEIGHT = 100;
const SVG_SCALING_FACTOR = 4; // improve the quality of the SVG

const VERT_SIZE_RAW = 8; // assume all meshes have 8 floats per vertex for now
const VERT_SIZE = 11;

const canvasPosToScenePos = (x: number, y: number, depth: number, projMat: Mat4, viewMat: Mat4) => {
  const ndcX = (2 * x) / CANVAS_WIDTH - 1;
  const ndcY = 1 - (2 * y) / CANVAS_HEIGHT;
  const ndcZ = ((Z_FAR + Z_NEAR) * depth - 2 * Z_FAR * Z_NEAR) / ((Z_FAR - Z_NEAR) * depth);

  const ndcPos = vec3_create(ndcX, ndcY, ndcZ);
  const clipspacePos = vec3_mul(ndcPos, depth);
  const viewProjMat = mat4_mul(viewMat, projMat);
  const inverseViewProjMat = mat4_inverseAffine(viewProjMat)!;
  const worldPos = vec3_mulMat4(clipspacePos, inverseViewProjMat);

  return worldPos;
};

const addTangentAttribs = (buffer: Float32Array) => {
  const result = new Float32Array(buffer.length + (buffer.length / VERT_SIZE_RAW) * 3);

  // TODO: check we aren't overshooting the buffer
  for (let i = 0; i < buffer.length / VERT_SIZE_RAW; i += 3) {
    const vert1Offset = (i + 0) * VERT_SIZE_RAW;
    const vert1x = buffer[vert1Offset + 0];
    const vert1y = buffer[vert1Offset + 1];
    const vert1z = buffer[vert1Offset + 2];
    const vert1u = buffer[vert1Offset + 3];
    const vert1v = buffer[vert1Offset + 4];

    const vert2Offset = (i + 1) * VERT_SIZE_RAW;
    const vert2x = buffer[vert2Offset + 0];
    const vert2y = buffer[vert2Offset + 1];
    const vert2z = buffer[vert2Offset + 2];
    const vert2u = buffer[vert2Offset + 3];
    const vert2v = buffer[vert2Offset + 4];

    const vert3Offset = (i + 2) * VERT_SIZE_RAW;
    const vert3x = buffer[vert3Offset + 0];
    const vert3y = buffer[vert3Offset + 1];
    const vert3z = buffer[vert3Offset + 2];
    const vert3u = buffer[vert3Offset + 3];
    const vert3v = buffer[vert3Offset + 4];

    const vert1Pos = vec3_create(vert1x, vert1y, vert1z);
    const vert2Pos = vec3_create(vert2x, vert2y, vert2z);
    const vert3Pos = vec3_create(vert3x, vert3y, vert3z);
    const vert1Uv = vec2_create(vert1u, vert1v);
    const vert2Uv = vec2_create(vert2u, vert2v);
    const vert3Uv = vec2_create(vert3u, vert3v);

    const edge1 = vec3_sub(vert2Pos, vert1Pos);
    const edge2 = vec3_sub(vert3Pos, vert1Pos);

    const deltaUv1 = vec2_sub(vert2Uv, vert1Uv);
    const deltaUv2 = vec2_sub(vert3Uv, vert1Uv);

    const f = 1 / (deltaUv1[0] * deltaUv2[1] - deltaUv2[0] * deltaUv1[1]);
    const tangentX = f * (deltaUv2[1] * edge1[0] - deltaUv1[1] * edge2[0]);
    const tangentY = f * (deltaUv2[1] * edge1[1] - deltaUv1[1] * edge2[1]);
    const tangentZ = f * (deltaUv2[1] * edge1[2] - deltaUv1[1] * edge2[2]);

    const vertOut1Offset = (i + 0) * VERT_SIZE;
    result[vertOut1Offset + 0] = buffer[vert1Offset + 0];
    result[vertOut1Offset + 1] = buffer[vert1Offset + 1];
    result[vertOut1Offset + 2] = buffer[vert1Offset + 2];
    result[vertOut1Offset + 3] = buffer[vert1Offset + 3];
    result[vertOut1Offset + 4] = buffer[vert1Offset + 4];
    result[vertOut1Offset + 5] = buffer[vert1Offset + 5];
    result[vertOut1Offset + 6] = buffer[vert1Offset + 6];
    result[vertOut1Offset + 7] = buffer[vert1Offset + 7];
    result[vertOut1Offset + 8] = tangentX;
    result[vertOut1Offset + 9] = tangentY;
    result[vertOut1Offset + 10] = tangentZ;

    const vertOut2Offset = (i + 1) * VERT_SIZE;
    result[vertOut2Offset + 0] = buffer[vert2Offset + 0];
    result[vertOut2Offset + 1] = buffer[vert2Offset + 1];
    result[vertOut2Offset + 2] = buffer[vert2Offset + 2];
    result[vertOut2Offset + 3] = buffer[vert2Offset + 3];
    result[vertOut2Offset + 4] = buffer[vert2Offset + 4];
    result[vertOut2Offset + 5] = buffer[vert2Offset + 5];
    result[vertOut2Offset + 6] = buffer[vert2Offset + 6];
    result[vertOut2Offset + 7] = buffer[vert2Offset + 7];
    result[vertOut2Offset + 8] = tangentX;
    result[vertOut2Offset + 9] = tangentY;
    result[vertOut2Offset + 10] = tangentZ;

    const vertOut3Offset = (i + 2) * VERT_SIZE;
    result[vertOut3Offset + 0] = buffer[vert3Offset + 0];
    result[vertOut3Offset + 1] = buffer[vert3Offset + 1];
    result[vertOut3Offset + 2] = buffer[vert3Offset + 2];
    result[vertOut3Offset + 3] = buffer[vert3Offset + 3];
    result[vertOut3Offset + 4] = buffer[vert3Offset + 4];
    result[vertOut3Offset + 5] = buffer[vert3Offset + 5];
    result[vertOut3Offset + 6] = buffer[vert3Offset + 6];
    result[vertOut3Offset + 7] = buffer[vert3Offset + 7];
    result[vertOut3Offset + 8] = tangentX;
    result[vertOut3Offset + 9] = tangentY;
    result[vertOut3Offset + 10] = tangentZ;
  }

  return result;
};

const RECT_VERTS = addTangentAttribs(RECT_VERTS_RAW);
const CUBE_VERTS = addTangentAttribs(CUBE_VERTS_RAW);

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

  // tangents
  gl.vertexAttribPointer(
    3,
    3,
    gl.FLOAT,
    false,
    VERT_SIZE * vertexData.BYTES_PER_ELEMENT,
    8 * vertexData.BYTES_PER_ELEMENT,
  );
  gl.enableVertexAttribArray(3);

  // clean up
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return vao;
};

const start = async () => {
  //
  // State
  //
  let cameraPos = vec3_create(0, 0, 0);

  // mouse relative to canvas
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  // button properties
  let buttonText = "Buy";
  let fontWeight = 400;
  let cornerRadius = 0;

  const projMat = mat4_proj(FOV, CANVAS_WIDTH / CANVAS_HEIGHT, Z_NEAR, Z_FAR);
  const viewMat = mat4_translate(vec3_mul(vec3_create(0, 0, 0), -1));

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
  gl.clearColor(0, 0, 0, 0);

  // load shaders
  const buttonProgram = (await shader_load(gl, "./shaders/vert.vs", "./shaders/button.fs"))!;

  //
  // Create textures
  //
  const metalColorTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, metalColorTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    await loadImage("./images/metal_0026_color_1k.jpg"),
  );
  gl.generateMipmap(gl.TEXTURE_2D);

  const metalSpecularTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, metalSpecularTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    await loadImage("./images/metal_0026_metallic_1k.jpg"),
  );
  gl.generateMipmap(gl.TEXTURE_2D);

  const metalNormalTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, metalNormalTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    await loadImage("./images/metal_0026_normal_opengl_1k.png"),
  );
  gl.generateMipmap(gl.TEXTURE_2D);

  const solidTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, solidTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new ImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1),
  );
  gl.generateMipmap(gl.TEXTURE_2D);

  const fullTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, fullTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1),
  );
  gl.generateMipmap(gl.TEXTURE_2D);

  const emptyTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, emptyTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new ImageData(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1),
  );
  gl.generateMipmap(gl.TEXTURE_2D);

  const plainNormalTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, plainNormalTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    await loadImage("./images/plain-normal.png"),
  );
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

  gl.bindTexture(gl.TEXTURE_2D, null);

  //
  // SVG stuff
  //
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = BUTTON_WIDTH * globalThis.devicePixelRatio * SVG_SCALING_FACTOR;
  textureCanvas.height = BUTTON_HEIGHT * globalThis.devicePixelRatio * SVG_SCALING_FACTOR;
  const textureCtx = textureCanvas.getContext("2d")!;

  const fontDataBase64 = await getDataURL("./AROneSans-VariableFont_ARRR,wght.ttf");
  const svgTexture = gl.createTexture()!;

  const updateSvgTexture = async (text: string, weight: number) => {
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" id="text-image" width="${BUTTON_WIDTH}" height="${BUTTON_HEIGHT}" viewBox="0 0 ${BUTTON_WIDTH} ${BUTTON_HEIGHT}" fill="white" style="background-color: transparent;">
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
            font-family: "var-font";
            font-variation-settings: "wght" var(--weight);
          }
        </style>
        <text class="test" x="50%" y="72" text-anchor="middle">
          ${text}
        </text>
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
  };

  const rectVao = createVao(gl, RECT_VERTS);

  //
  // Event handlers
  //
  canvas.addEventListener("mousemove", (event) => {
    // get the mouse position relative to the canvas
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    mouseX = (event.clientX - rect.x) * scaleX;
    mouseY = (event.clientY - rect.y) * scaleY;
  });

  canvas.addEventListener("mousedown", () => {
    mouseDown = true;
  });

  canvas.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  const weightInput = document.getElementById("weight") as HTMLInputElement;
  weightInput.value = fontWeight.toString();

  weightInput.addEventListener("input", (event: any) => {
    const value = event.target.value;
    fontWeight = value;
    updateSvgTexture(buttonText, value);
  });

  const textInput = document.getElementById("text") as HTMLInputElement;
  textInput.value = buttonText;
  textInput.addEventListener("input", (event: any) => {
    const value = event.target.value;
    buttonText = value;
    updateSvgTexture(value, fontWeight);
  });

  const cornerRadiusInput = document.getElementById("corner-radius") as HTMLInputElement;
  cornerRadiusInput.value = cornerRadius.toString();
  cornerRadiusInput.addEventListener("input", (event: any) => {
    const value = event.target.value;
    cornerRadius = value;
  });

  await updateSvgTexture(buttonText, fontWeight);

  const tick = async (frameTime: number) => {
    //
    // update
    //

    //
    // render
    //
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // render a capsule button
    {
      const program = buttonProgram;
      const distance = 75;

      const directionalLight = {
        dir: vec3_create(0, -0.25, -1),
        ambient: vec3_create(0.2, 0.2, 0.2),
        diffuse: vec3_create(0.5, 0.5, 0.5),
        specular: vec3_create(1.0, 1.0, 1.0),
      };

      let modelPos = canvasPosToScenePos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, distance, projMat, viewMat);
      if (mouseDown) {
        modelPos = vec3_add(modelPos, vec3_create(0, 0, -5));
      }
      const modelScale = vec3_create(BUTTON_WIDTH, BUTTON_HEIGHT, 1);

      const lookAtMat = mat4_lookAt(
        modelPos,
        canvasPosToScenePos(mouseX, mouseY, 5, projMat, viewMat),
        GLOBAL_UP,
      )!;

      // face the model in the -z direction before orienting it
      let modelOrientation = quat_axisAngle(vec3_create(0, 1, 0), Math.PI);
      modelOrientation = quat_mul(quat_fromRotMat(lookAtMat), modelOrientation);

      let modelMat = mat4_identity();
      modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      modelMat = mat4_mul(modelMat, mat4_rot(modelOrientation));
      modelMat = mat4_mul(modelMat, mat4_translate(modelPos));
      const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      gl.useProgram(program);

      gl.uniform3fv(gl.getUniformLocation(program, "u_viewPos"), cameraPos);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projMat"), false, projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_viewMat"), false, viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_modelMat"), false, modelMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_normalMat"), false, normalMat);

      gl.uniform2f(gl.getUniformLocation(program, "u_size"), BUTTON_WIDTH, BUTTON_HEIGHT);
      gl.uniform1f(gl.getUniformLocation(program, "u_cornerRadius"), cornerRadius);

      gl.uniform3fv(gl.getUniformLocation(program, "u_directionalLight.dir"), directionalLight.dir);
      gl.uniform3fv(gl.getUniformLocation(program, "u_directionalLight.ambient"), directionalLight.ambient);
      gl.uniform3fv(gl.getUniformLocation(program, "u_directionalLight.diffuse"), directionalLight.diffuse);
      gl.uniform3fv(gl.getUniformLocation(program, "u_directionalLight.specular"), directionalLight.specular);

      // draw background
      {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fullTexture);
        gl.uniform1i(gl.getUniformLocation(program, "u_clipMask"), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, solidTexture);
        gl.uniform1i(gl.getUniformLocation(program, "u_diffuseMap"), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, emptyTexture);
        gl.uniform1i(gl.getUniformLocation(program, "u_specularMap"), 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, metalNormalTexture);
        gl.uniform1i(gl.getUniformLocation(program, "u_normalMap"), 3);

        gl.uniform1f(gl.getUniformLocation(program, "u_shininess"), 64);

        gl.bindVertexArray(rectVao);
        gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / VERT_SIZE);
      }

      // draw svg
      {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, svgTexture);
        gl.uniform1i(gl.getUniformLocation(program, "u_clipMask"), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, metalColorTexture);
        gl.uniform1i(gl.getUniformLocation(program, "u_diffuseMap"), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, metalSpecularTexture);
        gl.uniform1i(gl.getUniformLocation(program, "u_specularMap"), 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, metalNormalTexture);
        gl.uniform1i(gl.getUniformLocation(program, "u_normalMap"), 3);

        gl.uniform1f(gl.getUniformLocation(program, "u_shininess"), 32);

        gl.bindVertexArray(rectVao);
        gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / VERT_SIZE);
      }
    }

    // Store the scene so far in a texture, we will sample it when rendering the refractive object
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, canvas.width, canvas.height, 0);
    gl.generateMipmap(gl.TEXTURE_2D);

    // change modes for glassy rendering
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // distort the scene when the mouse is down
    {
    }
    // render glassy object
    {
      // const modelPos = canvasPosToScenePos(mouseX, mouseY, 100, projMat, viewMat);
      // const modelRot = glassyRot;
      // const modelScale = vec3_create(10, 10, 10);

      // let modelMat = mat4_identity();
      // modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      // modelMat = mat4_mul(modelMat, mat4_rot(modelRot));
      // modelMat = mat4_mul(modelMat, mat4_translate(modelPos));
      // const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      // gl.useProgram(refractiveProgram);

      // gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_projMat"), false, projMat);
      // gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_viewMat"), false, viewMat);
      // gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_modelMat"), false, modelMat);
      // gl.uniformMatrix4fv(gl.getUniformLocation(refractiveProgram, "u_normalMat"), false, normalMat);
      // gl.uniform3fv(gl.getUniformLocation(refractiveProgram, "u_cameraPos"), vec3_create(0, 0, 0));

      // gl.activeTexture(gl.TEXTURE0);
      // gl.bindTexture(gl.TEXTURE_2D, frameTexture);
      // gl.uniform1i(gl.getUniformLocation(refractiveProgram, "u_texture"), 0);

      // gl.bindVertexArray(monkeyVao);
      // gl.drawArrays(gl.TRIANGLES, 0, MONKEY_VERTS.length / 8);
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

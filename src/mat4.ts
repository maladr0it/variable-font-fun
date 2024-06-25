import { Quat } from "./quat.ts";
import { Vec3, vec3_cross, vec3_dot, vec3_lenSquared, vec3_mul, vec3_normalize, vec3_sub } from "./vec3.ts";

export type Mat4 = Float32Array & {
  _tag: "Mat4";
};

const SAFE_EPSILON = Number.EPSILON;

const mat4_allocate = () => {
  return new Float32Array(16) as Mat4;
};

export const mat4_transpose = (m: Mat4) => {
  const result = mat4_allocate();

  result[0] = m[0];
  result[1] = m[4];
  result[2] = m[8];
  result[3] = m[12];

  result[4] = m[1];
  result[5] = m[5];
  result[6] = m[9];
  result[7] = m[13];

  result[8] = m[2];
  result[9] = m[6];
  result[10] = m[10];
  result[11] = m[14];

  result[12] = m[3];
  result[13] = m[7];
  result[14] = m[11];
  result[15] = m[15];

  return result;
};

export const mat4_inverseAffine = (m: Mat4) => {
  // Extract the 3x3 rotation + scale matrix components
  const r0 = m[0], r1 = m[1], r2 = m[2], r3 = m[4], r4 = m[5], r5 = m[6], r6 = m[8], r7 = m[9], r8 = m[10];

  const detR = r0 * (r4 * r8 - r7 * r5) -
    r1 * (r3 * r8 - r6 * r5) +
    r2 * (r3 * r7 - r6 * r4);

  if (Math.abs(detR) < SAFE_EPSILON) {
    return null; // Non-invertible
  }

  const invDetR = 1.0 / detR;

  const result = mat4_allocate();

  result[0] = (r4 * r8 - r7 * r5) * invDetR;
  result[1] = (r2 * r7 - r1 * r8) * invDetR;
  result[2] = (r1 * r5 - r2 * r4) * invDetR;
  result[3] = 0;

  result[4] = (r5 * r6 - r3 * r8) * invDetR;
  result[5] = (r0 * r8 - r2 * r6) * invDetR;
  result[6] = (r2 * r3 - r0 * r5) * invDetR;
  result[7] = 0;

  result[8] = (r3 * r7 - r4 * r6) * invDetR;
  result[9] = (r1 * r6 - r0 * r7) * invDetR;
  result[10] = (r0 * r4 - r1 * r3) * invDetR;
  result[11] = 0;

  result[12] = -(m[12] * result[0] + m[13] * result[4] + m[14] * result[8]);
  result[13] = -(m[12] * result[1] + m[13] * result[5] + m[14] * result[9]);
  result[14] = -(m[12] * result[2] + m[13] * result[6] + m[14] * result[10]);
  result[15] = 1;

  return result;
};

export const mat4_identity = () => {
  const result = mat4_allocate();

  result[0] = 1;
  result[1] = 0;
  result[2] = 0;
  result[3] = 0;

  result[4] = 0;
  result[5] = 1;
  result[6] = 0;
  result[7] = 0;

  result[8] = 0;
  result[9] = 0;
  result[10] = 1;
  result[11] = 0;

  result[12] = 0;
  result[13] = 0;
  result[14] = 0;
  result[15] = 1;

  return result;
};

export const mat4_proj = (fov: number, aspectRatio: number, zNear: number, zFar: number) => {
  const result = mat4_allocate();

  result[0] = 1 / (aspectRatio * Math.tan(fov / 2));
  result[1] = 0;
  result[2] = 0;
  result[3] = 0;

  result[4] = 0;
  result[5] = 1 / Math.tan(fov / 2);
  result[6] = 0;
  result[7] = 0;

  result[8] = 0;
  result[9] = 0;
  result[10] = (zNear + zFar) / (zNear - zFar);
  result[11] = -1;

  result[12] = 0;
  result[13] = 0;
  result[14] = 2 * zFar * zNear / (zNear - zFar);
  result[15] = 0;

  return result;
};

export const mat4_ortho = (left: number, right: number, bottom: number, top: number, near: number, far: number) => {
  const result = mat4_allocate();

  const width = right - left;
  const height = top - bottom;
  const depth = far - near;

  result[0] = 2 / width;
  result[1] = 0;
  result[2] = 0;
  result[3] = 0;

  result[4] = 0;
  result[5] = 2 / height;
  result[6] = 0;
  result[7] = 0;

  result[8] = 0;
  result[9] = 0;
  result[10] = -2 / depth;
  result[11] = 0;

  result[12] = -(right + left) / width;
  result[13] = -(top + bottom) / height;
  result[14] = -(far + near) / depth;
  result[15] = 1;

  return result;
};

export const mat4_lookAt = (position: Vec3, target: Vec3, up: Vec3) => {
  const facing = vec3_sub(target, position);
  if (vec3_lenSquared(facing) === 0) {
    // Position and target are the same.
    return null;
  } else if (vec3_lenSquared(vec3_cross(up, facing)) === 0) {
    // Up and facing are parallel.
    return null;
  }

  const zAxis = vec3_normalize(vec3_mul(facing, -1))!;
  const xAxis = vec3_normalize(vec3_cross(up, zAxis))!;
  const yAxis = vec3_normalize(vec3_cross(zAxis, xAxis))!;

  const result = mat4_allocate();

  result[0] = xAxis[0];
  result[1] = yAxis[0];
  result[2] = zAxis[0];
  result[3] = 0;

  result[4] = xAxis[1];
  result[5] = yAxis[1];
  result[6] = zAxis[1];
  result[7] = 0;

  result[8] = xAxis[2];
  result[9] = yAxis[2];
  result[10] = zAxis[2];
  result[11] = 0;

  result[12] = 0;
  result[13] = 0;
  result[14] = 0;
  result[15] = 1;

  return result;
};

export const mat4_mul = (a: Mat4, b: Mat4) => {
  const result = mat4_allocate();

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      // deno-fmt-ignore
      result[4 * row + col] = (
        a[4 * row + 0] * b[4 * 0 + col] +
        a[4 * row + 1] * b[4 * 1 + col] +
        a[4 * row + 2] * b[4 * 2 + col] +
        a[4 * row + 3] * b[4 * 3 + col]
      );
    }
  }

  return result;
};

export const mat4_translate = (t: Vec3) => {
  const result = mat4_allocate();

  result[0] = 1;
  result[1] = 0;
  result[2] = 0;
  result[3] = 0;

  result[4] = 0;
  result[5] = 1;
  result[6] = 0;
  result[7] = 0;

  result[8] = 0;
  result[9] = 0;
  result[10] = 1;
  result[11] = 0;

  result[12] = t[0];
  result[13] = t[1];
  result[14] = t[2];
  result[15] = 1;

  return result;
};

export const mat4_rot = (q: Quat) => {
  const result = mat4_allocate();

  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];

  result[0] = 1 - 2 * y * y - 2 * z * z;
  result[1] = 2 * x * y + 2 * w * z;
  result[2] = 2 * x * z - 2 * w * y;
  result[3] = 0;

  result[4] = 2 * x * y - 2 * w * z;
  result[5] = 1 - 2 * x * x - 2 * z * z;
  result[6] = 2 * y * z + 2 * w * x;
  result[7] = 0;

  result[8] = 2 * x * z + 2 * w * y;
  result[9] = 2 * y * z - 2 * w * x;
  result[10] = 1 - 2 * x * x - 2 * y * y;
  result[11] = 0;

  result[12] = 0;
  result[13] = 0;
  result[14] = 0;
  result[15] = 1;

  return result;
};

export const mat4_scale = (s: Vec3) => {
  const result = mat4_allocate();

  result[0] = s[0];
  result[1] = 0;
  result[2] = 0;
  result[3] = 0;

  result[4] = 0;
  result[5] = s[1];
  result[6] = 0;
  result[7] = 0;

  result[8] = 0;
  result[9] = 0;
  result[10] = s[2];
  result[11] = 0;

  result[12] = 0;
  result[13] = 0;
  result[14] = 0;
  result[15] = 1;

  return result;
};

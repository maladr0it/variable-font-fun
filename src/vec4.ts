import { Mat4 } from "./mat4.ts";

export type Vec4 = Float32Array & {
  _tag: "Vec4";
};

const vec4_allocate = () => {
  return new Float32Array(4) as Vec4;
};

export const vec4_create = (x: number, y: number, z: number, w: number) => {
  const result = vec4_allocate();

  result[0] = x;
  result[1] = y;
  result[2] = z;
  result[3] = w;

  return result;
};

export const vec4_mul = (a: Vec4, s: number) => {
  const result = vec4_allocate();

  for (let i = 0; i < 4; i += 1) {
    result[i] = a[i] * s;
  }

  return result;
};

export const vec4_mulMat4 = (a: Vec4, b: Mat4) => {
  const result = vec4_allocate();

  for (let i = 0; i < 3; ++i) {
    // deno-fmt-ignore
    result[i] = (
      a[0] * b[4 * 0 + i] +
      a[1] * b[4 * 1 + i] +
      a[2] * b[4 * 2 + i] +
      a[3] * b[4 * 3 + i]
    );
  }

  return result;
};

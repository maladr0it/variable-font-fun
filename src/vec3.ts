import { Quat } from "./quat.ts";

export type Vec3 = Float32Array & {
  _tag: "Vec3";
};

const vec3_allocate = () => {
  return new Float32Array(3) as Vec3;
};

export const vec3_create = (x: number, y: number, z: number) => {
  const result = vec3_allocate();

  result[0] = x;
  result[1] = y;
  result[2] = z;

  return result;
};

export const vec3_normalize = (v: Vec3) => {
  const lenSquared = v[0] * v[0] + v[1] * v[1] * v[2] * v[2];
  if (lenSquared === 0) {
    return null;
  }

  const len = Math.sqrt(lenSquared);
  const result = vec3_allocate();

  result[0] = v[0] / len;
  result[1] = v[1] / len;
  result[2] = v[2] / len;

  return result;
};

export const vec3_add = (a: Vec3, b: Vec3) => {
  const result = vec3_allocate();

  for (let i = 0; i < 3; i += 1) {
    result[i] = a[i] + b[i];
  }

  return result;
};

export const vec3_mul = (a: Vec3, s: number) => {
  const result = vec3_allocate();

  for (let i = 0; i < 3; i += 1) {
    result[i] = a[i] * s;
  }

  return result;
};

export const vec3_fromQuat = (q: Quat) => {
  return vec3_create(q[0], q[1], q[2]);
};

import { Vec3 } from "./vec3.ts";

export type Quat = Float32Array & {
  _tag: "Quat";
};

const quat_allocate = () => {
  return new Float32Array(4) as Quat;
};

export const quat_create = (x: number, y: number, z: number, w: number) => {
  return new Float32Array([x, y, z, w]) as Quat;
};

export const quat_identity = () => {
  return quat_create(0, 0, 0, 1);
};

export const quat_axisAngle = (axis: Vec3, theta: number) => {
  const result = quat_allocate();
  const s = Math.sin(theta * 0.5);
  const c = Math.cos(theta * 0.5);

  result[0] = s * axis[0];
  result[1] = s * axis[1];
  result[2] = s * axis[2];
  result[3] = c;

  return result;
};

export const quat_inverse = (q: Quat) => {
  const result = quat_allocate();

  result[0] = -q[0];
  result[1] = -q[1];
  result[2] = -q[2];
  result[3] = q[3];

  return result;
};

export const quat_mul = (a: Quat, b: Quat) => {
  const result = quat_allocate();
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];

  result[0] = aw * bx + ax * bw + ay * bz - az * by;
  result[1] = aw * by - ax * bz + ay * bw + az * bx;
  result[2] = aw * bz + ax * by - ay * bx + az * bw;
  result[3] = aw * bw - ax * bx - ay * by - az * bz;

  return result;
};

export const quat_fromVec3 = (v: Vec3) => {
  return quat_create(v[0], v[1], v[2], 0);
};

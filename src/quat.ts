import { Mat4 } from "./mat4.ts";
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

export const quat_fromRotMat = (m: Mat4) => {
  let q: Quat | null = null;
  let t: number | null = null;

  const m00 = m[0], m01 = m[4], m02 = m[8];
  const m10 = m[1], m11 = m[5], m12 = m[9];
  const m20 = m[2], m21 = m[6], m22 = m[10];

  if (m22 < 0) {
    if (m00 > m11) {
      t = 1 + m00 - m11 - m22;
      q = quat_create(t, m01 + m10, m20 + m02, m12 - m21);
    } else {
      t = 1 - m00 + m11 - m22;
      q = quat_create(m01 + m10, t, m12 + m21, m20 - m02);
    }
  } else {
    if (m00 < -m11) {
      t = 1 - m00 - m11 + m22;
      q = quat_create(m20 + m02, m12 + m21, t, m01 - m10);
    } else {
      t = 1 + m00 + m11 + m22;
      q = quat_create(m12 - m21, m20 - m02, m01 - m10, t);
    }
  }

  const s = 0.5 / Math.sqrt(t);
  q[0] *= s;
  q[1] *= s;
  q[2] *= s;
  q[3] *= s;

  return q;
};

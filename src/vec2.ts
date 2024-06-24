export type Vec2 = Float32Array & {
  _tag: "Vec2";
};

const vec2_allocate = () => {
  return new Float32Array(3) as Vec2;
};

export const vec2_create = (x: number, y: number) => {
  const result = vec2_allocate();

  result[0] = x;
  result[1] = y;

  return result;
};

export const vec2_add = (a: Vec2, b: Vec2) => {
  const result = vec2_allocate();

  for (let i = 0; i < 2; i += 1) {
    result[i] = a[i] + b[i];
  }

  return result;
};

export const vec2_sub = (a: Vec2, b: Vec2) => {
  const result = vec2_allocate();

  for (let i = 0; i < 2; ++i) {
    result[i] = a[i] - b[i];
  }
  return result;
};

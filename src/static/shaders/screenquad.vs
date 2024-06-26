#version 300 es

layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_texCoord;
layout(location = 2) in vec3 a_normal;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;

  gl_Position = vec4(a_pos.x, a_pos.y, 0.0f, 1.0f);
}
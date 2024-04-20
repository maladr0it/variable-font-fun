# version 300 es

precision highp float;

uniform sampler2D u_texture;

in vec3 v_pos;
in vec2 v_texCoord;
in vec3 v_normal;

out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_texCoord);
}
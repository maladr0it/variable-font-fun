# version 300 es

uniform mat4 u_projMat;
uniform mat4 u_viewMat;
uniform mat4 u_modelMat;
uniform mat4 u_normalMat;

layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec2 a_texCoord;
layout(location = 2) in vec3 a_normal;

out vec3 v_pos;
out vec2 v_texCoord;
out vec3 v_normal;

void main() {
  v_pos = vec3(u_modelMat * vec4(a_pos, 1.0));
  v_texCoord = a_texCoord;
  v_normal = vec3(u_normalMat * vec4(a_normal, 0.0)); // maybe this needs to be normalized;

  gl_Position = u_projMat * u_viewMat * u_modelMat * vec4(a_pos, 1.0);
}
# version 300 es

uniform mat4 u_projMat;
uniform mat4 u_viewMat;
uniform mat4 u_modelMat;
uniform mat4 u_normalMat;

layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec2 a_texCoord;
layout(location = 2) in vec3 a_normal;
layout(location = 3) in vec3 a_tangent;

out vec3 v_pos;
out vec2 v_texCoord;
out vec3 v_normal;
out mat3 v_tbnMat;

void main() {
  v_pos = vec3(u_modelMat * vec4(a_pos, 1.0));
  v_texCoord = a_texCoord;
  v_normal = normalize(vec3(u_normalMat * vec4(a_normal, 0.0)));

  if(a_tangent.x == 0.0) {
    // return;
  }

  // get vec
  vec3 T = normalize(vec3(u_modelMat * vec4(a_tangent, 0.0)));
  vec3 N = normalize(vec3(u_modelMat * vec4(a_normal, 0.0)));
  vec3 B = normalize(cross(N, T));

  // vec3 T = normalize((u_modelMat * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  // vec3 N = normalize((u_modelMat * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  // vec3 B = normalize((u_modelMat * vec4(0.0, 1.0, 0.0, 0.0)).xyz);

  v_tbnMat = mat3(T, B, N);

  gl_Position = u_projMat * u_viewMat * u_modelMat * vec4(a_pos, 1.0);
}
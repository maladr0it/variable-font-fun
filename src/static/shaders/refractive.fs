# version 300 es

precision highp float;

uniform vec3 u_cameraPos;
uniform samplerCube u_cubemap;

in vec3 v_pos;
in vec3 v_normal;

out vec4 outColor;

void main() {
  // vec3 viewDir = normalize(v_pos - u_cameraPos);

  // float refractiveIndex = 1.05;
  // vec3 refractionDir = refract(viewDir, normalize(v_normal), 1.0 / refractiveIndex);

  // outColor = texture(u_cubemap, refractionDir);

  outColor = vec4(1.0, 0.0, 0.0, 1.0);
}
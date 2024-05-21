# version 300 es

precision highp float;

uniform vec3 u_cameraPos;
uniform sampler2D u_texture;

in vec3 v_pos;
in vec3 v_normal;
in vec2 v_texCoord;

out vec4 outColor;

void main() {
  vec4 tintColor = vec4(0.2, 0.8, 0.2, 1.0);

  float refractiveIndex = 1.05;

  vec3 viewDir = normalize(v_pos - u_cameraPos);
  vec3 normalDir = normalize(v_normal);

  // pixel coordinates
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(u_texture, 0));

  vec3 refractDir = refract(viewDir, normalDir, 1.0 / refractiveIndex);
  vec2 refractUv = uv + refractDir.xy * 0.05;

  vec4 textureColor = texture(u_texture, refractUv);

  outColor = mix(textureColor, tintColor, 0.5);
}
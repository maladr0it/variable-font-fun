# version 300 es

precision highp float;

uniform vec3 u_cameraPos;
uniform sampler2D u_texture;
uniform samplerCube u_cubemap;

in vec3 v_pos;
in vec3 v_cubemapCoord;
in vec2 v_texCoord;
in vec3 v_normal;

out vec4 outColor;

void main() {
  vec3 viewDir = normalize(v_pos - u_cameraPos);
  vec3 reflectionDir = reflect(viewDir, normalize(v_normal));

  // Convert to left-handed coordinate system used by cubemaps
  reflectionDir.x = -reflectionDir.x;
  reflectionDir.y = -reflectionDir.y;

  vec4 color = texture(u_texture, v_texCoord);
  vec4 reflectiveColor = vec4(texture(u_cubemap, reflectionDir).rgb, 1.0);
  float mask = color.a;

  outColor = vec4(reflectiveColor.rgb, color.a);
}

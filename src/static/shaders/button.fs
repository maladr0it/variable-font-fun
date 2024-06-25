#version 300 es

precision highp float;

struct DirectionalLight {
  vec3 dir;
  vec3 ambient;
  vec3 diffuse;
  vec3 specular;
};

struct PointLight {
  vec3 pos;
  vec3 ambient;
  vec3 diffuse;
  vec3 specular;
  float constant;
  float linear;
  float quadratic;
};

// ui properties
uniform vec2 u_size;
uniform float u_cornerRadius;

// material properties
uniform sampler2D u_diffuseMap;
uniform sampler2D u_specularMap;
uniform sampler2D u_normalMap;
uniform float u_shininess;

// scene properties
uniform vec3 u_viewPos;
uniform DirectionalLight u_directionalLight;
uniform int u_numPointLights;
uniform PointLight[16] u_pointLights;

in vec3 v_pos;
in vec2 v_texCoord;
in vec3 v_normal;
in mat3 v_tbnMat;

out vec4 outColor;

vec3 calcDirectionalLight(DirectionalLight light, vec3 normal, vec3 viewDir) {
  vec3 lightDir = normalize(-light.dir);

  // ambient
  vec3 ambient = light.ambient * vec3(texture(u_diffuseMap, v_texCoord));

  // diffuse
  float diffuseStrength = max(dot(normal, lightDir), 0.0f);
  vec3 diffuse = light.diffuse * diffuseStrength * vec3(texture(u_diffuseMap, v_texCoord));

  // specular
  vec3 reflectDir = reflect(-lightDir, normal);
  float specularStrength = pow(max(dot(viewDir, reflectDir), 0.0f), u_shininess);
  vec3 specular = light.specular * (specularStrength * vec3(texture(u_specularMap, v_texCoord)));

  return ambient + diffuse + specular;
}

vec3 calcPointLight(PointLight light, vec3 normal, vec3 viewDir) {
  vec3 lightDir = normalize(light.pos - v_pos);
  float distance = length(light.pos - v_pos);
  float attenuation = 1.0f / (light.constant + light.linear * distance + light.quadratic * (distance * distance));

  // ambient
  float ambientStrength = attenuation;
  vec3 ambient = ambientStrength * light.ambient * vec3(texture(u_diffuseMap, v_texCoord));

  // diffuse
  float diffuseStrength = attenuation * max(dot(normal, lightDir), 0.0f);
  vec3 diffuse = light.diffuse * diffuseStrength * vec3(texture(u_diffuseMap, v_texCoord));

  // specular
  vec3 reflectDir = reflect(-lightDir, normal);
  float specularStrength = attenuation * pow(max(dot(viewDir, reflectDir), 0.0f), u_shininess);
  vec3 specular = light.specular * (specularStrength * vec3(texture(u_specularMap, v_texCoord)));

  return ambient + diffuse + specular;
}

void main() {
  vec2 fragPos = v_texCoord * u_size;

  // Corner radius
  //
  float r = u_cornerRadius;
  vec2 botLeftCorner = vec2(0.0f + r, 0.0f + r);
  vec2 botRightCorner = vec2(u_size.x - r, 0.0f + r);
  vec2 topRightCorner = vec2(u_size.x - r, u_size.y - r);
  vec2 topLeftCorner = vec2(0.0f + r, u_size.y - r);

  // bottom-left corner
  if(fragPos.x < botLeftCorner.x && fragPos.y < botLeftCorner.y && distance(fragPos, botLeftCorner) > r) {
    discard;
  }
  // bottom-right corner
  if(fragPos.x > botRightCorner.x && fragPos.y < botRightCorner.y && distance(fragPos, botRightCorner) > r) {
    discard;
  }
  // top-right corner
  if(fragPos.x > topRightCorner.x && fragPos.y > topRightCorner.y && distance(fragPos, topRightCorner) > r) {
    discard;
  }
  // top-left corner
  if(fragPos.x < topLeftCorner.x && fragPos.y > topLeftCorner.y && distance(fragPos, topLeftCorner) > r) {
    discard;
  }

  vec3 normal = texture(u_normalMap, v_texCoord).rgb;

  normal = normal * 2.0f - 1.0f;
  normal = normalize(v_tbnMat * normal);

  // Lighting
  vec3 viewDir = normalize(u_viewPos - v_pos);

  vec3 lightingResult = vec3(0.0f);
  lightingResult += calcDirectionalLight(u_directionalLight, normal, viewDir);

  for(int i = 0; i < u_numPointLights; i++) {
    lightingResult += calcPointLight(u_pointLights[i], normal, viewDir);
  }

  outColor = vec4(lightingResult, 1.0f);
}
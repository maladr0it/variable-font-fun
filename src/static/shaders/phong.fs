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

struct Spotlight {
  vec3 pos;
  vec3 dir;
  float cutoff;
  float outerCutoff;
  vec3 ambient;
  vec3 diffuse;
  vec3 specular;
  float constant;
  float linear;
  float quadratic;
};

uniform vec3 u_viewPos;

// material properties
uniform sampler2D u_diffuseMap;
uniform sampler2D u_specularMap;
uniform float u_shininess;

uniform DirectionalLight u_directionalLight;

uniform int u_numPointLights;
uniform PointLight[16] u_pointLights;

uniform int u_numSpotlights;
uniform Spotlight[16] u_spotlights;

in vec3 v_pos;
in vec2 v_texCoord;
in vec3 v_normal;

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

vec3 calcSpotlight(Spotlight light, vec3 normal, vec3 viewDir) {
  vec3 lightDir = normalize(light.pos - v_pos);
  float distance = length(light.pos - v_pos);
  float attenuation = 1.0f / (light.constant + light.linear * distance + light.quadratic * (distance * distance));

  float theta = dot(lightDir, normalize(-light.dir));
  // Interpolating the intensity of the spotlight between the cutoff and outer cutoff
  float intensity = clamp((theta - light.outerCutoff) / (light.cutoff - light.outerCutoff), 0.0f, 1.0f);

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

  return ambient + intensity * diffuse + intensity * specular;
}

void main() {
  vec3 viewDir = normalize(u_viewPos - v_pos);
  vec3 normal = normalize(v_normal);

  vec3 result = vec3(0.0f);
  result += calcDirectionalLight(u_directionalLight, normal, viewDir);

  for(int i = 0; i < u_numPointLights; i++) {
    result += calcPointLight(u_pointLights[i], normal, viewDir);
  }

  for(int i = 0; i < u_numSpotlights; i++) {
    result += calcSpotlight(u_spotlights[i], normal, viewDir);
  }

  outColor = vec4(result, 1.0f);
}
const shader_createProgram = (
  gl: WebGL2RenderingContext,
  vertexShaderSource: string,
  fragmentShaderSource: string,
) => {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  {
    const success = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
    if (!success) {
      console.error(gl.getShaderInfoLog(vertexShader));
      gl.deleteShader(vertexShader);
      return null;
    }
  }

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  {
    const success = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
    if (!success) {
      console.error(gl.getShaderInfoLog(fragmentShader));
      gl.deleteShader(fragmentShader);
      return null;
    }
  }

  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  {
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
  }

  return program;
};

export const shader_load = async (gl: WebGL2RenderingContext, vertexPath: string, fragmentPath: string) => {
  const vertexSouce = await fetch(vertexPath).then((resp) => resp.text());
  const fragmentSource = await fetch(fragmentPath).then((resp) => resp.text());

  return shader_createProgram(gl, vertexSouce, fragmentSource);
};

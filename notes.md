# TODO

we set a viewing distance in px, something at 0,0,0 will display at the scale it would in 2d
is this actually useful?

we would really like svg graphics to use the same units as the 3d world
let's scale everything up so this can work

forget this for now, let's just use small units for the 3d world



## old code

// render reflective svg texture
    {
      const modelPos = svgPos;
      const modelRot = svgRot;
      const modelScale = vec3_create(SVG_WIDTH, SVG_HEIGHT, 1);

      let modelMat = mat4_identity();
      modelMat = mat4_mul(modelMat, mat4_scale(modelScale));
      // modelMat = mat4_mul(modelMat, mat4_rot(modelRot));
      modelMat = mat4_mul(modelMat, mat4_translate(modelPos));
      const normalMat = mat4_transpose(mat4_inverseAffine(modelMat)!);

      gl.useProgram(reflectiveProgram);

      gl.uniformMatrix4fv(gl.getUniformLocation(reflectiveProgram, "u_projMat"), false, projMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(reflectiveProgram, "u_viewMat"), false, viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(reflectiveProgram, "u_modelMat"), false, modelMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(reflectiveProgram, "u_normalMat"), false, normalMat);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, svgTexture);
      gl.uniform1i(gl.getUniformLocation(reflectiveProgram, "u_texture"), 0);

      gl.activeTexture(gl.TEXTURE0 + 1);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTexture);
      gl.uniform1i(gl.getUniformLocation(reflectiveProgram, "u_cubemap"), 1);

      gl.bindVertexArray(rectVao);
      gl.drawArrays(gl.TRIANGLES, 0, RECT_VERTS.length / 8);
    }


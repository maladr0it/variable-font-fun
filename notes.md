# TODO

## HERE

[ ] how can we offer a coordinate system to users so y is down, just like SVG uses, while not changing our internals?


## fbo if we need it later

// const colorRenderbuffer = gl.createRenderbuffer()!;
  // gl.bindRenderbuffer(gl.RENDERBUFFER, colorRenderbuffer);
  // gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, canvas.width, canvas.height);
  // gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  // const depthRenderbuffer = gl.createRenderbuffer()!;
  // gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderbuffer);
  // gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, canvas.width, canvas.height);
  // gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  // const fbo = gl.createFramebuffer()!;
  // gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  // gl.framebufferTexture2D(
  //   gl.FRAMEBUFFER,
  //   gl.COLOR_ATTACHMENT0,
  //   gl.TEXTURE_2D,
  //   frameTexture,
  //   0,
  // );

  // gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorRenderbuffer);
  // gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderbuffer);
  // gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
  //   console.error("Framebuffer is not complete.");
  // }
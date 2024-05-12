# Performance / flashing
It seems the texture can update quickly or even synchronously, no need to debounce?
remaking a new svg every frame is causing flashing, so let's instead update the embedded svg with CSS variables, but make a new one each frame for webGL
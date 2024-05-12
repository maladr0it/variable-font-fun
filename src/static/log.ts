const log = {
  content: "",
};

export const log_write = (...data: unknown[]) => {
  for (let i = 0; i < data.length; ++i) {
    log.content += `${data[i]} `;
  }
  log.content += "\n";
};

export const log_clear = () => {
  log.content = "";
};

export const log_getContent = () => {
  return log.content;
};

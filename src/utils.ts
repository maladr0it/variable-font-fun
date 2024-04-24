export const loadImage = (path: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.src = path;

  return new Promise((resolve, reject) => {
    image.addEventListener("load", () => {
      resolve(image);
    });
    image.addEventListener("error", (event) => {
      reject(event);
    });
  });
};

export const delay = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const debounce = <T extends unknown[]>(fn: (...args: T) => void, threshold: number) => {
  let timeout: number | undefined = undefined;

  return (...args: T) => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      fn(...args);
    }, threshold);
  };
};

export const getDataURL = (path: string): Promise<string> => {
  return fetch(path).then((res) => res.blob()).then((blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);

    return new Promise((resolve) => {
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
    });
  });
};

'use strict';

const offset = 1024 * 1024 * 1024;

module.exports = () => {
  let data = [];

  return {
    get(i, j) {
      const slice = data[i + offset];
      return slice && slice[j + offset];
    },
    set(i, j, value) {
      i += offset;
      j += offset;

      const slice = data[i] || (data[i] = []);

      return (slice[j] = value);
    },
    clear() {
      data = [];
    },
  };
};

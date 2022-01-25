export const Context = {
  // @param src
  loadComponentCode() {
    throw new Error('loadComponentCode should must be overrided');
  },
  // @param src
  // @param text
  compileComponentCode() {
    throw new Error('compileComponent should must be overrided');
  },
};

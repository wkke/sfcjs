Object.defineProperty(document, 'currentScript', {
  get() {
    return {
      src: '/index.htm',
      getAttribute: () => {},
    };
  },
});

window.URL.createObjectURL = jest.fn();
window.Worker = class Worker {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = () => {};
  }

  postMessage() {}

  addEventListener() {}
};

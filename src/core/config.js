const settings = {
  baseUrl: window.location.href,
};

export function config(options) {
  if (typeof options === 'string') {
    return settings[options];
  }
  if (options && typeof options === 'object') {
    Object.assign(settings, options);
  }
}

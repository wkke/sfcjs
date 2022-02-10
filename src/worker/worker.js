import { loadComponent, compileComponent } from '../compiler';

self.addEventListener('message', async (e) => {
  if (!e.data) {
    return;
  }

  const data = JSON.parse(e.data);
  const { type } = data;
  if (type === 'load') {
    const { src, id } = data;
    const { code, refs } = await loadComponent(src);
    postMessage(JSON.stringify({
      type,
      id,
      code,
      refs,
    }));
  } else if (type === 'compile') {
    const { src, text, id } = data;
    const { code, refs } = compileComponent(text, src);
    postMessage(JSON.stringify({
      type,
      id,
      code,
      refs,
    }));
  }
});

import { loadComponent, compileComponent } from '../compiler';

self.addEventListener('message', async (e) => {
  if (!e.data) {
    return;
  }

  const data = JSON.parse(e.data);
  const { type } = data;
  if (type === 'init') {
    const { src, id } = data;
    const code = await loadComponent(src);
    postMessage(JSON.stringify({
      type,
      id,
      code,
    }));
  } else if (type === 'compile') {
    const { src, text, id } = data;
    const code = compileComponent(text, src);
    postMessage(JSON.stringify({
      type,
      id,
      code,
    }));
  }
});

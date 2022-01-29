import { loadComponent, compileComponent } from '../compiler';

self.addEventListener('message', async (e) => {
  if (!e.data) {
    return;
  }

  const data = JSON.parse(e.data);
  const { type } = data;
  if (type === 'load') {
    const { src, id } = data;
    const chunk = await loadComponent(src);
    postMessage(JSON.stringify({
      type,
      id,
      ...chunk,
    }));
  } else if (type === 'compile') {
    const { src, text, id } = data;
    const chunk = await compileComponent(src, text);
    postMessage(JSON.stringify({
      type,
      id,
      ...chunk,
    }));
  }
});

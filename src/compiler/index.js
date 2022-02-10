import { parseCss, replaceCssUrl } from './css-parser';
import { parseJs } from './js-parser';
import { parseHtml } from './html-parser';
import { resolveUrl } from '../utils';

export function parseComponent(text, source, options = {}) {
  let jsSource = {};
  let cssText = '';

  const html = text
    .replace(/<script.*?>([\w\W]*?)<\/script>\n?/gmi, (_, sourceCode) => {
      const jsSourceCode = options.prettyJs ? options.prettyJs(sourceCode) : sourceCode;
      jsSource = parseJs(jsSourceCode);
      return '';
    })
    .replace(/<style>([\w\W]*?)<\/style>\n?/gmi, (_, sourceCode) => {
      cssText = options.prettyCss ? options.prettyCss(sourceCode) : sourceCode;
      return '';
    })
    .trim();

  const { imports, deps, code: jsCode, components, vars } = jsSource;

  const { code: cssCode, refs } = cssText ? parseCss(cssText, source, vars) : {};
  const htmlSource = options.prettyHtml ? options.prettyHtml(html) : html;
  const { code: htmlCode } = htmlSource ? parseHtml(htmlSource, components, vars, source) : null;

  return {
    imports,
    deps,
    components,
    jsCode,
    cssCode,
    htmlCode,
    refs,
  };
}

export function genComponent({ imports = [], deps = [], jsCode, cssCode, htmlCode }, source, options = {}) {
  const output = [
    ...imports.map(([vars, src]) => `import ${vars} from "${resolveUrl(source, src)}";`),
    '\n',
    `SFCJS.define("${source}", [${deps.map(([, src]) => `"${src}"`).join(', ')}], async function(${deps.map(([name]) => `${name}`).join(', ')}) {`,
    'const _sfc = this',
    jsCode,
    'return {',
    cssCode ? `dye:${cssCode},` : '',
    `render:${htmlCode || '() => null'}`,
    '}',
    '});',
  ].join('\n');
  const res = options.prettyJs ? options.prettyJs(output) : output;
  return res;
}

export async function compileComponent(text, source, options) {
  const asts = parseComponent(text, source, options);
  const promises = [
    Promise.resolve().then(() => genComponent(asts, source, options)),
  ];

  const { refs: refSrcs } = asts;
  if (refSrcs && refSrcs.length) {
    promises.push(...refSrcs.map(async ({ type, url, src }) => {
      const text = await fetch(url).then(res => res.text());
      const code = type === 'text/css' ? replaceCssUrl(text, source) : text;
      return { code, type, url, src };
    }));
  }

  const [code, ...refs] = await Promise.all(promises);
  return { code, refs };
}

export function loadComponent(source, options) {
  return fetch(source).then(res => res.text())
    .then(text => compileComponent(text, source, options));
}

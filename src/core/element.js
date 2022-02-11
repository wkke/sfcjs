import { resolveUrl, each, tryParse, createReady, camelcase, remap } from '../utils';
import { initComponent, components, updateComponent, insertBlob, register } from './framework';
import { Context } from './context';

const BASE_URL = window.location.href;

// eslint-disable-next-line camelcase
class SFC_Element extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.rootElement = null;

    this.$ready = createReady();
  }

  getOptions() {
    return {};
  }

  getProps() {
    const { attributes } = this;
    const options = this.getOptions();
    const mapping = remap(options.props || {});
    const props = {};
    const attrs = {};
    each(attributes, ({ name, value }) => {
      if (name in mapping) {
        props[mapping[name]] = tryParse(value, true);
      } else if (name[0] === ':') {
        props[camelcase(name.substr(1))] = tryParse(value);
      } else if (name.indexOf('data-') === 0) {
        props[camelcase(name.substr(5))] = tryParse(value);
      } else {
        attrs[name] = value;
      }
    });
    return props;
  }

  async connectedCallback() {
    const options = this.getOptions();
    const src = options.src || this.getAttribute('src');
    if (!src) {
      return;
    }

    const passive = 'passive' in options ? options.passive : this.getAttribute('passive');

    // 这里使用了一个技巧，就是在一开始的时候，让slot存在，显示出内部信息，当需要挂载的时候清空
    // 如果不做这个操作，那么当<t-sfc>挂载之后，就会立即清空内部的内容
    // 这个能力仅对传入了src的有效，传入src的是真正用于入口的组件，没有传的是内部使用，不提供这个功能
    // 只有当调用mount之后，才会消失，如果开发者自己手动调用过程中想提前清空，也可以调用clear
    const pending = 'pendingSlot' in options ? options.pendingSlot : this.getAttribute('pending-slot');
    const isPending = +pending;
    this.shadowRoot.innerHTML = isPending ? '<slot></slot>' : '';

    const absUrl = resolveUrl(BASE_URL, src);
    this.absUrl = absUrl;

    if (!document.querySelector(`[sfc-src="${src}"]`) && !components[absUrl]) {
      await this.setup();
    }

    this.$ready(true);

    if (!passive) {
      await this.mount();
    }

    this.observeAttrs();
  }

  async setup() {
    const output = await Context.loadComponentCode(this.absUrl);
    await insertBlob(this.absUrl, output);
    this.dispatchEvent(new Event('loaded'));
  }

  clear() {
    this.shadowRoot.innerHTML = ''; // 清空内容
  }

  async mount(meta = {}) {
    const props = this.getProps();

    const options = this.getOptions();
    const mapping = remap(options.events || {});
    const events = new Proxy({}, {
      get: (_, key) => (e) => {
        const event = key in mapping ? mapping[key] : key;
        this.dispatchEvent(new CustomEvent(event, { detail: e }));
      },
      has: () => true,
    });
    const info = {
      props,
      events,
      ...meta,
    };

    await this.$ready();
    const { absUrl } = this;
    const element = await initComponent(absUrl, info);
    this.rootElement = element;
    await element.setup();
    this.clear();
    await element.mount(this.shadowRoot);

    this.dispatchEvent(new Event('mounted'));
  }

  observeAttrs() {
    // 通过 MutationObserver 来监听属性变化
    const observer = new MutationObserver((mutationsList) => {
      let flag = false;
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes') {
          flag = true;
        }
      }
      if (flag) {
        const props = this.getProps();
        updateComponent(this.rootElement, { props });
      }
    });
    observer.observe(this, { attributes: true });
    this.observer = observer;
  }

  disconnectedCallback() {
    if (this.rootElement) {
      this.rootElement.unmount();
    }
    if (this.observer) {
      this.observer.disconnect();
    }

    this.dispatchEvent(new Event('unmounted'));
  }
}

export async function privilege(tag, options, source) {
  if ((!options && !source) || (options && !options.src && !source)) {
    throw new Error('privilege必须传入options.src或code');
  }

  const code = typeof source === 'object' && source instanceof HTMLElement && source.tagName === 'TEMPLATE' ? source.innerHTML : source;

  const { src, props, events, pendingSlot } = options || {};
  const url = src || `/-/${tag}`;

  let style = null;
  // 在不需要pending的能力下，不显示内容，直至组件加载完成
  if (!pendingSlot) {
    style = document.createElement('style');
    style.textContent = `${tag} { display: none }`;
    document.head.appendChild(style);
  }

  if (code) {
    await register(url, code);
  }

  const absUrl = resolveUrl(BASE_URL, url);
  const info = {
    src: absUrl,
    props,
    events,
    pendingSlot,
  };
  // eslint-disable-next-line camelcase
  class PrivilegeElement extends SFC_Element {
    getOptions() {
      return info;
    }
  }
  customElements.define(tag, PrivilegeElement);

  if (style) {
    document.head.removeChild(style);
  }
}

;(function () {
  let style = document.createElement('style');
  style.textContent = 't-sfc:not([pending-slot=1]) { display: none }';
  document.head.appendChild(style);

  const run = () => {
    const define = () => {
      customElements.define('t-sfc', SFC_Element);
      document.head.removeChild(style);
      style = null;
    };
    const deferers = [];
    const templates = document.querySelectorAll('template[sfc-src]');
    if (templates.length) {
      templates.forEach((el) => {
        const src = el.getAttribute('sfc-src');
        const text = el.innerHTML;
        deferers.push(Promise.resolve().then(() => register(src, text)));
      });
    }
    if (deferers.length) {
      Promise.all(deferers).then(define)
        .catch(define);
    } else {
      define();
    }
  };
  // 文档加载完之后再执行，这样有利于开发者自己在自己的js中动态插入一些内容
  if (document.querySelectorAll('script').length) {
    window.addEventListener('load', run);
  } else {
    // 确保是异步执行，以便于开发自己有机会进行implement
    setTimeout(run, 0);
  }
}());

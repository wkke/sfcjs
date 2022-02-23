/* eslint-disable brace-style */
import { isAbsUrl } from '../utils';
import { isUndefined } from 'ts-fns';

const OPERATORS = ['++', '--', '**'];
const SPECIARES = ['(', ')', '[', ']', '{', '}', ';', '\n', '='];
const MODIFIERS = ['+=', '-=', '*=', '/=', '%='];

export function tokenize(code) {
  const tokens = [];

  let cursor = 0;
  let token = '';
  let str = '';

  const quotes = [];

  for (let len = code.length; cursor < len; cursor ++) {
    const char = code[cursor];

    const twoChars = char + code[cursor + 1];
    if ([...OPERATORS, ...MODIFIERS].includes(twoChars)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      if (str) {
        tokens.push(str);
        str = '';
      }
      tokens.push(twoChars);
      cursor += 1;
    } else if (SPECIARES.includes(char)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      if (str) {
        tokens.push(str);
        str = '';
      }
      tokens.push(char);
    } else if (['"', '\'', '`'].includes(char)) {
      const latest = quotes[quotes.length - 1];
      if (latest && latest === char) {
        quotes.pop();
        token += char;
        if (!quotes.length) {
          tokens.push(token);
          token = '';
        }
      } else {
        quotes.push(char);
        if (str) {
          tokens.push(str);
          str = '';
        }
        token += char;
      }
    } else if (quotes.length) {
      if (str) {
        tokens.push(str);
        str = '';
      }
      token += char;
    } else if (token && char === ':') {
      token += ':';
      tokens.push(token);
      token = '';
    } else if (token && char === ' ') {
      let following = ' ';
      let i = cursor + 1;
      let next = code[i];
      while (next === ' ') {
        following += ' ';
        i += 1;
        next = code[i];
      }

      if (next === ':') {
        token += `${following}:`;
        cursor = i;
        tokens.push(token);
        token = '';
      } else {
        tokens.push(token);
        token = '';
        str = ' ';
      }
    } else if (/\w/.test(char)) {
      if (str) {
        tokens.push(str);
        str = '';
      }
      token += char;
    } else {
      if (token) {
        tokens.push(token);
        token = '';
      }
      str += char;
    }
  }

  if (token) {
    tokens.push(token);
    token = '';
  }
  if (str) {
    tokens.push(str);
    str = '';
  }

  return tokens;
}

export function parseJs(sourceCode) {
  const deps = [];
  const imports = [];
  const components = [];
  const lines = sourceCode
    .replace(/import(.+?|\{[\w\W]+?\})from\s*?['"]sfc:(.+?)['"][;\n$]/gmi, (_, declares, src) => {
      if (src.indexOf('.') === 0 || src.indexOf('/') === 0 || isAbsUrl(src)) {
        components.push([declares.trim(), src]);
      }
      deps.push([declares.trim(), src]);
      return '';
    })
    .replace(/import(.+?|\{[\w\W]+?\})from\s*?['"](.+?)['"][;\n$]/gmi, (_, declares, src) => {
      imports.push([declares.trim(), src]);
      return '';
    })
    .replace(/const (.+?|\{[\w\W]+?\})\s*?=\s*?await\s*?import\(['"]sfc:(.+?)['"]\)[;\n$]/gmi, (_, declares, src) => {
      deps.push([declares.trim(), src]);
      return '';
    });

  const scripts = lines.split('\n').reduce((lines, current) => {
    const last = lines[lines.length - 1];
    const isCurrentEmpty = !current.trim();
    if (!last && isCurrentEmpty) {
      return lines;
    }

    if (!last) {
      lines.push(current);
      return lines;
    }

    const isLastEmpty = !last.trim();
    if (isLastEmpty && isCurrentEmpty) {
      return lines;
    }

    lines.push(current);
    return lines;
  }, [])
    .join('\n');

  const tokens = tokenize(scripts);

  const vars = {};
  const createReactive = code => code
    .replace(/let\s+([{[])([\w\W]+)([}\]])\s+=([\w\W]+?);$/, (_, $1, names, $2, value) => {
      const vars = names.split(',');
      const variables = vars.map((declareStr) => {
        const [name, defaultValue] = declareStr.split('=').map(item => item.trim());
        vars[name] = 1;
        if (isUndefined(defaultValue)) {
          return name;
        }
        const exp = defaultValue[0] === '{' ? `(${defaultValue})` : defaultValue;
        return `${name} = _sfc.reactive(() => ${exp}, true)`;
      });

      const varValue = value.trim();
      const varExp = varValue[0] === '{' ? `(${varValue})` : varValue;

      const out = `let ${$1}${variables.join(',')}${$2} = _sfc.reactive(() => ${varExp}, true);`;
      return out;
    })
    .replace(/let\s+(\w+)\s*=\s*([\w\W]+?)\s*;$/, (_, name, value) => {
      const varName = name.trim();
      vars[varName] = 1;
      const varValue = value.trim();
      const varExp = varValue[0] === '{' ? `(${varValue})` : varValue;
      const out = `let ${varName} = _sfc.reactive(() => ${varExp}, true);`;
      return out;
    })
    .replace(/var\s+(\w+)\s*=\s*([\w\W]+?)\s*;$/, (_, name, value) => {
      const varName = name.trim();
      vars[varName] = 1;
      const varValue = value.trim();
      const varExp = varValue[0] === '{' ? `(${varValue})` : varValue;
      return `var ${varName} = _sfc.reactive(() => ${varExp});`;
    });
  const createUpdate = code => code.replace(/(.*?)=([\w\W]+?);$/, (_, name, value) => {
    const varName = name.trim();
    const varValue = value.trim();
    return `${varName} = _sfc.update(${varName}, ${varName} => ${varValue});`;
  });

  // 匹配对应的token
  // next为一个函数，参数为一个函数，执行该参数函数相当于执行下一个索引的token的match
  const find = (index, determine, ignore, next) => {
    let curr = index;
    let nextToken = tokens[curr]?.trim();

    while (
      (typeof ignore === 'function' && ignore(nextToken))
      || (Array.isArray(ignore) && ignore.includes(nextToken))
      || (typeof ignore === 'string' && ignore === nextToken)
    ) {
      curr += 1;
      nextToken = tokens[curr]?.trim();
      if (curr >= tokens.length) {
        nextToken = '';
        break;
      }
    }

    if (
      (typeof determine === 'function' && determine(nextToken))
      || (Array.isArray(determine) && determine.includes(nextToken))
      || (typeof determine === 'string' && determine === nextToken)
    ) {
      if (next) {
        const nextMatch = (determine, ignore, next) => match(curr + 1, determine, ignore, next);
        const res = next(nextMatch);
        if (res) {
          return curr;
        }
      } else {
        return curr;
      }
    }

    return -1;
  };
  const match = (...args) => find(...args) > -1;

  const walkWrap = (initNext, create, initCode, initIndex) => {
    const localScope = [];
    let i = initIndex;
    let code = initCode;

    const token = tokens[i];
    const len = tokens.length;
    const start = ['(', '[', '{'];
    const end = [')', ']', '}'];
    let part = token;

    i += 1;
    let next = tokens[i];
    next = initNext ? initNext(next) : next;
    part += next;

    while (1) {
      if (i >= len) {
        code += create(part);
        break;
      }

      // 结束标记
      if (!localScope.length && next === ';') {
        code += create(part);
        break;
      }

      if (start.includes(next)) {
        localScope.push(next);
      } else if (end.includes(next)) {
        const index = end.indexOf(next);
        const latest = localScope[localScope.length - 1];

        if (latest !== start[index]) {
          throw new Error(`${start[index]} 尚未关闭 at ${i} ${tokens[i - 1]} ${token} ${tokens[i + 1]}`);
        }

        localScope.pop();
      }

      i += 1;
      next = tokens[i];
      if (vars[next]) {
        part += `_sfc.consume(${next})`;
      }
      else {
        part += next;
      }
    }
    return [code, i];
  };

  let code = '';
  for (let i = 0, len = tokens.length; i < len; i ++) {
    const token = tokens[i];
    // declare
    if (token === 'let' || token === 'var') {
      const [newCode, newIndex] = walkWrap(
        (next) => {
          if (vars[next]) {
            return `_sfc.consume(${next})`;
          }
          return next;
        },
        createReactive,
        code,
        i,
      );

      code = newCode;
      i = newIndex;
    }
    // update
    else if (
      vars[token.trim()] && match(i + 1, '=', '', nextMatch => !nextMatch('='))
    ) {
      const [newCode, newIndex] = walkWrap(
        null,
        createUpdate,
        code,
        i,
      );

      code = newCode;
      i = newIndex;
    }
    // a += 1
    else if (
      vars[token.trim()] && match(i + 1, token => MODIFIERS.includes(token), '')
    ) {
      const varname = token.trim();
      const create = (code) => {
        const exp = code.substr(0, code.length - 1);
        return `${varname} = _sfc.update(${varname}, ${varname} => ${exp});`;
      };

      const [newCode, newIndex] = walkWrap(
        null,
        create,
        code,
        i,
      );

      code = newCode;
      i = newIndex;
    }
    // 一元操作
    // a ++
    else if (
      vars[token.trim()] && match(i + 1, token => OPERATORS.includes(token), '')
    ) {
      i = find(i + 1, token => OPERATORS.includes(token), '');
      const operator = tokens[i];
      const varname = token.trim();

      const exp = `${varname} = _sfc.update(${varname}, ${varname} => (${varname} ${operator},${varname}))`; // 由于直接匹配，不需要在末尾加;
      code += exp;
    }
    // consume
    else if (vars[token] && !match(i - 1, '.')) {
      const next = `_sfc.consume(${token})`;
      code += next;
    }
    // normal
    else {
      code += token;
    }
  }

  return {
    imports,
    deps,
    components: components.reduce((obj, curr) => {
      const [name, src] = curr;
      // eslint-disable-next-line no-param-reassign
      obj[name] = src;
      return obj;
    }, {}),
    vars,
    code,
  };
}

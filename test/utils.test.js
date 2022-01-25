import { resolveUrl } from '../src/utils.js';

describe('utils', () => {
  test('resolveUrl', () => {
    expect(resolveUrl('/apps', './app1.htm')).toBe('/apps/app1.htm');

    expect(() => resolveUrl()).toThrowError();

    expect(resolveUrl('/app', 'https://a.com/1.htm')).toBe('https://a.com/1.htm');

    expect(() => resolveUrl('./app', './a')).toThrowError();

    expect(resolveUrl('/apps/', './app1.htm')).toBe('/apps/app1.htm');

    expect(resolveUrl('/app', '/a')).toBe('/a');

    expect(resolveUrl('/app', '?a=1')).toBe('/app?a=1');

    expect(resolveUrl('/app/1', '../2')).toBe('/app/2');
  });
});

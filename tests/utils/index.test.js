import { hashCode, validateUrl, shortCode, positiveInteger } from '../../api/utils/index.js';

it('reproduces the old collision without using hash identity for creation', () => {
  expect(hashCode('https://example.com/782')).toBe(9376);
  expect(hashCode('https://example.com/1000')).toBe(9376);
  expect(hashCode('')).toBe(0);
});
it.each(['https://example.com', 'http://example.com/path?key=value#fragment'])('allows HTTP(S) %s', value => {
  expect(validateUrl(value)).toBe('example.com');
});
it.each([undefined, null, {}, [], 123, '', 'invalid', 'javascript:alert(1)', 'file:///tmp/file', 'mailto:mail@example.com',
  'ftp://example.com', 'https://user:password@example.com', 'https://user@example.com', 'https://example.com/a b', 'https://example.com/\n', `https://example.com/${'a'.repeat(2048)}`])('rejects unsafe or ill-typed input %#', value => {
  expect(validateUrl(value)).toBeNull();
});
it('parses safe canonical codes and the issued four-digit legacy format', () => {
  expect(shortCode('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  expect(shortCode('0')).toBe(0);
  expect(shortCode('0042')).toBe(42);
  expect(shortCode('0000')).toBe(0);
  expect(() => shortCode(123)).toThrow('Invalid short code');
  expect(positiveInteger(undefined, 30, 100)).toBe(30);
  expect(positiveInteger('100', 30, 100)).toBe(100);
  expect(() => positiveInteger(10, 30, 100)).toThrow('Invalid pagination');
});

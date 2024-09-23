import { hashCode, validateUrl } from '../../api/utils/index.js';

describe('Utils', () => {
  describe('hashCode', () => {
    it('should return a hash code for a given string', () => {
      const url = 'https://www.example.com';
      const hash = hashCode(url);
      expect(typeof hash).toBe('number');
    });

    it('should return 0 for an empty string', () => {
      const hash = hashCode('');
      expect(hash).toBe(0);
    });

    it('should always return the same hash code for a given string', () => {
      const url = 'https://www.example.com';
      const hash1 = hashCode(url);
      const hash2 = hashCode(url);
      expect(hash1).toBe(hash2);
    });
  });

  describe('validateUrl', () => {
    it('should validate a correct URL', () => {
      const url = 'https://www.example.com';
      expect(validateUrl(url)).toBe('www.example.com');
    });

    it('should throw an error for an incorrect URL', () => {
      const url = 'not a url';
      expect(validateUrl(url)).toBe(null);
    });

    it('should throw an error for an empty URL', () => {
      const url = '';
      expect(validateUrl(url)).toBe(null);
    });

    it('should throw an error for a null URL', () => {
      const url = null;
      expect(validateUrl(url)).toBe(null);
    });
  });
});
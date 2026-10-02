import UrlModel from '../../api/models/UrlModel.js';

it('strips unknown fields through the actual Mongoose schema', async () => {
  const record = new UrlModel({ original_url: 'https://example.com', short_url: 9376, unknown: 'discard' });
  await expect(record.validate()).resolves.toBeUndefined();
  expect(record.toObject()).not.toHaveProperty('unknown');
  expect(record.creation_date).toBeInstanceOf(Date);
});
it('rejects invalid persisted input independently of controllers', async () => {
  await expect(new UrlModel({ original_url: 'file:///tmp', short_url: 1.5 }).validate()).rejects.toThrow();
});
it('declares uniqueness without implicitly creating indexes', () => {
  expect(UrlModel.schema.options.autoIndex).toBe(false);
  expect(UrlModel.schema.options.autoCreate).toBe(false);
  expect(UrlModel.schema.options.bufferCommands).toBe(false);
  expect(UrlModel.schema.indexes().filter(([, options]) => options.unique)).toHaveLength(2);
});

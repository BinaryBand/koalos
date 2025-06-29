import 'dotenv/config';

import path from 'path';
import fs from 'fs';

function getCache<T>(filename: string, directory: string): T | -1 | undefined {
  const filepath: string = path.join(directory, filename + '.json');

  if (fs.existsSync(filepath)) {
    const cachedData: string = fs.readFileSync(filepath, 'utf-8');
    const { data, expirationDate } = JSON.parse(cachedData);

    if (expirationDate && new Date(expirationDate) < new Date()) {
      fs.unlinkSync(filepath);
      return undefined;
    }

    return (data as T) ?? -1;
  }

  return undefined;
}

function setCache<T>(filename: string, data: T, expirationDate: Date, directory: string): T {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const filepath: string = path.join(directory, filename + '.json');
  const cacheEntry = { data, expirationDate };
  fs.writeFileSync(filepath, JSON.stringify(cacheEntry, undefined, 2));
  return data;
}

export async function fetchAndCache<T>(
  key: string,
  callback: () => Promise<T | undefined>,
  directory: string,
  expiry: Date = new Date(Infinity)
): Promise<T | undefined> {
  const cachedData: T | -1 | undefined = getCache(key, directory);
  if (cachedData !== undefined) {
    return cachedData !== -1 ? Promise.resolve(cachedData) : undefined;
  }

  const res: T | undefined = await callback();
  return setCache(key, res, expiry, directory);
}

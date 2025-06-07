import 'dotenv/config';

import { blake2b } from '@noble/hashes/blake2';

console.log('Environment Variables:');
console.log('-----------------------');
console.log(`NODE_ENV: ${process.env['SUPER_SECRETIVE_SECRET']}`);

const hash: string = Buffer.from(blake2b('Hello, World!', { dkLen: 32 })).toString('hex');

console.log('Hash:', hash);

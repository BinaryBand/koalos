import 'module-alias/register';
import 'dotenv/config';

import { BigMapAbstraction } from '@taquito/taquito';
import { TokenSchema } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';
import { assert } from '@/tools/misc';

export function recurseSchema(schema: TokenSchema): Michelson {
  switch (schema.__michelsonType) {
    case 'address':
    case 'bool':
    case 'bytes':
    case 'int':
    case 'nat':
    case 'string':
    case 'unit':
      return schema.__michelsonType;
    case 'pair':
      const pair: Record<string, Michelson> = {};
      for (const [key, val] of Object.entries(schema.schema)) {
        pair[key] = recurseSchema(val);
      }
      return pair;
    case 'option':
      return new Optional(recurseSchema(schema.schema));
    case 'map':
      return new MichelsonMap(schema.schema.key.__michelsonType, recurseSchema(schema.schema.value));
    case 'big_map':
      return new BigMap(schema.schema.key.__michelsonType, recurseSchema(schema.schema.value));
    case 'list':
      return new List(recurseSchema(schema.schema));
    case 'lambda':
      return new Lambda(recurseSchema(schema.schema.parameters), recurseSchema(schema.schema.returns));
    case 'operation':
      return new Complex('operation');
    default:
      throw new Error(`Unsupported schema type: ${schema.__michelsonType}`);
  }
}

export function populateValues(schema: Michelson, storage: StorageType): PopulatedValue {
  if (typeof storage === 'string' || typeof storage === 'number' || typeof storage === 'boolean') {
    assert(typeof schema === 'string', `Expected ${schema} but got ${typeof storage}`);
    return storage;
  } else if (storage instanceof BigNumber) {
    assert(schema === 'nat' || schema === 'int', `Expected ${schema} but got BigNumber`);
    return storage;
  } else if (schema instanceof MichelsonMap) {
    return {};
  } else if (schema instanceof BigMap || storage instanceof BigMapAbstraction) {
    assert(schema instanceof BigMap, `Expected BigMap but got ${typeof schema}`);
    assert(storage instanceof BigMapAbstraction, `Expected BigMapAbstraction but got ${typeof storage}`);
    return storage;
  } else if (Array.isArray(storage)) {
    assert(schema instanceof List, `Expected ${schema} but got List`);
    return storage.map(item => populateValues(schema.valueType, item));
  } else if (schema instanceof Optional) {
    return storage ? populateValues(schema.argumentType, storage) : null;
  } else if (schema instanceof Complex) {
    throw new Error(`Unsupported complex type: ${schema.type}`);
  } else if (typeof schema === 'object') {
    const populated: Record<string, PopulatedValue> = {};
    for (const key in schema) {
      if (schema.hasOwnProperty(key) && storage?.hasOwnProperty(key)) {
        populated[key] = populateValues((schema as MichelsonRecord)[key], storage[key]);
      }
    }
    return populated;
  }

  return {};
}

export function isStorageType(value: StorageType): value is StorageType {
  if (
    !value ||
    ['string', 'number', 'boolean'].includes(typeof value) ||
    value instanceof BigNumber ||
    value instanceof BigMapAbstraction
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(item => isStorageType(item));
  }

  if (typeof value === 'object' && value !== null) {
    for (const key in value) {
      if (!isStorageType(value[key])) return false;
    }

    return true;
  }

  return false;
}

// async function main(): Promise<void> {
//   // User wallet address
//   const address: string = await tezos.signer.publicKeyHash();
//   console.log('User address:', address);

//   // Contract address
//   const contractAddress: string = FA12_TOKENS.swc;
//   const contract12 = await tezos.contract.at(contractAddress);

//   const storageSchema: TokenSchema = contract12.schema.generateSchema();
//   const recursedSchema: Michelson = recurseSchema(storageSchema);
//   console.log('Schema', recursedSchema);

//   const storage12: StorageType = await contract12.storage<StorageType>();
//   assert(isStorageType(storage12), 'Runtime type assertion failed: Storage does not match StorageType.');

//   const populatedValuesMap: PopulatedValue = populateValues(recursedSchema, storage12);
//   console.log('Storage:', populatedValuesMap);
// }

// main()
//   .then(() => {
//     console.log('Done');
//     process.exit(0);
//   })
//   .catch(error => {
//     console.error('Error:', error);
//     console.log('RPC URL:', RPC);
//     process.exit(1);
//   });

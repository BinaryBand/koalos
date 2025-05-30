import 'module-alias/register';
import 'dotenv/config';

import { BigMapAbstraction } from '@taquito/taquito';
import { TokenSchema } from '@taquito/michelson-encoder';
import BigNumber from 'bignumber.js';
import { assert } from '../misc.js';

export class Complex implements IComplex {
  constructor(public type: 'map' | 'big_map' | 'list' | 'option' | 'lambda' | 'operation') {}
}

export class MichelsonMap extends Complex {
  constructor(public key: string, public valueType: MichelsonSchema) {
    super('map');
  }
}

export class BigMap extends Complex {
  constructor(public key: string, public valueType: MichelsonSchema) {
    super('big_map');
  }
}

export class List extends Complex {
  constructor(public valueType: MichelsonSchema) {
    super('list');
  }
}

export class Optional extends Complex {
  constructor(public argumentType: MichelsonSchema) {
    super('option');
  }
}

export class Lambda extends Complex {
  constructor(public parameter: MichelsonSchema, public returnType: MichelsonSchema) {
    super('lambda');
  }
}

export function translateSchema(schema: TokenSchema): MichelsonSchema {
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
      const pair: Record<string, MichelsonSchema> = {};
      for (const [key, val] of Object.entries(schema.schema)) {
        pair[key] = translateSchema(val);
      }
      return pair;
    case 'option':
      return new Optional(translateSchema(schema.schema));
    case 'map':
      return new MichelsonMap(schema.schema.key.__michelsonType, translateSchema(schema.schema.value));
    case 'big_map':
      return new BigMap(schema.schema.key.__michelsonType, translateSchema(schema.schema.value));
    case 'list':
      return new List(translateSchema(schema.schema));
    case 'lambda':
      return new Lambda(translateSchema(schema.schema.parameters), translateSchema(schema.schema.returns));
    case 'operation':
    case 'timestamp':
      return new Complex('operation');
    default:
      throw new Error(`Unsupported schema type: ${schema.__michelsonType}`);
  }
}

export function populateSchema(schema: MichelsonSchema, storage: StorageType): MichelsonStorage {
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
    return storage.map(item => populateSchema(schema.valueType, item));
  } else if (schema instanceof Optional) {
    return storage ? populateSchema(schema.argumentType, storage) : null;
  } else if (schema instanceof Complex) {
    throw new Error(`Unsupported complex type: ${schema.type}`);
  } else if (typeof schema === 'object') {
    const populated: Record<string, MichelsonStorage> = {};
    for (const key in schema) {
      if (schema.hasOwnProperty(key) && storage?.hasOwnProperty(key)) {
        populated[key] = populateSchema((schema as MichelsonRecord)[key], storage[key]);
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

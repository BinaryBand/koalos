import 'module-alias/register';
import 'dotenv/config';

import {
  BigMapAbstraction,
  ContractAbstraction,
  ContractMethodObject,
  ContractProvider,
  TezosToolkit,
  Wallet,
} from '@taquito/taquito';
import { Tzip12Module, tzip12 } from '@taquito/tzip12';
import { Tzip16Module, tzip16 } from '@taquito/tzip16';
import { InMemorySigner } from '@taquito/signer';
import { MichelsonMap, TokenSchema } from '@taquito/michelson-encoder';

const RPC_URLS: string[] = [
  'https://mainnet.tezos.ecadinfra.com/',
  'https://rpc.tzbeta.net/',
  'https://mainnet.smartpy.io/',
  'https://rpc.tzkt.io/',
];

const RPC: string = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
const tezos: TezosToolkit = new TezosToolkit(RPC);
tezos.addExtension(new Tzip12Module());
tezos.addExtension(new Tzip16Module());

const FA12_TOKENS = {
  kusd: 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV',
  kdao: 'KT1WZ1HJyx5wPt96ZTjtWPotoPUk7pXNPfT2',
  swc: 'KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g',
};

tezos.setProvider({
  signer: new InMemorySigner(process.env['SECRET_KEY']!),
});

interface ISwdMethods<
  T extends ContractProvider | Wallet = ContractProvider,
  M extends ContractMethodObject<T> = ContractMethodObject<T>
> extends Record<string, (args?: any) => M> {
  getBalance: ([address, tokenId]: [string, number]) => M;
}

interface ISwdLedgerEntry {
  approvals: MichelsonMap<string, number>;
  balance: BigNumber;
}

interface ISwdMetadata {
  name: string;
  version: string;
  description: string;
}

interface ISwdTokenMetadata {
  token_id: number;
  decimals: number;
  name?: string;
  symbol?: string;
}

interface ISwdStorage {
  administrator: BigNumber;
  ledger: BigMapAbstraction;
  metadata: BigMapAbstraction;
  paused: boolean;
  token_metadata: BigMapAbstraction;
  total_supply: BigNumber;
}

type Primitive = 'address' | 'bool' | 'bytes' | 'int' | 'nat' | 'string' | 'unit';

interface IVal {}

class Map implements IVal {
  constructor(public key: string, public valueType: Michelson) {}
}

class List implements IVal {
  constructor(public valueType: Michelson) {}
}

class Option implements IVal {
  constructor(public argumentType: Michelson) {}
}

class Lambda implements IVal {
  constructor(public parameter: Michelson, public returnType: Michelson) {}
}

class Operation implements IVal {
  public readonly type = 'operation';
}

type Michelson = Primitive | IVal | Record<string, Primitive | IVal>;

function recurseSchema(schema: TokenSchema): Michelson {
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
      return new Option(recurseSchema(schema.schema));
    case 'map':
    case 'big_map':
      return new Map(schema.schema.key.__michelsonType, recurseSchema(schema.schema.value));
    case 'list':
      return new List(recurseSchema(schema.schema));
    case 'lambda':
      return new Lambda(recurseSchema(schema.schema.parameters), recurseSchema(schema.schema.returns));
    case 'operation':
      return new Operation();
    default:
      throw new Error(`Unsupported schema type: ${schema.__michelsonType}`);
  }
}

async function main(): Promise<void> {
  // User wallet address
  const address: string = await tezos.signer.publicKeyHash();
  console.log('User address:', address);

  const contractAddress: string = FA12_TOKENS.swc;

  // Contract address
  const contract12 = await tezos.contract.at(contractAddress);
  // const storage12 = await contract12.storage();

  // console.log(storage12);

  const storageSchema: TokenSchema = contract12.schema.generateSchema();
  const recursedSchema: Michelson = recurseSchema(storageSchema);
  console.log(recursedSchema);

  // Contract address
  const contract20: ContractAbstraction<ContractProvider, {}, ISwdMethods, {}, {}, ISwdStorage> =
    await tezos.contract.at(contractAddress);
  console.log('Contract address:', contract20.address);

  const storageKeys = Object.entries(storageSchema.schema);
  console.log('Storage keys:', storageKeys);

  console.log('Schema:', contract20.schema.generateSchema());
  console.log('Schema value:', contract20.schema.val);

  const storage: ISwdStorage = await contract20.storage();
  console.log('Administrator:', storage['administrator']);
  console.log('Paused:', storage['paused']);
  console.log('Total supply:', storage['total_supply'].toString());

  const metadataMap: BigMapAbstraction = storage['metadata'];
  const metadataMichelson = await metadataMap.getMultipleValues<string>(['name', 'version', 'description']);
  const metadata: ISwdMetadata = {
    name: Buffer.from(metadataMichelson.get('name') as string, 'hex').toString('utf-8'),
    version: Buffer.from(metadataMichelson.get('version') as string, 'hex').toString('utf-8'),
    description: Buffer.from(metadataMichelson.get('description') as string, 'hex').toString('utf-8'),
  };
  console.log('Metadata:', JSON.stringify(metadata, null, 2));

  const tokenMetadataMap: BigMapAbstraction = storage['token_metadata'];
  console.log(await tokenMetadataMap.get('0'));

  return;

  // const balanceParams = [address, contract12.contractViews];

  // const operation: ContractMethodObject<ContractProvider> = contract12.methodsObject['getBalance'](balanceParams);

  // const entrypoints: EntrypointsResponse = contract12.entrypoints;
  // const getBalanceSchema: Schema = new Schema(entrypoints.entrypoints['getBalance']);

  // try {
  //   getBalanceSchema.Typecheck(balanceParams);

  //   console.log('Signature:', await operation.getSignature());
  //   console.log('Transfer params:', operation.toTransferParams());
  //   console.log('Function params:', JSON.stringify(operation.toTransferParams().parameter));

  //   const res = await operation.send();
  //   console.log('Operation:', res);
  // } catch (e) {
  //   console.warn(`Storage is not valid: ${e}`);
  // }

  // console.log('Operation:', res);

  // const entrypoints: EntrypointsResponse = await tezos.rpc.getEntrypoints(FA12_TokenContracts.kusd);
  // const storageSchema: Schema = new Schema(entrypoints.entrypoints['getBalance']);

  // const balanceParams = ['tz1PNsHbJRejCnnYzbsQ1CR8wUdEQqVjWen1', FA12_TokenContracts.kusd];

  // console.log(JSON.stringify(storageSchema.val));

  // try {
  //   storageSchema.Typecheck(balanceParams);

  //   const op = await contract12.methodsObject['getBalance'](balanceParams).send();
  //   console.log('Operation:', op);
  // } catch (e) {
  //   console.warn(`Storage is not valid: ${e}`);
  // }
}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    console.log('RPC URL:', RPC);
    process.exit(1);
  });

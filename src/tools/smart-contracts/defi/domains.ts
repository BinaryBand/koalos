import { MichelsonData, MichelsonType, packData } from '@taquito/michel-codec';
import { Schema } from '@taquito/michelson-encoder';
import { BigMapResponse } from '@taquito/rpc';
import { encodeExpr } from '@taquito/utils';
import Tezos from '../../../network/taquito.js';

type DomainResponse = Partial<{
  name: { Some: string };
  owner: string;
}>;

type RecordResponse = Partial<{
  address: string | null;
  owner: string;
}>;

const SchemaType: MichelsonExpression = {
  prim: 'pair',
  args: [
    {
      prim: 'pair',
      args: [
        { prim: 'map', args: [{ prim: 'string' }, { prim: 'bytes' }], annots: ['%internal_data'] },
        { prim: 'option', args: [{ prim: 'bytes' }], annots: ['%name'] },
      ],
    },
    { prim: 'address', annots: ['%owner'] },
  ],
};

type DomainStorage = {
  store: {
    records: BigMapAbstraction;
    reverse_records: BigMapAbstraction;
  };
};

const DOMAIN_CONTRACT = 'KT1GBZmSxmnKJXGMdMLbugPfLyUPmuLSMwKS';

function addressToExpr(address: string): string {
  const data: MichelsonData = { string: address };
  const type: MichelsonType = { prim: 'address' };
  const packedData: string = Buffer.from(packData(data, type)).toString('hex');
  const key: string = encodeExpr(packedData);
  return key;
}

export async function addressToDomainRaw(address: string): Promise<string | undefined> {
  const key: string = addressToExpr(address);
  const rawData: BigMapResponse = await Tezos().rpc.getBigMapExpr('1265', key);
  const domain: DomainResponse = new Schema(SchemaType).Execute(rawData);
  const name: string | undefined = domain.name?.Some;
  return name ? Buffer.from(name, 'hex').toString('utf8') : undefined;
}

export async function addressToDomain(address: string): Promise<string | undefined> {
  const contract: ContractAbstraction = await Tezos().wallet.at(DOMAIN_CONTRACT);
  const storage: DomainStorage = await contract.storage<DomainStorage>();
  const domain: DomainResponse | undefined = await storage.store.reverse_records.get(address);
  const name: string | undefined = domain?.name?.Some;
  return name ? Buffer.from(name, 'hex').toString('utf8') : undefined;
}

export async function domainToAddress(domain: string): Promise<string | undefined> {
  const contract: ContractAbstraction = await Tezos().wallet.at(DOMAIN_CONTRACT);
  const storage: DomainStorage = await contract.storage<DomainStorage>();
  const key: string = Buffer.from(domain, 'utf8').toString('hex');
  const address: RecordResponse | undefined = await storage.store.records.get(key);
  const owner: string | undefined = address?.owner;
  return owner;
}

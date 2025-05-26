type Primitive = 'address' | 'bool' | 'bytes' | 'int' | 'nat' | 'string' | 'unit';

interface MichelsonRecord extends Record<string, Michelson> {}

type Michelson = Primitive | Complex | MichelsonRecord;

type BigMapAbstraction = import('@taquito/taquito').BigMapAbstraction;

type StorageType =
  | string
  | number
  | boolean
  | BigNumber
  | StorageType[]
  | { [key: string]: StorageType }
  | null
  | undefined;

type PopulatedValue =
  | string
  | number
  | boolean
  | BigNumber
  | BigMapAbstraction
  | PopulatedValue[]
  | { [key: string]: PopulatedValue }
  | null;

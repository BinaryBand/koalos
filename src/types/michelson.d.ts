type Primitive = 'address' | 'bool' | 'bytes' | 'int' | 'nat' | 'string' | 'unit';

interface MichelsonRecord extends Record<string, MichelsonSchema> {}

interface IComplex {}

type MichelsonSchema = Primitive | IComplex | MichelsonRecord;

type StorageType =
  | string
  | number
  | boolean
  | BigNumber
  | StorageType[]
  | { [key: string]: StorageType }
  | null
  | undefined;

type MichelsonStorage =
  | string
  | number
  | boolean
  | BigNumber
  | BigMapAbstraction
  | MichelsonStorage[]
  | { [key: string]: MichelsonStorage }
  | null;

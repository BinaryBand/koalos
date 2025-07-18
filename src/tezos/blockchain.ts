import { Estimate } from '@taquito/taquito';
import { OperationContents } from '@taquito/rpc';

import { Fa12Token, Fa2Token } from '@/tezos/contracts/fa-token';
import { estimateBatch } from '@/tezos/taquito-mirror/estimate';
import { extractAddressFromParams, prepareBatch } from '@/tezos/taquito-mirror/prepare';
import RpcProvider from '@/tezos/provider';
import { TezosContract } from '@/tezos/contracts';
import { assert } from '@/tools/utils';
import { blake2b } from '@noble/hashes/blake2';

import { LocalForger } from '@taquito/local-forging';
const FORGER: LocalForger = new LocalForger();

export class BlockchainInstance {
  constructor(private context: RpcProvider) {}

  public static createInstance(rpcInstance: RpcProvider = new RpcProvider()): BlockchainInstance {
    return new BlockchainInstance(rpcInstance);
  }

  private static isFa12(entrypointsResponse: EntrypointsResponse): boolean {
    return 'getBalance' in entrypointsResponse.entrypoints;
  }

  private static isFa2(entrypointsResponse: EntrypointsResponse): boolean {
    return 'balance_of' in entrypointsResponse.entrypoints;
  }

  public async getContract(address: string): Promise<TezosContract | undefined> {
    const [contractResponse, entrypointsResponse] = await Promise.all([
      this.context.getContractResponse(address),
      this.context.getEntrypointsResponse(address),
    ]);

    if (contractResponse !== undefined && entrypointsResponse !== undefined) {
      return new TezosContract(address, contractResponse, entrypointsResponse, this.context);
    }

    return undefined;
  }

  public async getFaToken(address: string, standard: 'fa1.2'): Promise<Fa12Token>;
  public async getFaToken(address: string, standard: 'fa2'): Promise<Fa2Token>;
  public async getFaToken(address: string, standard: 'fa1.2' | 'fa2'): Promise<Fa12Token | Fa2Token> {
    const [contractResponse, entrypointsResponse] = await Promise.all([
      this.context.getContractResponse(address),
      this.context.getEntrypointsResponse(address),
    ]);

    if (contractResponse !== undefined && entrypointsResponse !== undefined) {
      switch (standard) {
        case 'fa1.2':
          assert(BlockchainInstance.isFa12(entrypointsResponse), `Contract ${address} is not a FA1.2 token`);
          return new Fa12Token(address, contractResponse, entrypointsResponse, this.context);
        case 'fa2':
          assert(BlockchainInstance.isFa2(entrypointsResponse), `Contract ${address} is not a FA2 token`);
          return new Fa2Token(address, contractResponse, entrypointsResponse, this.context);
      }
    }

    throw new Error(`Failed to get FA token for address ${address}`);
  }

  public async prepare(batchParams: Operation[], address?: string): Promise<PreparedOperation> {
    address ??= extractAddressFromParams(batchParams);
    assert(address, 'No address provided or found in batch parameters');

    const [constants, branch, protocol, counter, chainId] = await Promise.all([
      this.context.getConstants(),
      this.context.getBlockHash({ block: 'head~2' }),
      this.context.getProtocols().then(({ protocol }) => protocol),
      this.context.getContractResponse(address).then((c) => parseInt(c?.counter ?? '0', 10)),
      this.context.getChainId(),
    ]);

    const preparedOperation: PreparedOperation = await prepareBatch(address, batchParams, {
      constants,
      branch,
      protocol,
      counter,
    });
    const estimates: Estimate[] = await estimateBatch(preparedOperation, { constants, chainId });

    // Apply estimates to each operation content
    for (let i: number = 0; i < preparedOperation.opOb.contents.length; i++) {
      const content: OperationContents = preparedOperation.opOb.contents[i]!;
      const estimate: Estimate = estimates[i]!;

      if ('fee' in content) content.fee = `${estimate?.suggestedFeeMutez ?? content.fee}`;
      if ('gas_limit' in content) content.gas_limit = `${estimate?.gasLimit ?? content.gas_limit}`;
      if ('storage_limit' in content) content.storage_limit = `${estimate?.storageLimit ?? content.storage_limit}`;
    }

    return preparedOperation;
  }

  public static async forgeOperation({ opOb }: PreparedOperation): Promise<[string, string]> {
    const opBytes: string = await FORGER.forge(opOb);

    // Ask the sender to sign this hash
    const payload: Uint8Array = Buffer.from('03' + opBytes, 'hex');
    const bytesHash: Uint8Array = blake2b(payload, { dkLen: 32 });
    const hexHash: string = Buffer.from(bytesHash).toString('hex');

    return [opBytes, hexHash];
  }
}

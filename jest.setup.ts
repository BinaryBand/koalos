import {
  ContractResponse,
  ScriptResponse,
  BigMapResponse,
  RpcClient,
  RPCOptions,
  RPCSimulateOperationParam,
  OperationContents,
  RPCRunViewParam,
} from '@taquito/rpc';
import { HttpBackend } from '@taquito/http-utils';
import { Schema } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';
import path from 'path';
import qs from 'qs';

import CONSTANTS from '@public/chain/constants.json';
import CONST_META from '@public/chain/constants.meta.json';
import PROTOCOLS from '@public/chain/protocols.json';
import RPC_URLS from '@public/constants/rpc-providers.json';

import { fetchAndCache } from '@/tools/cache';
import { assert } from '@/tools/utils';

const BLOCK_DELAY: number = BigNumber(CONSTANTS.minimal_block_delay).toNumber() * 1000; // In seconds
const BLOCKS_PER_CYCLE: number = BigNumber(CONSTANTS.blocks_per_cycle).toNumber();
const CACHE_DIRECTORY: string = path.join(__dirname, 'tests', 'cache');

const FA2_BALANCE_RESPONSE_SCHEMA: MichelsonExpression = {
  prim: 'pair',
  args: [
    {
      prim: 'pair',
      args: [
        { prim: 'address', annots: ['%owner'] },
        { prim: 'nat', annots: ['%token_id'] },
      ],
      annots: ['%request'],
    },
    { prim: 'nat', annots: ['%balance'] },
  ],
};

jest.mock('@/network/ipfs', () => ({
  ...jest.requireActual('@/network/ipfs'),

  getFromIpfs: jest.fn().mockImplementation(async (uri: string) => {
    const ipfsHash: string = uri.replace('ipfs://', '');
    const key: string = `ipfs_${ipfsHash.slice(-5)}`;

    const callback = () => {
      const url: string = `http://127.0.0.1:8081/ipfs/${ipfsHash}`;
      return new HttpBackend().createRequest({ url, json: true });
    };

    return fetchAndCache(key, callback, CACHE_DIRECTORY);
  }),
}));

jest.mock('@taquito/rpc', () => {
  const { castToBigNumber, ...actualRpc } = jest.requireActual('@taquito/rpc');

  const mockRpcClient = jest.fn().mockImplementation((url: string, chain?: string, httpBackend?: HttpBackend) => {
    const instance: RpcClient = new actualRpc.RpcClient(url, chain, httpBackend);

    instance.getRpcUrl = jest.fn().mockImplementation(() => RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)]);
    instance.getProtocols = jest.fn().mockReturnValue(PROTOCOLS);
    instance.getChainId = jest.fn().mockReturnValue('NetXdQprcVkpaWU');
    instance.getConstants = jest.fn().mockReturnValue({ ...CONSTANTS, ...castToBigNumber(CONSTANTS, CONST_META) });

    instance.getBlockHeader = jest.fn().mockImplementation(async (options?: RPCOptions) => {
      const key: string = `block_${options?.block ?? 'head'}`;
      const callback = actualRpc.RpcClient.prototype.getBlockHeader.bind(instance, options);
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY);
      return fetchAndCache(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getBlockHash = jest.fn().mockImplementation(async (options?: RPCOptions) => {
      return (await instance.getBlockHeader(options)).hash;
    });

    instance.getManagerKey = jest.fn().mockImplementation(async (address: string, options?: RPCOptions) => {
      const key: string = `manager_key_${address.slice(-5)}`;
      const callback = actualRpc.RpcClient.prototype.getManagerKey.bind(instance, address, options);
      return fetchAndCache(key, callback, CACHE_DIRECTORY);
    });

    instance.getContract = jest.fn().mockImplementation(async (address: string, options?: RPCOptions) => {
      const key: string = `contract_${address.slice(-5)}`;
      const callback = actualRpc.RpcClient.prototype.getContract.bind(instance, address, options);
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY);
      return fetchAndCache<ContractResponse>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getScript = jest.fn().mockImplementation(async (address: string, options?: RPCOptions) => {
      const key: string = `script_${address.slice(-5)}`;
      const callback = actualRpc.RpcClient.prototype.getScript.bind(instance, address, options);
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY * BLOCKS_PER_CYCLE);
      return fetchAndCache<ScriptResponse>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getEntrypoints = jest.fn().mockImplementation(async (address: string, options?: RPCOptions) => {
      const key: string = `entrypoints_${address.slice(-5)}`;
      const callback = actualRpc.RpcClient.prototype.getEntrypoints.bind(instance, address, options);
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY * BLOCKS_PER_CYCLE);
      return fetchAndCache<Record<string, string>>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getBigMapExpr = jest.fn().mockImplementation(async (id: string, expr: string, options?: RPCOptions) => {
      const key: string = `bigMap_${id}_${expr.slice(-5)}`;
      const callback = actualRpc.RpcClient.prototype.getBigMapExpr.bind(instance, id, expr, options);
      const expiry: Date = new Date(Date.now() + BLOCK_DELAY * BLOCKS_PER_CYCLE);
      return fetchAndCache<BigMapResponse>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.simulateOperation = jest.fn().mockImplementation(async (op: RPCSimulateOperationParam) => ({
      contents: op.operation.contents!.map((content: OperationContents) => ({
        ...content,
        metadata: { operation_result: { consumed_milligas: 128 } },
      })),
    }));

    instance.runView = jest.fn().mockImplementation(async (params: RPCRunViewParam, options?: RPCOptions) => {
      const { contract, entrypoint, input } = params;

      const calculateMockBalance = (seed: BigNumber.Value): BigNumber => {
        return BigNumber(seed).plus(7).pow(contract.charCodeAt(11), 13).multipliedBy(1000);
      };

      if (entrypoint === 'getBalance') {
        assert(typeof input === 'object' && 'string' in input, 'Input must be an object for getBalance view');
        const balance: BigNumber = calculateMockBalance(contract.charCodeAt(5) + input.string.charCodeAt(17));
        return { data: { int: balance.toString() } };
      }

      if (entrypoint === 'balance_of') {
        assert(Array.isArray(input), 'Input must be an array for balance_of view');

        const fa2BalanceSchema: Schema = new Schema(FA2_BALANCE_RESPONSE_SCHEMA);
        const requestSchema: Schema = new Schema({
          prim: 'pair',
          args: [{ prim: 'address' }, { prim: 'nat' }],
        });

        const mockBalance: MichelsonExpression[] = input.map((michelson: MichelsonExpression) => {
          const [owner, tokenId] = Object.values(requestSchema.Execute(michelson)) as [string, string];
          const token_id: [BigNumber] = [BigNumber(tokenId)];
          const balance: BigNumber = calculateMockBalance(token_id[0].plus(owner.charCodeAt(11)));
          return fa2BalanceSchema.Encode({ request: { owner, token_id }, balance });
        });

        return { data: mockBalance };
      }

      return actualRpc.RpcClient.prototype.runView.call(instance, params, options);
    });

    return instance;
  });

  return { ...actualRpc, RpcClient: mockRpcClient };
});

// Log http requests for debugging purposes
jest.mock('@taquito/http-utils', () => ({
  HttpBackend: jest.fn().mockImplementation(() => {
    return {
      createRequest: jest
        .fn()
        .mockImplementation(
          async ({ url, method = 'GET', query, headers, json = true }: HttpRequestOptions, data?: object | string) => {
            console.log('Request:', url);

            const keepalive: boolean = false;
            url += qs.stringify(query);
            headers ??= { ['Content-Type']: 'application/json' };
            const body: string = JSON.stringify(data);
            const res: Response = await fetch(url, { keepalive, method, headers, body });

            if (res.status === 404) {
              return undefined;
            }

            return json ? res.json() : res.text();
          }
        ),
    };
  }),
}));

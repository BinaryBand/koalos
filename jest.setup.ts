import 'dotenv/config';

import {
  Estimate,
  EstimateProperties,
  ParamsWithKind,
  PreparedOperation,
  RevealParams,
  RPCOperation,
  RPCOpWithSource,
  TezosToolkit,
} from '@taquito/taquito';
import { ConstantsResponse, ContractResponse, ScriptResponse, BigMapResponse, RpcClient } from '@taquito/rpc';
import { HttpBackend } from '@taquito/http-utils';
import { BigNumber } from 'bignumber.js';
import path from 'path';
import qs from 'qs';

import { fetchAndCache } from '@/tools/cache';

import CONSTANTS from '@public/chain/constants.json';
import PROTOCOLS from '@public/chain/protocols.json';
import RPC_URLS from '@public/constants/rpc-providers.json';

import { calculateEstimates, estimateBatch } from '@/tezos/taquito-mirror/estimate';
import {
  adjustGasForBatchOperation,
  getRPCOp,
  getOperationLimits,
  getSource,
  mergeLimits,
  prepareBatch,
} from '@/tezos/taquito-mirror/prepare';
import { FakeSigner } from '@/tezos/provider';

const CACHE_DIRECTORY: string = path.join(__dirname, 'tests', 'cache');

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

jest.mock('@taquito/taquito', () => {
  const actualTaquito = jest.requireActual('@taquito/taquito');

  const tezosToolkit = jest.fn().mockImplementation((args) => {
    const instance: TezosToolkit = new actualTaquito.TezosToolkit(args);
    const controlInstance: TezosToolkit = new actualTaquito.TezosToolkit(args);

    (instance.prepare as any).mergeLimits = jest
      .fn()
      .mockImplementation((userDefinedLimit: Limits, defaultLimits: Required<Limits>) => {
        const mergedLimits: Required<Limits> = mergeLimits(userDefinedLimit, defaultLimits);
        const controlMergedLimits = (controlInstance.prepare as any).mergeLimits(userDefinedLimit, defaultLimits);
        expect(mergedLimits).toEqual(controlMergedLimits);
        return mergedLimits;
      });

    (instance.prepare as any).adjustGasForBatchOperation = jest
      .fn()
      .mockImplementation((gasLimitBlock: BigNumber, gaslimitOp: BigNumber, numberOfOps: number) => {
        const adjustedGas: BigNumber = adjustGasForBatchOperation(gasLimitBlock, gaslimitOp, numberOfOps);
        const controlAdjustedGas = (controlInstance.prepare as any).adjustGasForBatchOperation(
          gasLimitBlock,
          gaslimitOp,
          numberOfOps
        );
        expect(adjustedGas).toEqual(controlAdjustedGas);
        return adjustedGas;
      });

    (instance.prepare as any).getOperationLimits = jest
      .fn()
      .mockImplementation(async (constants: ConstantsResponse, numberOfOps?: number) => {
        const limits: RevealParams = await getOperationLimits(constants, numberOfOps);
        const controlLimits = await (controlInstance.prepare as any).getOperationLimits(constants, numberOfOps);
        expect(limits).toEqual(controlLimits);
        return limits;
      });

    (instance.prepare as any).getSource = jest
      .fn()
      .mockImplementation((op: RPCOpWithSource, pkh: string, _source?: string) => {
        const source = getSource(op, pkh, _source);
        const controlSource = (controlInstance.prepare as any).getSource(op, pkh, _source);
        expect(source).toEqual(controlSource);
        return source;
      });

    (instance.prepare as any).getRPCOp = jest.fn().mockImplementation(async (param: ParamsWithKind) => {
      const test: RPCOperation = await getRPCOp(param);
      const control: RPCOperation = await (controlInstance.prepare as any).getRPCOp(param);
      expect(test).toEqual(control);
      return test;
    });

    instance.prepare.batch = jest.fn().mockImplementation(async (batchParams: ParamsWithKind[]) => {
      const fakeSigner: FakeSigner = new FakeSigner(process.env['ADDRESS']!);
      controlInstance.setProvider({ signer: fakeSigner });

      const batch: PreparedOperation = await prepareBatch(batchParams, instance.prepare);
      const controlBatch = await controlInstance.prepare.batch(batchParams);
      expect(batch).toEqual(controlBatch);
      return batch;
    });

    instance.estimate.batch = jest.fn().mockImplementation(async (params: ParamsWithKind[]) => {
      const fakeSigner: FakeSigner = new FakeSigner(process.env['ADDRESS']!);
      controlInstance.setProvider({ signer: fakeSigner });

      const estimates: Estimate[] = await estimateBatch(params);
      const controlEstimates: Estimate[] = await controlInstance.estimate.batch(params);
      expect(estimates).toEqual(controlEstimates);
      return estimates;
    });

    (instance.estimate as any).calculateEstimates = jest
      .fn()
      .mockImplementation(async (op: PreparedOperation, constants: ConstantsResponse) => {
        const estimateProperties: EstimateProperties[] = await calculateEstimates(op, constants);
        const controlProperties = await (controlInstance.estimate as any).calculateEstimates(op, constants);
        expect(estimateProperties).toEqual(controlProperties);
        return estimateProperties;
      });

    return {
      estimate: instance.estimate,
      rpc: instance.rpc,
      prepare: instance.prepare,
      setProvider: instance.setProvider.bind(instance),
    };
  });

  return { ...actualTaquito, TezosToolkit: tezosToolkit };
});

jest.mock('@taquito/rpc', () => {
  const actualRpc = jest.requireActual('@taquito/rpc');

  const mockRpcClient = jest.fn().mockImplementation((url: string, chain?: string, httpBackend?: HttpBackend) => {
    const instance: RpcClient = new actualRpc.RpcClient(url, chain, httpBackend);

    instance.getRpcUrl = jest.fn().mockImplementation(() => RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)]);
    instance.getProtocols = jest.fn().mockImplementation(() => PROTOCOLS);
    instance.getChainId = jest.fn().mockReturnValue('NetXdQprcVkpaWU');
    instance.getManagerKey = jest.fn().mockReturnValue(process.env['PUBLIC_KEY']);

    instance.getConstants = jest.fn().mockImplementation(() => {
      const numberKeys: string[] = ['cost_per_byte', 'hard_gas_limit_per_block', 'hard_storage_limit_per_operation'];
      const castedResponse: ConstantsResponse = actualRpc.castToBigNumber(CONSTANTS, numberKeys);
      return { ...CONSTANTS, ...castedResponse };
    });

    instance.getContract = jest.fn().mockImplementation(async (address: string) => {
      const constants: ConstantsResponse = await instance.getConstants();
      const blockDelay: number = new BigNumber(constants.minimal_block_delay ?? 8).toNumber(); // In seconds

      const key: string = `contract_${address.slice(-5)}`;
      const callback = actualRpc.RpcClient.prototype.getContract.bind(instance, address);
      const expiry: Date = new Date(Date.now() + 1000 * blockDelay); // Cache for one block delay
      return fetchAndCache<ContractResponse>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getScript = jest.fn().mockImplementation(async (address: string) => {
      const constants: ConstantsResponse = await instance.getConstants();
      const blockDelay: number = new BigNumber(constants.minimal_block_delay ?? 8).toNumber();
      const blockPerCycle: number = new BigNumber(constants.blocks_per_cycle ?? 10800).toNumber();

      const key: string = `script_${address.slice(-5)}`;
      const callback = actualRpc.RpcClient.prototype.getScript.bind(instance, address);
      const expiry: Date = new Date(Date.now() + 1000 * blockDelay * blockPerCycle); // Cache for one cycle
      return fetchAndCache<ScriptResponse>(key, callback, CACHE_DIRECTORY, expiry);
    });

    instance.getBigMapExpr = jest.fn().mockImplementation(async (id: string, expr: string) => {
      const constants: ConstantsResponse = await instance.getConstants();
      const blockDelay: number = new BigNumber(constants.minimal_block_delay ?? 8).toNumber();
      const blockPerCycle: number = new BigNumber(constants.blocks_per_cycle ?? 10800).toNumber();

      const key: string = `bigMap_${id}_${expr.slice(-5)}`;
      const callback = actualRpc.RpcClient.prototype.getBigMapExpr.bind(instance, id, expr);
      const expiry: Date = new Date(Date.now() + 1000 * blockDelay * blockPerCycle);
      return fetchAndCache<BigMapResponse>(key, callback, CACHE_DIRECTORY, expiry);
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
            const response: Response = await fetch(url + qs.stringify(query), {
              keepalive: false,
              method,
              headers: headers ?? { ['Content-Type']: 'application/json' },
              body: JSON.stringify(data),
            });

            if (response.status === 404) {
              return undefined;
            }

            return json ? response.json() : response.text();
          }
        ),
    };
  }),
}));

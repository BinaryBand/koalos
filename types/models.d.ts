declare interface IRpcInstance {
  getChainId(): Promise<string>;
  getConstants(opts?: RPCOptions): Promise<ConstantsResponse>;
  getBlockHash(opts?: RPCOptions): Promise<string>;
  getProtocols(opts?: RPCOptions): Promise<ProtocolsResponse>;
  getManagerKey(address: string, opts?: RPCOptions): Promise<ManagerKeyResponse | undefined>;
  getContractResponse(address: string, opts?: RPCOptions): Promise<ContractResponse | undefined>;
  getScriptResponse(address: string, opts?: RPCOptions): Promise<ScriptResponse | undefined>;
  getStorageResponse(address: string, opts?: RPCOptions): Promise<StorageResponse | undefined>;
  getEntrypointsResponse(address: string, opts?: RPCOptions): Promise<EntrypointsResponse | undefined>;
  getBigMapValue(id: string, key: Primitive, opts?: RPCOptions): Promise<BigMapResponse | undefined>;
  runView(address: string, entrypoint: string, input: MichelsonV1Expression, opts?: RPCOptions): Promise<RunViewResult>;
  simulateOperation(operation: RPCSimulateOperationParam, opts?: RPCOptions): Promise<PreapplyResponse>;
  injectOperation(signedOperation: string): Promise<string>;
}

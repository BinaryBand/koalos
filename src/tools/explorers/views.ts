import { MichelsonMap, RpcReadAdapter } from '@taquito/taquito';
import { MichelsonStorageView } from '@taquito/tzip16';
import { unwrapMichelsonMap } from '../michelson/michelson-map.js';
import Tezos from 'src/network/taquito.js';

export async function getTokenMetadataFromView(contract: FA, metadata: TZip17Metadata, tokenId = 0) {
  const metadataImplementations: OffChainStorageView[] =
    metadata.views?.find(view => view.name === 'token_metadata')?.implementations ?? [];

  const compiledStorageViews = metadataImplementations
    .filter((impl: OffChainStorageView): impl is OffChainMichelsonStorageView => 'michelsonStorageView' in impl)
    .map(({ michelsonStorageView }: OffChainMichelsonStorageView): MichelsonStorageView => {
      return new MichelsonStorageView(
        'token_metadata',
        contract,
        Tezos().rpc,
        new RpcReadAdapter(Tezos().rpc),
        michelsonStorageView.returnType,
        michelsonStorageView.code,
        michelsonStorageView.parameter
      );
    });

  const promises = compiledStorageViews.map(async (view: MichelsonStorageView) => {
    const res: unknown = await view.executeView(tokenId);
    if (typeof res === 'object' && res !== null) {
      const resultObj = res as { [key: string]: unknown };
      const tokenInfo: unknown = resultObj['token_info'] ?? resultObj['1'];
      if (MichelsonMap.isMichelsonMap(tokenInfo)) {
        return await unwrapMichelsonMap<TZip21TokenMetadata>(tokenInfo);
      }
    }
    return undefined;
  });

  return (await Promise.all(promises)).filter((result: TZip21TokenMetadata | undefined) => result !== undefined);
}

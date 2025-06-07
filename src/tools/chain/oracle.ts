import { getTezosToUsdt } from '../smart-contracts/defi/quipuswap.js';

// Metadata on Tezos as a whole
export async function getTezosData(): Promise<OracleData> {
  const tezosPrice: number = await getTezosToUsdt();
  return { tezosPrice };
}

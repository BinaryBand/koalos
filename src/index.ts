import 'dotenv/config';

import { TezosToolkit } from '@taquito/taquito';
import Tezos from '@/tezos/provider';
import { getMetadata } from './tezos/metadata';

async function main() {
  const tezos: TezosToolkit = Tezos();

  // const address: string = 'tz1TEGKFN9pUpLPvLZXgGjuVoWaebfJS9tuh';
  // console.log(`Tezos address: ${address}`);
  // console.log('Balance:', await tezos.rpc.getBalance(address));
  // console.log('Delegate:', await tezos.rpc.getDelegate(address));

  const kusd: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV';
  const kusdContract = await tezos.contract.at(kusd);
  const kusdMetadata = await getMetadata(kusdContract);
  console.log(kusdMetadata);

  // const swc: string = 'KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g';
  // const swcContract = await tezos.contract.at(swc);
  // const swcTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(swcContract);
  // console.log(swcTokenMetadata);

  // const hdao: string = 'KT193D4vozYnhGJQVtw7CoxxqphqUEEwK6Vb';
  // const hdaoContract = await tezos.contract.at(hdao);
  // const hdaoTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(hdaoContract);
  // console.log(hdaoTokenMetadata);
}

main()
  .then(async () => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

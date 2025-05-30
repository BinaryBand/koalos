import 'module-alias/register';
import 'dotenv/config';

import { TezosToolkit } from '@taquito/taquito';
import { BlockResponse, OperationContents, OperationContentsAndResult, OperationEntry, OpKind } from '@taquito/rpc';
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from '@taquito/michel-codec';
import { Schema } from '@taquito/michelson-encoder';

const RPC_URLS: string[] = [
  'https://mainnet.tezos.ecadinfra.com/',
  'https://rpc.tzbeta.net/',
  'https://mainnet.smartpy.io/',
];

const Tezos1: TezosToolkit = new TezosToolkit(RPC_URLS[0]);
const Tezos2: TezosToolkit = new TezosToolkit(RPC_URLS[1]);
const Tezos3: TezosToolkit = new TezosToolkit(RPC_URLS[2]);

const outputFolder = 'blockchain';

async function saveBlock(block: BlockResponse, filename: string): Promise<void> {
  const filePath = path.join(outputFolder, `${filename}.json`);
  try {
    fs.writeFile(filePath, JSON.stringify(block, null, 2), err => {
      if (err) {
        throw new Error(`Failed to write file: ${err.message}`);
      }
    });
    console.log(`Saved block to ${filePath}`);
  } catch (error: any) {
    console.error(`Error saving block to ${filePath}:`, error);
  }
}

const parser = new Parser();

async function main(): Promise<void> {
  // for (let i = 9027909; i < 9033571; i++) {
  //   const file = fs.readFileSync(
  //     `C:/Users/Shane/OneDrive/Documents/Development/js/smart-contracts/blockchain/block_${i}.json`,
  //     'utf8'
  //   );
  //   const block: BlockResponse = JSON.parse(file);

  //   block.operations.forEach((op: OperationEntry[]) => {
  //     op.forEach((operation: OperationEntry) => {
  //       operation.contents.forEach((content: OperationContents | OperationContentsAndResult) => {
  //         if (content.kind === OpKind.ORIGINATION && 'metadata' in content) {
  //           (content.metadata.operation_result.originated_contracts ?? []).forEach((contract: string) => {
  //             console.log(`Contract originated: ${contract}`);
  //           });
  //         }
  //       });
  //     });
  //   });
  // }

  try {
    // Create the output folder if it doesn't exist
    fs.mkdir(outputFolder, { recursive: true }, err => {
      if (err) {
        throw new Error(`Failed to create folder: ${err.message}`);
      }
    });
    console.log(`Created folder: ${outputFolder}`);

    let curr: string = 'BL2XLarYPgwYANYRzqpLtypEJA1YvFA1CsCeLtuPeuq9kDYz1PZ';
    for (let i: number = 0; i < 8640; i++) {
      const randomProvider: TezosToolkit = [Tezos1, Tezos2, Tezos3][Math.floor(Math.random() * 3)];
      const block: BlockResponse = await randomProvider.rpc.getBlock({ block: curr });
      const filename = `block_${block.header.level}`; // Use block level for filename
      await saveBlock(block, filename);
      curr = block.header.predecessor;
      await new Promise(resolve => setTimeout(resolve, 100)); // Be respectful of the RPC server
    }

    console.log('Finished saving blocks.');
  } catch (error: any) {
    console.error('An error occurred:', error);
  }

  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for file writes to complete
  console.log('All operations completed.');
}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    // console.log('RPC URL:', RPC);
    process.exit(1);
  });

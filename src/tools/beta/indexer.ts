// import { BlockResponse, OperationMetadataBalanceUpdates, MetadataBalanceUpdatesKindEnum } from '@taquito/rpc';
// import sql, { config, ConnectionPool, IResult } from 'mssql';
// import BigNumber from 'bignumber.js';

// import INIT_STATE from '../../resources/init-state.js';
// import { assert } from '../misc.js';
// import { isNotUndefined } from '../misc.js';
// import Tezos from '../../network/taquito.js';

// async function getUpdates(blockId: number): Promise<BalanceUpdates[]> {
//   const queryString: string = `SELECT * FROM [Tezos]..[Operation] WHERE block_id = ${blockId}`;
//   const queryResults: IResult<BalanceUpdates[]> = await sql.query(queryString);

//   const updates: BalanceUpdates[] = queryResults.recordset.filter(isNotUndefined);
//   return updates;
// }

// async function fetchBlock(level: number): Promise<TezosBlock> {
//   const block: BlockResponse = await Tezos().rpc.getBlock({ block: `${level}` });

//   const { operations } = block;

//   const metadata: OperationMetadata[] = operations
//     .flat()
//     .map(op => op.contents)
//     .flat()
//     .map(content => ('metadata' in content && content.metadata) || null)
//     .filter(meta => isNotUndefined(meta));

//   const updates: OperationMetadataBalanceUpdates[] = metadata
//     .map(meta => meta.balance_updates)
//     .filter(x => isNotUndefined(x))
//     .flat();

//   const internalResults: BalanceUpdates[] = metadata
//     .map(meta => meta.internal_operation_results)
//     .flat()
//     .map(internal => internal?.result)
//     .filter(res => isNotUndefined(res))
//     .map(res => ('balance_updates' in res && res.balance_updates) || null)
//     .filter(update => isNotUndefined(update))
//     .flat();

//   updates.push(...internalResults);
//   return { id: level, hash: block.hash, updates };
// }

// export async function getBlock(level: number): Promise<TezosBlock> {
//   const queryString: string = `SELECT TOP(1) * FROM [Tezos]..[Block] WHERE id = ${level}`;
//   const existingRecord: IResult<TezosBlock> = await sql.query<TezosBlock>(queryString);

//   if (existingRecord.recordset.length === 1) {
//     const record: TezosBlock = existingRecord.recordset[0];
//     const updates: BalanceUpdates[] = await getUpdates(record.id);
//     return { ...record, updates };
//   }

//   const block: TezosBlock = await fetchBlock(level);
//   await updateBlock(block);
//   return block;
// }

// export async function updateBlock(block: TezosBlock): Promise<void> {
//   await sql.query`
//     MERGE INTO [Tezos]..[Block] AS target
//     USING (VALUES (${block.id}, ${block.hash}))
//       AS source (id, hash)
//     ON target.id = source.id
//     WHEN MATCHED THEN
//       UPDATE SET hash = source.hash
//     WHEN NOT MATCHED THEN
//       INSERT (id, hash) VALUES (source.id, source.hash);
//   `;

//   await sql.query`DELETE FROM [Tezos]..[Operation] WHERE block_id = ${block.id}`;

//   await Promise.all(
//     block.updates.map(async update => {
//       return sql.query`
//         INSERT INTO [Tezos]..[Operation] (
//           kind, contract, change, origin, category, staker, delegate, participation, revelation,
//           committer, bond_id, cycle, delegator, delayed_operation_hash, block_id
//         )
//         VALUES (
//           ${update.kind}, ${update.contract}, ${update.change}, ${update.origin}, ${update.category},
//           ${update.staker}, ${update.delegate}, ${update.participation}, ${update.revelation},
//           ${update.committer}, ${update.bond_id}, ${update.cycle}, ${update.delegator}, ${update.delayed_operation_hash},
//           ${block.id}
//         )
//       `;
//     })
//   );
// }

// const sqlConfig: config = {
//   user: process.env['SQL_ADMIN'],
//   password: process.env['SQL_PASSWORD'],
//   server: 'localhost',
//   database: 'Tezos',
//   options: { encrypt: true, trustServerCertificate: true },
// };

// async function auditState(state: Record<string, BigNumber>, level: number): Promise<void> {
//   for (const [address, balance] of Object.entries(state)) {
//     const controlBalance: BigNumber = await Tezos().rpc.getBalance(address, { block: `${level}` });
//     assert(
//       controlBalance.isEqualTo(balance),
//       `Balance mismatch for ${address} at level ${level}: expected ${controlBalance.toString()}, got ${balance.toString()}`
//     );
//   }
// }

// const balanceUpdatesKinds: Set<MetadataBalanceUpdatesKindEnum> = new Set([
//   'contract',
//   'freezer',
//   'accumulator',
//   'burned',
//   'commitment',
//   'minted',
//   'staking',
// ]);

// async function main(): Promise<void> {
//   let db: ConnectionPool | undefined;
//   try {
//     db = await sql.connect(sqlConfig);

//     const state: State = INIT_STATE;
//     for (let i: number = 1; true; i++) {
//       const block: TezosBlock = await getBlock(i);

//       const newAddresses: Set<string> = new Set<string>();

//       block.updates.forEach(update => {
//         const address: string | undefined = update.contract ?? update.delegate;
//         if (address && balanceUpdatesKinds.has(update.kind)) {
//           const balance: BigNumber = state[address] ?? new BigNumber(0);
//           const change: BigNumber = new BigNumber(update.change);
//           state[address] = balance.plus(change);
//           newAddresses.add(address);
//         }
//       });

//       console.log(`Block ${block.id} processed.`);

//       const snapshot: State = Object.entries(state).reduce((acc: Record<string, BigNumber>, [address, balance]) => {
//         if (newAddresses.has(address)) {
//           acc[address] = balance;
//         }
//         return acc;
//       }, {});
//       await auditState(snapshot, block.id);
//     }
//   } catch (error) {
//     console.error('Error connecting to the database or fetching block:', error);
//   } finally {
//     await db?.close();
//   }
// }

// // main()
// //   .then(async () => {
// //     console.log('Done');
// //     process.exit(0);
// //   })
// //   .catch(error => {
// //     console.error('Error:', error);
// //     process.exit(1);
// //   });

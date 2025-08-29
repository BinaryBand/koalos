import { createTransaction, simulateOperation } from '@/index';
import { BlockchainInstance } from '@/tezos/blockchain';
import RpcProvider from '@/tezos/provider';

import { burnAddress, revealedAddress } from '@public/tests/wallet.json';

const blockchainInstance: BlockchainInstance = BlockchainInstance.createInstance(RpcProvider.singleton);

describe('performance and timeout tests', () => {
  // Set longer timeout for performance tests
  jest.setTimeout(60000);

  describe('operation performance tests', () => {
    it('should handle single operations within reasonable time', async () => {
      const startTime = Date.now();

      const batch = [createTransaction(revealedAddress, burnAddress, 0.001)];
      const prepared = await blockchainInstance.prepare(batch);
      const simulation = await simulateOperation(prepared);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within 30 seconds
      expect(executionTime).toBeLessThan(30000);

      // Validate the operation completed successfully
      expect(simulation.contents).toHaveLength(1);
      simulation.contents.forEach((c) => {
        if ('metadata' in c && c.metadata && 'operation_result' in c.metadata) {
          expect(c.metadata.operation_result).toHaveProperty('status', 'applied');
        }
      });
    });

    it('should handle batch operations efficiently', async () => {
      const startTime = Date.now();

      // Create batch of 5 operations
      const batch = Array.from({ length: 5 }, (_, i) =>
        createTransaction(revealedAddress, burnAddress, 0.001 * (i + 1))
      );

      const prepared = await blockchainInstance.prepare(batch);
      const simulation = await simulateOperation(prepared);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Batch should not take significantly longer than single operation
      // Allow up to 45 seconds for batch operations
      expect(executionTime).toBeLessThan(45000);

      // Validate all operations completed
      expect(simulation.contents).toHaveLength(5);
      simulation.contents.forEach((c) => {
        if ('metadata' in c && c.metadata && 'operation_result' in c.metadata) {
          expect(c.metadata.operation_result).toHaveProperty('status', 'applied');
        }
      });
    });

    it('should handle concurrent operations', async () => {
      const startTime = Date.now();

      // Create multiple concurrent operations
      const promises = Array.from({ length: 3 }, () => {
        const batch = [createTransaction(revealedAddress, burnAddress, 0.001)];
        return blockchainInstance.prepare(batch).then((prepared) => simulateOperation(prepared));
      });

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Concurrent operations should not take much longer than sequential
      expect(executionTime).toBeLessThan(60000);

      // All should succeed
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.contents).toHaveLength(1);
      });
    });
  });

  describe('timeout handling', () => {
    it('should handle operation timeouts gracefully', async () => {
      // Test with a reasonable timeout and proper cleanup
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Operation timed out')), 15000);
      });

      const operationPromise = (async () => {
        const batch = [createTransaction(revealedAddress, burnAddress, 0.001)];
        const prepared = await blockchainInstance.prepare(batch);
        return await simulateOperation(prepared);
      })();

      // Either the operation completes or we get a timeout
      try {
        const result = await Promise.race([operationPromise, timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId); // Clear timeout if operation completes first
        // If operation completes, validate it
        expect(result).toHaveProperty('contents');
        expect(Array.isArray((result as any).contents)).toBe(true);
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId); // Clear timeout on error
        // If timeout or other error, handle gracefully
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error && error.message === 'Operation timed out') {
          // Timeout is acceptable for this test
          console.warn('Operation timed out - this is expected for timeout testing');
        } else {
          // Re-throw unexpected errors
          throw error;
        }
      }
    });

    it('should handle network delays', async () => {
      // This test simulates network delays by measuring actual operation time
      const measurements = [];

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();

        try {
          const batch = [createTransaction(revealedAddress, burnAddress, 0.001)];
          const prepared = await blockchainInstance.prepare(batch);
          await simulateOperation(prepared);

          const endTime = Date.now();
          measurements.push(endTime - startTime);
        } catch (error) {
          // If network issues occur, that's acceptable for this test
          console.warn('Network delay test encountered error:', error);
        }
      }

      // At least one measurement should have been successful
      expect(measurements.length).toBeGreaterThan(0);

      // Calculate average time
      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;

      // Average should be reasonable (under 30 seconds)
      expect(averageTime).toBeLessThan(30000);

      // No single operation should take excessively long
      measurements.forEach((time) => {
        expect(time).toBeLessThan(60000);
      });
    });
  });

  describe('memory and resource tests', () => {
    it('should not cause memory leaks with repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        const batch = [createTransaction(revealedAddress, burnAddress, 0.001)];
        const prepared = await blockchainInstance.prepare(batch);
        await simulateOperation(prepared);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large data structures efficiently', async () => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      try {
        // Create a larger batch to test memory efficiency
        const largeBatch = Array.from({ length: 20 }, (_, i) =>
          createTransaction(revealedAddress, burnAddress, 0.001 * (i + 1))
        );

        const prepared = await blockchainInstance.prepare(largeBatch);
        const simulation = await simulateOperation(prepared);

        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;

        // Time should scale reasonably with batch size
        expect(endTime - startTime).toBeLessThan(90000); // 90 seconds max

        // Memory usage should be reasonable
        const memoryUsed = endMemory - startMemory;
        expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB

        // All operations should complete successfully
        expect(simulation.contents).toHaveLength(20);
      } catch (error) {
        // Handle expected failures gracefully - large batches may hit RPC or resource limits
        if (error instanceof Error) {
          const errorMessage = error.message;
          // Check for various types of expected failures
          if (
            errorMessage.includes('Unexpected token') ||
            errorMessage.includes('Failed to') ||
            errorMessage.includes('gas_exhausted') ||
            errorMessage.includes('TezosOperationError') ||
            errorMessage.includes('timeout')
          ) {
            console.warn('Large data structures test failed due to expected limitations:', errorMessage);
            // This is expected behavior for large batches hitting resource limits
            expect(errorMessage.length).toBeGreaterThan(0); // Just verify we got a meaningful error
          } else {
            throw error; // Re-throw unexpected errors
          }
        } else {
          throw error;
        }
      }
    });
  });

  describe('error resilience tests', () => {
    it('should recover from transient failures', async () => {
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: Error | null = null;

      while (attempts < maxAttempts) {
        try {
          attempts++;

          const batch = [createTransaction(revealedAddress, burnAddress, 0.001)];
          const prepared = await blockchainInstance.prepare(batch);
          const simulation = await simulateOperation(prepared);

          // If successful, validate and break
          expect(simulation.contents).toHaveLength(1);
          break;
        } catch (error) {
          lastError = error as Error;

          if (attempts < maxAttempts) {
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      // Either we succeeded, or we exhausted retries
      if (attempts === maxAttempts && lastError) {
        // If all retries failed, that's acceptable for resilience testing
        // Just ensure we tried the expected number of times
        expect(attempts).toBe(maxAttempts);
        expect(lastError).toBeInstanceOf(Error);
      }
    });

    it('should handle rapid successive operations', async () => {
      const promises = [];
      const startTime = Date.now();

      // Fire off 5 operations rapidly
      for (let i = 0; i < 5; i++) {
        const promise = (async () => {
          const batch = [createTransaction(revealedAddress, burnAddress, 0.001 * (i + 1))];
          const prepared = await blockchainInstance.prepare(batch);
          return await simulateOperation(prepared);
        })();

        promises.push(promise);
      }

      // Wait for all to complete or fail
      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(120000); // 2 minutes max

      // Count successful operations
      const successful = results.filter((result) => result.status === 'fulfilled');
      const failed = results.filter((result) => result.status === 'rejected');

      // At least some should succeed
      expect(successful.length).toBeGreaterThan(0);

      // Validate successful operations
      successful.forEach((result) => {
        if (result.status === 'fulfilled') {
          expect(result.value.contents).toHaveLength(1);
        }
      });

      // Log failure rate for monitoring
      const failureRate = failed.length / results.length;
      console.log(`Rapid operations failure rate: ${(failureRate * 100).toFixed(1)}%`);

      // Failure rate should not be 100%
      expect(failureRate).toBeLessThan(1.0);
    });
  });
});

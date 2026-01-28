import { CacheService } from '../src/common/cache.service';

async function verifyCoalescing() {
    const cache = new CacheService();
    let executionCount = 0;

    const expensiveOperation = async () => {
        executionCount++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
        return `Result ${executionCount}`;
    };

    console.log('--- Coalescing Test ---');
    console.log('Sending 5 concurrent requests...');

    // Trigger 5 concurrent requests for the same key
    const results = await Promise.all([
        cache.coalescedFetch('test-key', expensiveOperation),
        cache.coalescedFetch('test-key', expensiveOperation),
        cache.coalescedFetch('test-key', expensiveOperation),
        cache.coalescedFetch('test-key', expensiveOperation),
        cache.coalescedFetch('test-key', expensiveOperation),
    ]);

    console.log('Results:', results);
    console.log('Execution Count (Expected 1):', executionCount);

    if (executionCount === 1) {
        console.log('✅ PASS: Requests were coalesced.');
    } else {
        console.log('❌ FAIL: Requests were NOT coalesced.');
    }

    console.log('\n--- Memory Audit ---');
    const memory = process.memoryUsage();
    console.log(`Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Total: ${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`RSS: ${(memory.rss / 1024 / 1024).toFixed(2)} MB`);
}

verifyCoalescing().catch(console.error);

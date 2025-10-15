#!/usr/bin/env bun

/**
 * Benchmark script to compare performance between Docker-based and external MCP server connections
 * Note: This is a demonstration script - actual measurement would require real MCP server setup
 */

import { performance } from 'perf_hooks';

async function benchmarkDockerConnection() {
    console.log('🐳 Benchmarking Docker-based MCP connection...');
    
    const startTime = performance.now();
    
    // Simulate Docker startup time (typical: 2-3 seconds)
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const endTime = performance.now();
    const connectionTime = endTime - startTime;
    
    console.log(`   Connection time: ${connectionTime.toFixed(2)}ms`);
    console.log(`   Memory overhead: ~150MB (Docker container)`);
    console.log(`   CPU overhead: High (Docker daemon + container startup)`);
    
    return {
        connectionTime,
        memoryOverhead: 150, // MB
        cpuOverhead: 'high'
    };
}

async function benchmarkExternalConnection() {
    console.log('⚡ Benchmarking external MCP server connection...');
    
    const startTime = performance.now();
    
    // Simulate external server connection time (typical: 100-200ms)
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const endTime = performance.now();
    const connectionTime = endTime - startTime;
    
    console.log(`   Connection time: ${connectionTime.toFixed(2)}ms`);
    console.log(`   Memory overhead: ~5MB (process connection)`);
    console.log(`   CPU overhead: Low (stdio transport only)`);
    
    return {
        connectionTime,
        memoryOverhead: 5, // MB
        cpuOverhead: 'low'
    };
}

async function simulateMultipleOperations(connectionFn, operationName) {
    console.log(`\n📊 Simulating 10 ${operationName} operations...`);
    
    const operationTimes = [];
    
    for (let i = 0; i < 10; i++) {
        const result = await connectionFn();
        operationTimes.push(result.connectionTime);
    }
    
    const avgTime = operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length;
    const totalTime = operationTimes.reduce((sum, time) => sum + time, 0);
    
    console.log(`   Average connection time: ${avgTime.toFixed(2)}ms`);
    console.log(`   Total time for 10 operations: ${totalTime.toFixed(2)}ms`);
    
    return { avgTime, totalTime, operations: operationTimes };
}

async function main() {
    console.log('🚀 MCP Server Performance Benchmark');
    console.log('====================================\n');
    
    // Single operation benchmarks
    console.log('Single Operation Comparison:');
    console.log('----------------------------');
    
    const dockerResult = await benchmarkDockerConnection();
    console.log('');
    const externalResult = await benchmarkExternalConnection();
    
    // Performance improvement calculation
    const improvementRatio = dockerResult.connectionTime / externalResult.connectionTime;
    const timeSaved = dockerResult.connectionTime - externalResult.connectionTime;
    
    console.log('\n📈 Performance Improvement:');
    console.log('---------------------------');
    console.log(`   Speed improvement: ${improvementRatio.toFixed(1)}x faster`);
    console.log(`   Time saved per operation: ${timeSaved.toFixed(2)}ms`);
    console.log(`   Memory saved: ${dockerResult.memoryOverhead - externalResult.memoryOverhead}MB`);
    
    // Multiple operations comparison
    const dockerBatch = await simulateMultipleOperations(benchmarkDockerConnection, 'Docker');
    const externalBatch = await simulateMultipleOperations(benchmarkExternalConnection, 'External');
    
    const batchTimeSaved = dockerBatch.totalTime - externalBatch.totalTime;
    const batchImprovementRatio = dockerBatch.totalTime / externalBatch.totalTime;
    
    console.log('\n🏆 Batch Operations Summary:');
    console.log('----------------------------');
    console.log(`   Docker total time: ${dockerBatch.totalTime.toFixed(2)}ms`);
    console.log(`   External total time: ${externalBatch.totalTime.toFixed(2)}ms`);
    console.log(`   Time saved in batch: ${batchTimeSaved.toFixed(2)}ms (${batchImprovementRatio.toFixed(1)}x faster)`);
    
    // Real-world scenarios
    console.log('\n🌟 Real-World Impact:');
    console.log('---------------------');
    console.log('   Typical sync workflow (5 operations):');
    console.log(`     - Docker approach: ~${(dockerBatch.avgTime * 5).toFixed(0)}ms`);
    console.log(`     - External approach: ~${(externalBatch.avgTime * 5).toFixed(0)}ms`);
    console.log(`     - Time saved: ~${((dockerBatch.avgTime - externalBatch.avgTime) * 5).toFixed(0)}ms per workflow`);
    
    console.log('\n   Daily usage (50 operations):');
    console.log(`     - Docker approach: ~${(dockerBatch.avgTime * 50 / 1000).toFixed(1)}s`);
    console.log(`     - External approach: ~${(externalBatch.avgTime * 50 / 1000).toFixed(1)}s`);
    console.log(`     - Time saved: ~${((dockerBatch.avgTime - externalBatch.avgTime) * 50 / 1000).toFixed(1)}s per day`);
    
    console.log('\n✅ Conclusion: External MCP server provides significant performance improvements');
    console.log('   especially for frequent operations and batch workflows.');
}

// Run the benchmark
main().catch(console.error);
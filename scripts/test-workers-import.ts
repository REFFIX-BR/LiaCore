console.log('🔍 Testing voice workers import...');

(async () => {
  try {
    const workers = await import('../server/modules/voice/workers');
    console.log('✅ Voice workers imported successfully!');
    console.log('📊 Workers:', Object.keys(workers));
  } catch (error: any) {
    console.error('❌ Failed to import voice workers:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();

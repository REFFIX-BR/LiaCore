import { db } from "@db";
import { sql } from "drizzle-orm";

export async function runAutoMigrations() {
  try {
    console.log('🔄 [Auto-Migration] Checking database schema...');
    
    // Check if is_private column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' 
      AND column_name IN ('is_private', 'send_by')
    `);
    
    const existingColumns = result.rows.map((row: any) => row.column_name);
    
    // Add is_private if missing
    if (!existingColumns.includes('is_private')) {
      console.log('📝 [Auto-Migration] Adding column: is_private');
      await db.execute(sql`
        ALTER TABLE messages 
        ADD COLUMN is_private BOOLEAN DEFAULT false
      `);
      console.log('✅ [Auto-Migration] Column is_private added');
    } else {
      console.log('✅ [Auto-Migration] Column is_private already exists');
    }
    
    // Add send_by if missing
    if (!existingColumns.includes('send_by')) {
      console.log('📝 [Auto-Migration] Adding column: send_by');
      await db.execute(sql`
        ALTER TABLE messages 
        ADD COLUMN send_by TEXT
      `);
      console.log('✅ [Auto-Migration] Column send_by added');
    } else {
      console.log('✅ [Auto-Migration] Column send_by already exists');
    }
    
    console.log('✅ [Auto-Migration] Schema check complete');
    
  } catch (error) {
    console.error('❌ [Auto-Migration] Failed to run migrations:', error);
    throw error;
  }
}

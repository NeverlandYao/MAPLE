import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Initializing database...');

    // Create extension for UUID if it doesn't exist
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create variable_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS variable_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        description TEXT,
        template_json JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger
    await client.query(`
      DROP TRIGGER IF EXISTS update_variable_templates_updated_at ON variable_templates;
      CREATE TRIGGER update_variable_templates_updated_at
      BEFORE UPDATE ON variable_templates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Insert default templates
    const defaultTemplates = [
      {
        name: 'DeepSeek-R1 (ModelScope)',
        description: 'Default configuration for DeepSeek-R1 on ModelScope platform',
        template_json: {
          MS_BASE_URL: 'https://api.modelscope.cn/v1',
          MS_MODEL: 'deepseek-ai/DeepSeek-R1-distill-Qwen-7B',
          temperature: 0.6,
          enable_thinking: true
        }
      },
      {
        name: 'OpenAI GPT-4o',
        description: 'Standard configuration for OpenAI GPT-4o',
        template_json: {
          MS_BASE_URL: 'https://api.openai.com/v1',
          MS_MODEL: 'gpt-4o',
          temperature: 0.7,
          enable_thinking: false
        }
      },
      {
        name: 'AI 素养评估专用模板',
        description: '针对 MAPLE 系统优化的 AI 素养评估配置',
        template_json: {
          MS_MODEL: 'deepseek-ai/DeepSeek-R1-distill-Qwen-7B',
          system_prompt_type: 'literacy_evaluation',
          max_tokens: 2048,
          presence_penalty: 0.1
        }
      }
    ];

    for (const template of defaultTemplates) {
      await client.query(`
        INSERT INTO variable_templates (name, description, template_json)
        SELECT $1, $2, $3
        WHERE NOT EXISTS (SELECT 1 FROM variable_templates WHERE name = $1)
      `, [template.name, template.description, template.template_json]);
    }

    console.log('Database initialized and seeded successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();

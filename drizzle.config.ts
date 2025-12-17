import type { Config } from 'drizzle-kit';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: isProduction ? 'mysql' : 'sqlite',
  dbCredentials: isProduction
    ? {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'herbal_erp',
      }
    : {
        url: './test.db',
      },
} satisfies Config;

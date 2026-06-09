import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TursoStore } from './common/turso.store';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const store = app.get(TursoStore);

  console.log('🌱 Starting database seeding...');

  const username = process.env.DASHBOARD_USERNAME || 'admin';
  const password = process.env.DASHBOARD_PASSWORD || 'changeme';
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  // 1. Seed Admin
  const existingAdmin = await store.findByUsername(username);
  if (!existingAdmin) {
    const adminId = crypto.randomUUID();
    await store.client.execute(
      'INSERT INTO users (id, username, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [adminId, username, passwordHash, 'admin', now, now],
    );
    console.log(`✅ Admin user "${username}" seeded successfully.`);
  } else {
    // If they exist, update/reset password to match env / fallback
    await store.client.execute(
      'UPDATE users SET passwordHash = ?, updatedAt = ? WHERE username = ?',
      [passwordHash, now, username],
    );
    console.log(`✅ Admin user "${username}" password synchronized/updated.`);
  }

  // 2. Seed Operator
  const existingOperator = await store.findByUsername('operator');
  if (!existingOperator) {
    const operatorId = crypto.randomUUID();
    const operatorHash = await bcrypt.hash('operatorpass', 10);
    await store.client.execute(
      'INSERT INTO users (id, username, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [operatorId, 'operator', operatorHash, 'operator', now, now],
    );
    console.log('✅ Operator user "operator" seeded successfully with password "operatorpass".');
  }

  // 3. Migrate any null or empty string userId records
  const adminUser = await store.findByUsername(username);
  if (adminUser) {
    for (const table of ['databases', 'storage', 'jobs', 'snapshots']) {
      try {
        await store.client.execute(`UPDATE ${table} SET userId = ? WHERE userId IS NULL OR userId = ''`, [adminUser.id]);
      } catch {}
    }
    console.log('✅ Legacy records successfully migrated to Admin.');
  }

  console.log('🌱 Database seeding completed successfully!');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

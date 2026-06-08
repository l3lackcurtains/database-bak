import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TursoStore } from './common/turso.store';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const args = process.argv.slice(2);
  const username = args[0];
  const newPassword = args[1];

  if (!username || !newPassword) {
    console.error('❌ Error: Missing arguments.');
    console.log('Usage: pnpm db:reset-password <username> <new-password>');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters long.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const store = app.get(TursoStore);

  console.log(`🔑 Resetting password for user "${username}"...`);

  const user = await store.findByUsername(username);
  if (!user) {
    console.error(`❌ Error: User "${username}" not found in database.`);
    await app.close();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const now = new Date().toISOString();

  await store.client.execute(
    'UPDATE users SET passwordHash = ?, updatedAt = ? WHERE username = ?',
    [passwordHash, now, username],
  );

  console.log(`✅ Success: Password for user "${username}" has been successfully reset!`);
  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Password reset failed:', err);
  process.exit(1);
});

import { Global, Module } from '@nestjs/common';
import { TursoStore } from './turso.store';
import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [TursoStore, CryptoService],
  exports: [TursoStore, CryptoService],
})
export class CommonModule {}

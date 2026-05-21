import { Global, Module } from '@nestjs/common';
import { TursoStore } from './turso.store';

@Global()
@Module({
  providers: [TursoStore],
  exports: [TursoStore],
})
export class CommonModule {}

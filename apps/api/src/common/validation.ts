import { BadRequestException } from '@nestjs/common';

export class ValidationPipe {
  static validateRequired(fields: string[], body: Record<string, any>) {
    const missing = fields.filter(
      (f) => !body[f] && body[f] !== false && body[f] !== 0,
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missing.join(', ')}`,
      );
    }
  }
}

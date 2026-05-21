import { Transform } from 'stream';
import { createHash } from 'crypto';

export class HashStream extends Transform {
  private hash = createHash('sha256');
  private _digest: string | null = null;

  get digest(): string | null {
    return this._digest;
  }

  _transform(chunk: Buffer, _encoding: string, callback: Function) {
    this.hash.update(chunk);
    this.push(chunk);
    callback();
  }

  _flush(callback: Function) {
    this._digest = this.hash.digest('hex');
    callback();
  }
}

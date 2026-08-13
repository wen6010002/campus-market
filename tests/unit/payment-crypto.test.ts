import { generateKeyPairSync, createCipheriv } from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { rsaSign, rsaVerify, aesGcmDecrypt } from '@/server/payment/crypto';

let publicKey: string;
let privateKey: string;

beforeAll(() => {
  const kp = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKey = kp.publicKey;
  privateKey = kp.privateKey;
});

describe('支付密码学（自封微信 v3 / 支付宝 RSA2）', () => {
  it('RSA-SHA256 签名/验签往返', () => {
    const msg = 'POST\n/v3/pay\n1234567890\nnonce\nbody\n';
    const sig = rsaSign(msg, privateKey);
    expect(rsaVerify(msg, sig, publicKey)).toBe(true);
    expect(rsaVerify(msg + 'x', sig, publicKey)).toBe(false);
  });

  it('AES-256-GCM 解密（微信 resource 格式）', () => {
    const key = '12345678901234567890123456789012'; // 32 字节 APIv3 key
    const nonce = Buffer.alloc(12, 1);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), nonce);
    const plaintext = JSON.stringify({
      out_trade_no: 'o1',
      transaction_id: 'tx1',
      trade_state: 'SUCCESS',
    });
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([nonce, enc, tag]).toString('base64');
    const decrypted = aesGcmDecrypt(blob, key);
    expect(JSON.parse(decrypted)).toMatchObject({
      out_trade_no: 'o1',
      transaction_id: 'tx1',
      trade_state: 'SUCCESS',
    });
  });
});

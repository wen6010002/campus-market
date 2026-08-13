// 支付密码学工具（node:crypto，自封微信 v3 / 支付宝 RSA2）
import { createSign, createVerify, createDecipheriv } from 'node:crypto';

/** RSA-SHA256 签名（base64） */
export function rsaSign(message: string, privateKeyPem: string): string {
  const sign = createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
}

/** RSA-SHA256 验签 */
export function rsaVerify(message: string, signature: string, publicKeyPem: string): boolean {
  const verify = createVerify('RSA-SHA256');
  verify.update(message);
  verify.end();
  return verify.verify(publicKeyPem, signature, 'base64');
}

/**
 * AES-256-GCM 解密（微信 v3 回调 resource）。
 * 密文 base64 布局：[nonce(12) | ciphertext | authTag(16)]，key 为 APIv3 key(32B)。
 */
export function aesGcmDecrypt(ciphertextB64: string, key: string): string {
  const data = Buffer.from(ciphertextB64, 'base64');
  const nonce = data.subarray(0, 12);
  const authTag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(12, data.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

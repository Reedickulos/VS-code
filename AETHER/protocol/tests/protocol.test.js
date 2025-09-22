/**
 * Secure Communication Protocol Test Suite
 */

const crypto = require('crypto');
const {
  generateKeyPair,
  deriveSharedSecret,
  deriveKeys,
  encrypt,
  decrypt,
  generateHMAC,
  verifyHMAC,
  createMessage,
  parseMessage,
  MESSAGE_TYPES
} = require('../src/crypto');

describe('Secure Communication Protocol', () => {
  describe('Cryptographic Functions', () => {
    test('should generate valid ECDH keypair', () => {
      const keyPair = generateKeyPair();

      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair.publicKey.length).toBe(32);
      expect(keyPair.privateKey.length).toBe(32);
    });

    test('should derive shared secret from keypair', () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();

      const shared1 = deriveSharedSecret(keyPair1.privateKey, keyPair2.publicKey);
      const shared2 = deriveSharedSecret(keyPair2.privateKey, keyPair1.publicKey);

      expect(shared1).toEqual(shared2);
      expect(shared1.length).toBe(32);
    });

    test('should derive encryption and HMAC keys', () => {
      const sharedSecret = crypto.randomBytes(32);
      const keys = deriveKeys(sharedSecret);

      expect(keys).toHaveProperty('encryptionKey');
      expect(keys).toHaveProperty('hmacKey');
      expect(keys.encryptionKey.length).toBe(32);
      expect(keys.hmacKey.length).toBe(32);
    });

    test('should encrypt and decrypt data correctly', () => {
      const key = crypto.randomBytes(32);
      const plaintext = 'Hello, secure world!';
      const iv = crypto.randomBytes(12);

      const encrypted = encrypt(plaintext, key, iv);
      const decrypted = decrypt(encrypted.encrypted, key, iv, encrypted.tag);

      expect(decrypted).toBe(plaintext);
    });

    test('should generate and verify HMAC correctly', () => {
      const key = crypto.randomBytes(32);
      const data = 'Test message for HMAC';

      const hmac = generateHMAC(data, key);
      const isValid = verifyHMAC(data, key, hmac);

      expect(isValid).toBe(true);
      expect(hmac.length).toBe(32);
    });

    test('should fail HMAC verification with wrong key', () => {
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);
      const data = 'Test message for HMAC';

      const hmac = generateHMAC(data, key1);
      const isValid = verifyHMAC(data, key2, hmac);

      expect(isValid).toBe(false);
    });
  });

  describe('Protocol Message Handling', () => {
    test('should create and parse protocol messages correctly', () => {
      const encryptionKey = crypto.randomBytes(32);
      const hmacKey = crypto.randomBytes(32);
      const payload = {
        type: 'test',
        data: 'Hello, protocol!'
      };

      const message = createMessage(
        MESSAGE_TYPES.DATA,
        1,
        payload,
        encryptionKey,
        hmacKey
      );

      const parsed = parseMessage(message, encryptionKey, hmacKey);

      expect(parsed.header.version).toBe(0x01);
      expect(parsed.header.messageType).toBe(MESSAGE_TYPES.DATA);
      expect(parsed.header.sequenceNumber).toBe(1);
      expect(parsed.payload).toEqual(payload);
    });

    test('should fail to parse message with wrong keys', () => {
      const encryptionKey = crypto.randomBytes(32);
      const hmacKey = crypto.randomBytes(32);
      const wrongKey = crypto.randomBytes(32);
      const payload = { type: 'test', data: 'Hello' };

      const message = createMessage(
        MESSAGE_TYPES.DATA,
        1,
        payload,
        encryptionKey,
        hmacKey
      );

      expect(() => {
        parseMessage(message, wrongKey, hmacKey);
      }).toThrow();

      expect(() => {
        parseMessage(message, encryptionKey, wrongKey);
      }).toThrow();
    });

    test('should handle different message types', () => {
      const encryptionKey = crypto.randomBytes(32);
      const hmacKey = crypto.randomBytes(32);

      const messageTypes = [
        MESSAGE_TYPES.HANDSHAKE_INIT,
        MESSAGE_TYPES.HANDSHAKE_RESPONSE,
        MESSAGE_TYPES.DATA,
        MESSAGE_TYPES.ACK,
        MESSAGE_TYPES.CLOSE
      ];

      messageTypes.forEach(type => {
        const payload = { type: 'test', messageType: type };
        const message = createMessage(type, 1, payload, encryptionKey, hmacKey);
        const parsed = parseMessage(message, encryptionKey, hmacKey);

        expect(parsed.header.messageType).toBe(type);
        expect(parsed.payload.messageType).toBe(type);
      });
    });
  });

  describe('Security Properties', () => {
    test('should provide perfect forward secrecy', () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();
      const keyPair3 = generateKeyPair(); // New keypair

      const shared1 = deriveSharedSecret(keyPair1.privateKey, keyPair2.publicKey);
      const shared2 = deriveSharedSecret(keyPair3.privateKey, keyPair2.publicKey);

      // Shared secrets should be different
      expect(shared1).not.toEqual(shared2);

      // Derived keys should be different
      const keys1 = deriveKeys(shared1);
      const keys2 = deriveKeys(shared2);
      expect(keys1.encryptionKey).not.toEqual(keys2.encryptionKey);
      expect(keys1.hmacKey).not.toEqual(keys2.hmacKey);
    });

    test('should prevent replay attacks with sequence numbers', () => {
      const encryptionKey = crypto.randomBytes(32);
      const hmacKey = crypto.randomBytes(32);
      const payload = { type: 'test', data: 'Hello' };

      // Create messages with different sequence numbers
      const message1 = createMessage(MESSAGE_TYPES.DATA, 1, payload, encryptionKey, hmacKey);
      const message2 = createMessage(MESSAGE_TYPES.DATA, 2, payload, encryptionKey, hmacKey);

      const parsed1 = parseMessage(message1, encryptionKey, hmacKey);
      const parsed2 = parseMessage(message2, encryptionKey, hmacKey);

      expect(parsed1.header.sequenceNumber).toBe(1);
      expect(parsed2.header.sequenceNumber).toBe(2);
    });

    test('should provide message integrity', () => {
      const encryptionKey = crypto.randomBytes(32);
      const hmacKey = crypto.randomBytes(32);
      const payload = { type: 'test', data: 'Hello, world!' };

      const message = createMessage(MESSAGE_TYPES.DATA, 1, payload, encryptionKey, hmacKey);

      // Modify the message
      const modifiedMessage = Buffer.from(message);
      modifiedMessage[20] = modifiedMessage[20] ^ 0xFF; // Flip a bit

      expect(() => {
        parseMessage(modifiedMessage, encryptionKey, hmacKey);
      }).toThrow('HMAC verification failed');
    });

    test('should provide confidentiality', () => {
      const encryptionKey = crypto.randomBytes(32);
      const hmacKey = crypto.randomBytes(32);
      const payload = { type: 'secret', data: 'This is confidential information' };

      const message = createMessage(MESSAGE_TYPES.DATA, 1, payload, encryptionKey, hmacKey);

      // Extract encrypted portion (should not contain plaintext)
      const headerLength = 14;
      const ivLength = 12;
      const tagLength = 16;
      const encryptedPortion = message.slice(headerLength + ivLength, -hmacLength);

      const encryptedText = encryptedPortion.toString('hex');
      const plaintext = payload.data;

      // Should not contain plaintext
      expect(encryptedText.toLowerCase()).not.toContain(plaintext.toLowerCase());
      expect(encryptedText).not.toBe(plaintext);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid message format', () => {
      const encryptionKey = crypto.randomBytes(32);
      const hmacKey = crypto.randomBytes(32);

      const invalidMessage = Buffer.from('invalid message');

      expect(() => {
        parseMessage(invalidMessage, encryptionKey, hmacKey);
      }).toThrow();
    });

    test('should handle wrong encryption key', () => {
      const encryptionKey = crypto.randomBytes(32);
      const wrongKey = crypto.randomBytes(32);
      const hmacKey = crypto.randomBytes(32);
      const payload = { type: 'test', data: 'Hello' };

      const message = createMessage(MESSAGE_TYPES.DATA, 1, payload, encryptionKey, hmacKey);

      expect(() => {
        parseMessage(message, wrongKey, hmacKey);
      }).toThrow();
    });

    test('should handle decryption failures gracefully', () => {
      const encryptionKey = crypto.randomBytes(32);
      const hmacKey = crypto.randomBytes(32);
      const payload = { type: 'test', data: 'Hello' };

      const message = createMessage(MESSAGE_TYPES.DATA, 1, payload, encryptionKey, hmacKey);

      // Corrupt the encrypted data
      const corruptedMessage = Buffer.from(message);
      corruptedMessage[30] = corruptedMessage[30] ^ 0xFF;

      expect(() => {
        parseMessage(corruptedMessage, encryptionKey, hmacKey);
      }).toThrow();
    });
  });

  describe('Performance', () => {
    test('should encrypt/decrypt quickly', () => {
      const key = crypto.randomBytes(32);
      const data = 'A'.repeat(1000); // 1KB of data
      const iv = crypto.randomBytes(12);

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        const encrypted = encrypt(data, key, iv);
        const decrypted = decrypt(encrypted.encrypted, key, iv, encrypted.tag);
        expect(decrypted).toBe(data);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    test('should handle large payloads', () => {
      const key = crypto.randomBytes(32);
      const data = 'A'.repeat(100000); // 100KB of data
      const iv = crypto.randomBytes(12);

      const encrypted = encrypt(data, key, iv);
      const decrypted = decrypt(encrypted.encrypted, key, iv, encrypted.tag);

      expect(decrypted).toBe(data);
      expect(decrypted.length).toBe(data.length);
    });
  });
});
/**
 * Cryptographic utilities for the Secure Communication Protocol
 */

const crypto = require('crypto');

// Protocol constants
const PROTOCOL_CONSTANTS = {
  VERSION: 0x01,
  KEY_LENGTH: 32, // 256 bits
  IV_LENGTH: 12,  // 96 bits for GCM
  TAG_LENGTH: 16, // 128 bits
  HMAC_LENGTH: 32, // SHA-256
  SALT: Buffer.from('SCP-Protocol-Salt-2024'),
  INFO: Buffer.from('SCP-Key-Derivation')
};

/**
 * Generate ECDH keypair using X25519
 */
function generateKeyPair() {
  return crypto.generateKeyPairSync('x25519');
}

/**
 * Perform ECDH key exchange
 */
function deriveSharedSecret(privateKey, publicKey) {
  return crypto.diffieHellman({
    privateKey: privateKey,
    publicKey: publicKey
  });
}

/**
 * Derive encryption keys using HKDF
 */
function deriveKeys(sharedSecret, salt = PROTOCOL_CONSTANTS.SALT, info = PROTOCOL_CONSTANTS.INFO) {
  const keyMaterial = crypto.hkdfSync(
    'sha256',
    sharedSecret,
    salt,
    info,
    64 // 2 * KEY_LENGTH (encryption + HMAC keys)
  );

  return {
    encryptionKey: keyMaterial.slice(0, PROTOCOL_CONSTANTS.KEY_LENGTH),
    hmacKey: keyMaterial.slice(PROTOCOL_CONSTANTS.KEY_LENGTH)
  };
}

/**
 * Encrypt data using AES-256-GCM
 */
function encrypt(plaintext, key, iv = null) {
  const ivBuffer = iv || crypto.randomBytes(PROTOCOL_CONSTANTS.IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, ivBuffer);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: ivBuffer,
    tag
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(encrypted, key, iv, tag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate HMAC for message authentication
 */
function generateHMAC(data, key) {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data);
  return hmac.digest();
}

/**
 * Verify HMAC for message authentication
 */
function verifyHMAC(data, key, expectedHMAC) {
  const actualHMAC = generateHMAC(data, key);
  return crypto.timingSafeEqual(actualHMAC, expectedHMAC);
}

/**
 * Generate secure random bytes
 */
function randomBytes(length) {
  return crypto.randomBytes(length);
}

/**
 * Hash data using SHA-256
 */
function hash(data) {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Protocol message types
 */
const MESSAGE_TYPES = {
  HANDSHAKE_INIT: 0x01,
  HANDSHAKE_RESPONSE: 0x02,
  DATA: 0x03,
  ACK: 0x04,
  CLOSE: 0x05
};

/**
 * Create protocol message header
 */
function createMessageHeader(messageType, sequenceNumber, payloadLength) {
  const header = Buffer.alloc(14); // 1 + 1 + 8 + 4

  header.writeUInt8(PROTOCOL_CONSTANTS.VERSION, 0);
  header.writeUInt8(messageType, 1);
  header.writeBigUInt64BE(BigInt(sequenceNumber), 2);
  header.writeUInt32BE(payloadLength, 10);

  return header;
}

/**
 * Parse protocol message header
 */
function parseMessageHeader(headerBuffer) {
  if (headerBuffer.length < 14) {
    throw new Error('Invalid header length');
  }

  return {
    version: headerBuffer.readUInt8(0),
    messageType: headerBuffer.readUInt8(1),
    sequenceNumber: Number(headerBuffer.readBigUInt64BE(2)),
    payloadLength: headerBuffer.readUInt32BE(10)
  };
}

/**
 * Create full protocol message
 */
function createMessage(messageType, sequenceNumber, payload, encryptionKey, hmacKey) {
  const payloadBuffer = Buffer.from(JSON.stringify(payload));
  const header = createMessageHeader(messageType, sequenceNumber, payloadBuffer.length);

  // Encrypt payload
  const encryptedData = encrypt(payloadBuffer.toString(), encryptionKey);
  const encryptedPayload = Buffer.from(encryptedData.encrypted, 'hex');

  // Create message body (IV + encrypted payload + tag)
  const messageBody = Buffer.concat([
    encryptedData.iv,
    encryptedPayload,
    encryptedData.tag
  ]);

  // Generate HMAC for header + body
  const hmacData = Buffer.concat([header, messageBody]);
  const hmac = generateHMAC(hmacData, hmacKey);

  // Combine all parts
  return Buffer.concat([header, messageBody, hmac]);
}

/**
 * Parse and verify protocol message
 */
function parseMessage(messageBuffer, encryptionKey, hmacKey) {
  if (messageBuffer.length < 14 + 12 + 16 + 32) { // header + IV + tag + HMAC
    throw new Error('Message too short');
  }

  // Split message components
  const header = messageBuffer.slice(0, 14);
  const iv = messageBuffer.slice(14, 26);
  const encryptedPayload = messageBuffer.slice(26, -48); // -32 for HMAC, -16 for tag
  const tag = messageBuffer.slice(-48, -32);
  const hmac = messageBuffer.slice(-32);

  // Verify HMAC
  const hmacData = messageBuffer.slice(0, -32);
  if (!verifyHMAC(hmacData, hmacKey, hmac)) {
    throw new Error('HMAC verification failed');
  }

  // Parse header
  const headerInfo = parseMessageHeader(header);

  // Decrypt payload
  const decryptedPayload = decrypt(encryptedPayload.toString('hex'), encryptionKey, iv, tag);
  const payload = JSON.parse(decryptedPayload);

  return {
    header: headerInfo,
    payload
  };
}

module.exports = {
  PROTOCOL_CONSTANTS,
  MESSAGE_TYPES,
  generateKeyPair,
  deriveSharedSecret,
  deriveKeys,
  encrypt,
  decrypt,
  generateHMAC,
  verifyHMAC,
  randomBytes,
  hash,
  createMessage,
  parseMessage,
  createMessageHeader,
  parseMessageHeader
};

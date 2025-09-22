/**
 * Secure Communication Protocol (SCP) Implementation
 */

const crypto = require('crypto');
const {
  generateKeyPair,
  deriveSharedSecret,
  deriveKeys,
  createMessage,
  parseMessage,
  MESSAGE_TYPES,
  randomBytes
} = require('./crypto');

/**
 * Protocol states
 */
const PROTOCOL_STATES = {
  DISCONNECTED: 'disconnected',
  HANDSHAKE_INIT: 'handshake_init',
  HANDSHAKE_RESPONSE: 'handshake_response',
  CONNECTED: 'connected',
  CLOSED: 'closed'
};

/**
 * Protocol errors
 */
const PROTOCOL_ERRORS = {
  INVALID_STATE: 'Invalid protocol state',
  INVALID_MESSAGE: 'Invalid message format',
  AUTHENTICATION_FAILED: 'Authentication failed',
  TIMEOUT: 'Protocol timeout',
  CONNECTION_CLOSED: 'Connection closed'
};

/**
 * Secure Communication Protocol Class
 */
class SecureCommunicationProtocol {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 30000, // 30 seconds
      maxRetries: options.maxRetries || 3,
      autoReconnect: options.autoReconnect || false,
      ...options
    };

    this.state = PROTOCOL_STATES.DISCONNECTED;
    this.sequenceNumber = 0;
    this.remoteSequenceNumber = 0;
    this.sessionKeys = null;
    this.keyPair = null;
    this.remotePublicKey = null;
    this.connection = null;
    this.messageQueue = [];
    this.pendingRequests = new Map();
    this.timeoutId = null;

    // Event handlers
    this.onMessage = null;
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
  }

  /**
   * Initialize the protocol with a keypair
   */
  initialize() {
    this.keyPair = generateKeyPair();
    this.sequenceNumber = 0;
    this.remoteSequenceNumber = 0;
    this.state = PROTOCOL_STATES.HANDSHAKE_INIT;
    return this.keyPair;
  }

  /**
   * Connect to a remote peer
   */
  async connect(remoteAddress, remotePort, keyPair = null) {
    if (keyPair) {
      this.keyPair = keyPair;
    } else if (!this.keyPair) {
      this.initialize();
    }

    this.state = PROTOCOL_STATES.HANDSHAKE_INIT;

    try {
      // Create connection (mock for now - would be actual network connection)
      this.connection = {
        address: remoteAddress,
        port: remotePort,
        send: (data) => this._sendData(data),
        close: () => this._closeConnection()
      };

      // Start handshake
      await this._startHandshake();

      this.state = PROTOCOL_STATES.CONNECTED;
      this._startTimeout();

      if (this.onConnect) {
        this.onConnect(this.connection);
      }

      return true;
    } catch (error) {
      this._handleError(error);
      return false;
    }
  }

  /**
   * Send a message
   */
  async send(message) {
    if (this.state !== PROTOCOL_STATES.CONNECTED) {
      throw new Error(PROTOCOL_ERRORS.INVALID_STATE);
    }

    const messageData = {
      type: 'data',
      payload: message,
      timestamp: Date.now()
    };

    const protocolMessage = createMessage(
      MESSAGE_TYPES.DATA,
      this.sequenceNumber++,
      messageData,
      this.sessionKeys.encryptionKey,
      this.sessionKeys.hmacKey
    );

    await this._sendProtocolMessage(protocolMessage);

    // Wait for acknowledgment
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(this.sequenceNumber - 1);
        reject(new Error('Message acknowledgment timeout'));
      }, this.options.timeout);

      this.pendingRequests.set(this.sequenceNumber - 1, {
        resolve,
        reject,
        timeout
      });
    });
  }

  /**
   * Receive a message
   */
  async receive() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Receive timeout'));
      }, this.options.timeout);

      this.messageQueue.push({ resolve, reject, timeout });
    });
  }

  /**
   * Close the connection
   */
  async close() {
    if (this.state === PROTOCOL_STATES.CLOSED) {
      return;
    }

    try {
      const closeMessage = createMessage(
        MESSAGE_TYPES.CLOSE,
        this.sequenceNumber++,
        { reason: 'Client disconnect' },
        this.sessionKeys.encryptionKey,
        this.sessionKeys.hmacKey
      );

      await this._sendProtocolMessage(closeMessage);
      await this._closeConnection();
    } catch (error) {
      // Force close even if message fails
      await this._closeConnection();
    }
  }

  /**
   * Start the handshake process
   */
  async _startHandshake() {
    const handshakeData = {
      type: 'handshake_init',
      publicKey: this.keyPair.publicKey,
      supportedVersions: [0x01],
      timestamp: Date.now()
    };

    // For initial handshake, use a temporary key
    const tempKey = crypto.randomBytes(32);
    const handshakeMessage = createMessage(
      MESSAGE_TYPES.HANDSHAKE_INIT,
      this.sequenceNumber++,
      handshakeData,
      tempKey,
      tempKey
    );

    await this._sendProtocolMessage(handshakeMessage);
  }

  /**
   * Handle incoming handshake response
   */
  async _handleHandshakeResponse(messageData) {
    this.remotePublicKey = messageData.publicKey;

    // Derive shared secret
    const sharedSecret = deriveSharedSecret(
      this.keyPair.privateKey,
      this.remotePublicKey
    );

    // Derive session keys
    this.sessionKeys = deriveKeys(sharedSecret);

    // Send handshake acknowledgment
    const ackData = {
      type: 'handshake_ack',
      status: 'success',
      timestamp: Date.now()
    };

    const ackMessage = createMessage(
      MESSAGE_TYPES.ACK,
      this.sequenceNumber++,
      ackData,
      this.sessionKeys.encryptionKey,
      this.sessionKeys.hmacKey
    );

    await this._sendProtocolMessage(ackMessage);

    // Update state to connected
    this.state = PROTOCOL_STATES.CONNECTED;
    this._startTimeout();
  }

  /**
   * Handle incoming data message
   */
  async _handleDataMessage(messageData) {
    // Process the received message
    if (this.onMessage) {
      this.onMessage(messageData.payload);
    }

    // Send acknowledgment
    const ackData = {
      type: 'ack',
      sequenceNumber: messageData.sequenceNumber,
      timestamp: Date.now()
    };

    const ackMessage = createMessage(
      MESSAGE_TYPES.ACK,
      this.sequenceNumber++,
      ackData,
      this.sessionKeys.encryptionKey,
      this.sessionKeys.hmacKey
    );

    await this._sendProtocolMessage(ackMessage);

    // Resolve pending message if exists
    if (this.messageQueue.length > 0) {
      const pending = this.messageQueue.shift();
      clearTimeout(pending.timeout);
      pending.resolve(messageData.payload);
    }
  }

  /**
   * Handle incoming acknowledgment
   */
  async _handleAcknowledgment(messageData) {
    const request = this.pendingRequests.get(messageData.sequenceNumber);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(messageData.sequenceNumber);
      request.resolve(messageData);
    }
  }

  /**
   * Handle incoming close message
   */
  async _handleClose(messageData) {
    await this._closeConnection();
  }

  /**
   * Process incoming protocol message
   */
  async _processMessage(messageBuffer) {
    try {
      const { header, payload } = parseMessage(
        messageBuffer,
        this.sessionKeys.encryptionKey,
        this.sessionKeys.hmacKey
      );

      // Validate sequence number
      if (header.sequenceNumber <= this.remoteSequenceNumber) {
        throw new Error('Invalid sequence number');
      }
      this.remoteSequenceNumber = header.sequenceNumber;

      // Handle message based on type
      switch (header.messageType) {
        case MESSAGE_TYPES.HANDSHAKE_RESPONSE:
          await this._handleHandshakeResponse(payload);
          break;
        case MESSAGE_TYPES.DATA:
          await this._handleDataMessage(payload);
          break;
        case MESSAGE_TYPES.ACK:
          await this._handleAcknowledgment(payload);
          break;
        case MESSAGE_TYPES.CLOSE:
          await this._handleClose(payload);
          break;
        default:
          throw new Error('Unknown message type');
      }

    } catch (error) {
      this._handleError(error);
    }
  }

  /**
   * Send protocol message
   */
  async _sendProtocolMessage(message) {
    if (this.connection && this.connection.send) {
      this.connection.send(message);
    } else {
      throw new Error('No connection available');
    }
  }

  /**
   * Send raw data (mock implementation)
   */
  async _sendData(data) {
    // In a real implementation, this would send data over network
    console.log('Sending data:', data.length, 'bytes');

    // Mock response for demonstration
    setTimeout(() => {
      this._simulateResponse(data);
    }, 100);
  }

  /**
   * Simulate response (for demonstration)
   */
  async _simulateResponse(requestData) {
    // This would normally come from network
    const mockResponse = Buffer.from('Mock response data');
    await this._processMessage(mockResponse);
  }

  /**
   * Close connection
   */
  async _closeConnection() {
    this.state = PROTOCOL_STATES.CLOSED;
    this._clearTimeout();

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    if (this.onDisconnect) {
      this.onDisconnect();
    }
  }

  /**
   * Handle protocol errors
   */
  _handleError(error) {
    console.error('Protocol error:', error.message);

    if (this.onError) {
      this.onError(error);
    }

    // Auto-close on critical errors
    if (this.state !== PROTOCOL_STATES.CLOSED) {
      this._closeConnection();
    }
  }

  /**
   * Start timeout timer
   */
  _startTimeout() {
    this._clearTimeout();
    this.timeoutId = setTimeout(() => {
      this._handleError(new Error(PROTOCOL_ERRORS.TIMEOUT));
    }, this.options.timeout);
  }

  /**
   * Clear timeout timer
   */
  _clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

module.exports = {
  SecureCommunicationProtocol,
  PROTOCOL_STATES,
  PROTOCOL_ERRORS,
  MESSAGE_TYPES
};
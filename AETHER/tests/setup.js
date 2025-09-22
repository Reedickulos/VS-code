// Mock chalk to avoid ES module issues
jest.mock('chalk', () => ({
  red: jest.fn((text) => `RED:${text}`),
  green: jest.fn((text) => `GREEN:${text}`),
  yellow: jest.fn((text) => `YELLOW:${text}`),
  blue: jest.fn((text) => `BLUE:${text}`),
  gray: jest.fn((text) => `GRAY:${text}`),
  white: jest.fn((text) => text),
  strikethrough: {
    gray: jest.fn((text) => `STRIKETHROUGH:${text}`)
  }
}));

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn()
}));
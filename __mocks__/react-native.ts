/**
 * Mock for react-native
 * Used in Jest tests to avoid importing actual native modules
 */

export const Linking = {
  openSettings: jest.fn(),
  openURL: jest.fn(),
  canOpenURL: jest.fn(),
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}

export const Platform = {
  OS: 'ios',
  Version: '16.0',
  select: jest.fn((obj) => obj.ios),
}

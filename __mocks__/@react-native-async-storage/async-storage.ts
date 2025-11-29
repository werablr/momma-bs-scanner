/**
 * Mock for @react-native-async-storage/async-storage
 * Used in Jest tests to avoid importing actual native modules
 */

const AsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}

export default AsyncStorage

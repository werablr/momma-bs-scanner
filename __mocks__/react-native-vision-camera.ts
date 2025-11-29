/**
 * Mock for react-native-vision-camera
 * Used in Jest tests to avoid importing actual native modules
 */

export const Camera = {
  getCameraPermissionStatus: jest.fn(),
  requestCameraPermission: jest.fn(),
  getMicrophonePermissionStatus: jest.fn(),
  requestMicrophonePermissionStatus: jest.fn(),
}

export const useCameraDevices = jest.fn()
export const useFrameProcessor = jest.fn()

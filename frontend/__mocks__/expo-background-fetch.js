// Stub for expo-background-fetch (not installed; mocked per-test via jest.mock)
module.exports = {
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
  BackgroundFetchResult: { NewData: 1, NoData: 2, Failed: 3 },
};

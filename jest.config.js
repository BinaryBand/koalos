import { createDefaultPreset, pathsToModuleNameMapper } from 'ts-jest';

const jestConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: { ...createDefaultPreset().transform },
  moduleNameMapper: pathsToModuleNameMapper({
    '@/*': ['src/*'],
    '@public/*': ['public/*'],
  }),
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Force Jest to exit after tests complete
  forceExit: true,
  // Detect open handles that prevent Jest from exiting
  detectOpenHandles: true,
  // Set a timeout for tests
  testTimeout: 30000,
};

export default jestConfig;

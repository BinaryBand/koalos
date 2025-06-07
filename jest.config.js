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
};

export default jestConfig;

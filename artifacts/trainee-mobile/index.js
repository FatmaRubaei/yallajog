/**
 * React Native CLI entry point.
 *
 * Usage:
 *   1. Create a new RN project:   npx @react-native-community/cli init TraineeApp --template react-native-template-typescript
 *   2. Copy the src/ directory into the new project root.
 *   3. Replace the generated index.js with this file.
 *   4. Install dependencies (see src/App.tsx for the full list).
 *   5. Run:  npx react-native run-ios  or  npx react-native run-android
 */
import { AppRegistry } from "react-native";
import App from "./src/App";

AppRegistry.registerComponent("TraineeApp", () => App);

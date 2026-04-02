/**
 * Root App component for bare React Native CLI.
 *
 * Entry point wiring (index.js):
 *   import { AppRegistry } from 'react-native';
 *   import App from './src/App';
 *   AppRegistry.registerComponent('TraineeApp', () => App);
 *
 * API base URL:
 *   Replace BASE_URL below with your local API server address.
 *   In production, read from a config/environment file.
 */
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { setBaseUrl } from "@workspace/api-client-react";

import { TraineeProvider } from "./context/TraineeContext";
import AppNavigator from "./navigation/AppNavigator";

// Set your API server URL here.
// During local development: 'http://192.168.x.x:8080' (your machine's LAN IP)
// In production: your deployed API domain
const BASE_URL = "http://localhost:8080";
setBaseUrl(BASE_URL);

const queryClient = new QueryClient();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <TraineeProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </TraineeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

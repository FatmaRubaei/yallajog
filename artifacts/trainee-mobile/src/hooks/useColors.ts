import { useColorScheme } from "react-native";
import colors from "../constants/colors";

export function useColors() {
  const colorScheme = useColorScheme();
  return colorScheme === "dark" ? colors.dark : colors.light;
}

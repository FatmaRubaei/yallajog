import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

interface TraineeContextValue {
  traineeId: number | null;
  setTraineeId: (id: number | null) => void;
  isLoading: boolean;
}

const TraineeContext = createContext<TraineeContextValue>({
  traineeId: null,
  setTraineeId: () => {},
  isLoading: true,
});

export function TraineeProvider({ children }: { children: React.ReactNode }) {
  const [traineeId, setTraineeIdState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("traineeId").then((val) => {
      if (val) setTraineeIdState(Number(val));
      setIsLoading(false);
    });
  }, []);

  function setTraineeId(id: number | null) {
    setTraineeIdState(id);
    if (id === null) {
      AsyncStorage.removeItem("traineeId");
    } else {
      AsyncStorage.setItem("traineeId", String(id));
    }
  }

  return (
    <TraineeContext.Provider value={{ traineeId, setTraineeId, isLoading }}>
      {children}
    </TraineeContext.Provider>
  );
}

export function useTrainee() {
  return useContext(TraineeContext);
}

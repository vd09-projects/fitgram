import React, { createContext, useContext, useState } from 'react';
import { useTourStore } from '../../stores/useTourStore';

export type PositionType = 'above' | 'below';

export type Step = {
  id: string;
  nextStepId?: string | null;
  ref: React.RefObject<any>;
  title: string;
  description: string;
  positionType?: PositionType;
  screen?: string;
};

type TourGuideContextType = {
  registerStep: (step: Step) => void;
  startTour: (firstStepId: string, tourId?: string, force?: boolean) => void;
  nextStep: () => void;
  skipTour: () => void;
  clearStep: () => void;
  triggerMeasureRefresh: () => void;
  currentStepId: string | null;
  isTourActive: boolean;
  refreshKey: number;
  steps: Record<string, Step>;
};

const TourGuideContext = createContext<TourGuideContextType>({} as any);
export const useTour = () => useContext(TourGuideContext);

export function useSafeTour() {
  const context = useContext(TourGuideContext);

  if (!context || Object.keys(context).length === 0) {
    // Return a safe fallback implementation
    return {
      registerStep: () => {},
      startTour: () => {},
      nextStep: () => {},
      skipTour: () => {},
      clearStep: () => {},
      triggerMeasureRefresh: () => {},
      currentStepId: null,
      isTourActive: false,
      refreshKey: 0,
      steps: {},
    };
  }

  return context;
}

export const TourGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState<Record<string, Step>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    isTourActive,
    currentStepId,
    currentTourId,
    setIsTourActive,
    setCurrentStepId,
    setCurrentTourId,
    hasSeenTour,
    markTourSeen,
    resetTourSeen,
    reset,
  } = useTourStore();

  const registerStep = (step: Step) => {
    setSteps((prev) => ({ ...prev, [step.id]: step }));
  };

   const clearStepsForStart = () => {
    const filteredSteps = Object.fromEntries(
      Object.entries(steps).filter(([_, step]) => step.screen === "Header")
    );
    setSteps(filteredSteps);
  };

  const startTour = (
    firstStepId: string,
    tourId: string = 'default-tour',
    force: boolean = false
  ) => {
    if (hasSeenTour(tourId)) {
      if (!force) return;
      resetTourSeen(tourId);
    }

    clearStepsForStart();
    setIsTourActive(true);
    setCurrentStepId(firstStepId);
    setCurrentTourId(tourId); // 🔐 Set tour id
  };

  const nextStep = () => {
    if (!currentStepId) return;
    const nextId = steps[currentStepId]?.nextStepId;
    if (nextId && steps[nextId]) {
      setCurrentStepId(nextId);
    } else {
      endTour();
    }
  };

  const endTour = () => {
    setIsTourActive(false);
    setCurrentStepId(null);

    if (currentTourId) {
      markTourSeen(currentTourId);
      setCurrentTourId(null);
    }
  };

  const skipTour = () => {
    setIsTourActive(false);
    setCurrentStepId(null);
    setCurrentTourId(null);
  };

  const clearStep = () => {
    reset();
    setSteps({});
  };

  const triggerMeasureRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <TourGuideContext.Provider
      value={{
        registerStep,
        startTour,
        nextStep,
        skipTour,
        clearStep,
        triggerMeasureRefresh,
        currentStepId,
        isTourActive,
        refreshKey,
        steps,
      }}
    >
      {children}
    </TourGuideContext.Provider>
  );
};
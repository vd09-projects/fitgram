import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useTourStore } from '../../stores/useTourStore';
import { RETAIN_SCREENS_TOUR_STEPS } from '../../constants/tourSteps';

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
  buttonPressed: () => void;
  currentStepId: string | null;
  isTourActive: boolean;
  refreshKey: number;
  steps: Record<string, Step>;
};

const TourGuideContext = createContext<TourGuideContextType>({} as any);
export const useTour = () => useContext(TourGuideContext);

export const TourGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState<Record<string, Step>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // ✅ NEW: Ref to hold the latest steps
  const stepsRef = useRef<Record<string, Step>>({});
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

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
    stepsRef.current[step.id] = step;
    setSteps({ ...stepsRef.current });
  };

  const clearStepsForStart = () => {
    const filteredSteps = Object.fromEntries(
      Object.entries(stepsRef.current).filter(([_, step]) =>
        RETAIN_SCREENS_TOUR_STEPS.includes(step.screen)
      )
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
    setCurrentTourId(tourId);
  };

  const nextStep = () => {
    if (!currentStepId) return;

    // ✅ Use the ref to always get latest steps
    const nextId = stepsRef.current[currentStepId]?.nextStepId;
    if (nextId) {
      setCurrentStepId(nextId);

      // if (!!stepsRef.current[nextId]) {
      //   setCurrentStepId(nextId);
      //   // setCurrentStepNotPresent(true)
      // }
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
    endTour();
  };

  const clearStep = () => {
    reset();
    setSteps({});
  };

  const triggerMeasureRefresh = () => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      setRefreshKey((k) => k + 1);
    }, 300); // 200ms debounce window; adjust as needed
  };

  const buttonPressed = () => {
    if (!isTourActive) {
      return;
    }
    setTimeout(() => {
      nextStep()
    }, 0);
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
        buttonPressed,
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
import React, { createContext, useContext, useState } from 'react';

export type PositionType = 'above' | 'below';

type Step = {
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
  startTour: (firstStepId: string) => void;
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

export const TourGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState<Record<string, Step>>({});
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const registerStep = (step: Step) => {
    setSteps(prev => ({ ...prev, [step.id]: step }));
  };

  const clearStepsForStart = () => {
    const filteredSteps = Object.fromEntries(
      Object.entries(steps).filter(([_, step]) => step.screen === "Header")
    );
    setSteps(filteredSteps);
  };

  const startTour = (firstStepId: string) => {
    clearStepsForStart();
    setIsTourActive(true);
    setCurrentStepId(firstStepId);
  };

  const nextStep = () => {
    if (!currentStepId) return;
    const nextId = steps[currentStepId]?.nextStepId;
    if (nextId && steps[nextId]) {
      setCurrentStepId(nextId);
    } else {
      setIsTourActive(false);
      setCurrentStepId(null);
    }
  };

  const skipTour = () => {
    setIsTourActive(false);
    setCurrentStepId(null);
  };

  const clearStep = () => {
    setIsTourActive(false);
    setCurrentStepId(null);
    setSteps({});
  };

  const triggerMeasureRefresh = () => {
    // console.log('Triggering measure refresh');
    setRefreshKey((k) => k + 1);
  };

  return (
    <TourGuideContext.Provider
      value={{ registerStep, startTour, nextStep, skipTour, clearStep, triggerMeasureRefresh, refreshKey, currentStepId, isTourActive, steps }}
    >
      {children}
    </TourGuideContext.Provider>
  );
};
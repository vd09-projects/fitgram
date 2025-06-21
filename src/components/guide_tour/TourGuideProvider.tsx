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
  currentStepId: string | null;
  isTourActive: boolean;
  steps: Record<string, Step>;
};

const TourGuideContext = createContext<TourGuideContextType>({} as any);

export const useTour = () => useContext(TourGuideContext);

export const TourGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState<Record<string, Step>>({});
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [isTourActive, setIsTourActive] = useState(false);

  const registerStep = (step: Step) => {
    setSteps(prev => ({ ...prev, [step.id]: step }));
  };

  const clearStepsForStart = () => {
    const filteredSteps = Object.fromEntries(
      Object.entries(steps).filter(([_, step]) => step.screen === "HomeScreen")
    );
    console.log('Filtered steps for HomeScreen:', filteredSteps);
    setSteps(filteredSteps);
  };

  const startTour = (firstStepId: string) => {
    clearStepsForStart();
    console.log('Starting tour with first step:', firstStepId, "steps:", steps);
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

  return (
    <TourGuideContext.Provider
      value={{ registerStep, startTour, nextStep, skipTour, clearStep, currentStepId, isTourActive, steps }}
    >
      {children}
    </TourGuideContext.Provider>
  );
};
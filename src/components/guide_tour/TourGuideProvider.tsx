import React, { createContext, useContext, useState } from 'react';

export type PositionType = 'above' | 'below';

type Step = {
  order: number;
  ref: React.RefObject<any>;
  title: string;
  description: string;
  positionType?: PositionType;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }; // ✅ Add this
};

type TourGuideContextType = {
  registerStep: (step: Step) => void;
  startTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  clearStep: () => void;
  currentStep: number;
  isTourActive: boolean;
  steps: Step[];
};

const TourGuideContext = createContext<TourGuideContextType>({} as any);

export const useTour = () => useContext(TourGuideContext);

export const TourGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);

  const registerStep = (step: Step) => {
    console.log('Registering step:', step);
    setSteps((prev) => {
      const filtered = prev.filter((s) => s.order !== step.order);
      return [...filtered, step].sort((a, b) => a.order - b.order);
    });
  };

  const startTour = () => {
    setIsTourActive(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep + 1 < steps.length) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsTourActive(false);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const clearStep = () => {
    setSteps([]);
    setIsTourActive(false);
  };

  return (
    <TourGuideContext.Provider
      value={{ registerStep, startTour, nextStep, previousStep, clearStep, currentStep, isTourActive, steps }}
    >
      {children}
    </TourGuideContext.Provider>
  );
};
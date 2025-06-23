// components/guide_tour/MaybeTourStep.tsx
import React from 'react';
import { MultiTourSteps } from './MultiTourSteps';
import { TOUR_STEPS as TS1 } from '../../constants/tourSteps';
import { PositionType } from './TourGuideProvider';
import { TOUR_STEPS } from '../../tour_steps';

type Props = {
  stepId?: string | string[];
  positionType?: PositionType;
  children: React.ReactNode;
};

export const MaybeTourStep: React.FC<Props> = ({
  stepId,
  positionType = 'below',
  children,
}) => {
  if (!stepId) return <>{children}</>;

  // Always treat stepId as an array
  const stepIds = Array.isArray(stepId) ? stepId : [stepId];

  const validSteps = stepIds
    .map((id) => TOUR_STEPS[id] || TS1[id])
    .filter((step) => !!step)
    .map((step) => ({
      ...step,
      positionType: positionType,
    }));

  return validSteps.length > 0 ? (
    <MultiTourSteps steps={validSteps}>
      {children}
    </MultiTourSteps>
  ) : (
    <>{children}</>
  );
};
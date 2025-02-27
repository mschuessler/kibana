/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem, EuiIcon, useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import React, { useCallback, useMemo } from 'react';
import { useStepContext } from '../context/step_context';
import { WATCH_VIDEO_BUTTON_TITLE } from '../translations';
import { OverviewSteps, QuickStartSectionCardsId, SectionId } from '../types';

const VideoComponent: React.FC = () => {
  const { toggleTaskCompleteStatus, finishedSteps } = useStepContext();
  const ref = React.useRef<HTMLIFrameElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(false);
  const { euiTheme } = useEuiTheme();
  const cardId = QuickStartSectionCardsId.watchTheOverviewVideo;
  const isFinishedStep = useMemo(
    () => finishedSteps[cardId]?.has(OverviewSteps.getToKnowElasticSecurity),
    [finishedSteps, cardId]
  );

  const onVideoClicked = useCallback(() => {
    toggleTaskCompleteStatus({
      stepId: OverviewSteps.getToKnowElasticSecurity,
      cardId: QuickStartSectionCardsId.watchTheOverviewVideo,
      sectionId: SectionId.quickStart,
      undo: false,
    });
    setIsVideoPlaying(true);
  }, [toggleTaskCompleteStatus]);

  return (
    <div
      css={css`
        height: 100%;
        width: 100%;
        position: relative;
      `}
    >
      {!isVideoPlaying && !isFinishedStep && (
        <EuiFlexGroup
          css={css`
            background-color: ${euiTheme.colors.fullShade};
            height: 100%;
            width: 100%;
            position: absolute;
            z-index: 1;
            cursor: pointer;
          `}
          gutterSize="none"
          justifyContent="center"
          alignItems="center"
          onClick={onVideoClicked}
        >
          <EuiFlexItem grow={false}>
            <EuiIcon type="playFilled" size="xxl" color={euiTheme.colors.emptyShade} />
          </EuiFlexItem>
        </EuiFlexGroup>
      )}
      {(isVideoPlaying || isFinishedStep) && (
        <iframe
          ref={ref}
          allowFullScreen
          className="vidyard_iframe"
          frameBorder="0"
          height="100%"
          width="100%"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
          scrolling="no"
          allow={isVideoPlaying ? 'autoplay;' : undefined}
          src={`//play.vidyard.com/K6kKDBbP9SpXife9s2tHNP.html${
            isVideoPlaying ? '?autoplay=1' : ''
          }`}
          title={WATCH_VIDEO_BUTTON_TITLE}
        />
      )}
    </div>
  );
};

export const Video = React.memo(VideoComponent);

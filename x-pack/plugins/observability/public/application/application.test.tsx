/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createMemoryHistory } from 'history';
import { noop } from 'lodash';
import React from 'react';
import { Observable } from 'rxjs';
import { AppMountParameters, CoreStart } from '@kbn/core/public';
import { themeServiceMock } from '@kbn/core/public/mocks';
import { KibanaPageTemplate } from '@kbn/shared-ux-page-kibana-template';
import { ConfigSchema, ObservabilityPublicPluginsStart } from '../plugin';
import { createObservabilityRuleTypeRegistryMock } from '../rules/observability_rule_type_registry_mock';
import { renderApp } from '.';
import { mockObservabilityAIAssistantService } from '@kbn/observability-ai-assistant-plugin/public';

describe('renderApp', () => {
  const originalConsole = global.console;

  beforeAll(() => {
    // mocks console to avoid polluting the test output
    global.console = { error: jest.fn() } as unknown as typeof console;
  });

  afterAll(() => {
    global.console = originalConsole;
  });

  const mockSearchSessionClear = jest.fn();

  const plugins = {
    data: {
      query: {
        timefilter: {
          timefilter: {
            setTime: jest.fn(),
            getTime: jest.fn().mockReturnValue({}),
            getTimeDefaults: jest.fn().mockReturnValue({}),
            getRefreshInterval: jest.fn().mockReturnValue({}),
            getRefreshIntervalDefaults: jest.fn().mockReturnValue({}),
          },
        },
      },
      search: {
        session: {
          clear: mockSearchSessionClear,
        },
      },
    },
    usageCollection: { reportUiCounter: noop },
    observabilityAIAssistant: { service: mockObservabilityAIAssistantService },
  } as unknown as ObservabilityPublicPluginsStart;

  const core = {
    application: { currentAppId$: new Observable(), navigateToUrl: noop },
    chrome: {
      docTitle: { change: noop },
      setBreadcrumbs: noop,
      setHelpExtension: noop,
    },
    i18n: { Context: ({ children }: { children: React.ReactNode }) => children },
    uiSettings: { get: () => false },
    http: { basePath: { prepend: (path: string) => path } },
    theme: themeServiceMock.createStartContract(),
  } as unknown as CoreStart;

  const params = {
    element: window.document.createElement('div'),
    history: createMemoryHistory(),
    setHeaderActionMenu: noop,
    theme$: themeServiceMock.createTheme$(),
  } as unknown as AppMountParameters;

  const config = {
    unsafe: {
      alertDetails: {
        logs: { enabled: false },
        metrics: { enabled: false },
        uptime: { enabled: false },
      },
    },
  } as ConfigSchema;

  it('renders', async () => {
    expect(() => {
      const unmount = renderApp({
        core,
        config,
        plugins,
        appMountParameters: params,
        observabilityRuleTypeRegistry: createObservabilityRuleTypeRegistryMock(),
        ObservabilityPageTemplate: KibanaPageTemplate,
        usageCollection: {
          components: {
            ApplicationUsageTrackingProvider: (props) => null,
          },
          reportUiCounter: jest.fn(),
        },
        kibanaVersion: '8.8.0',
      });
      unmount();
    }).not.toThrowError();
  });

  it('should clear search sessions when unmounting', () => {
    const unmount = renderApp({
      core,
      config,
      plugins,
      appMountParameters: params,
      observabilityRuleTypeRegistry: createObservabilityRuleTypeRegistryMock(),
      ObservabilityPageTemplate: KibanaPageTemplate,
      usageCollection: {
        components: {
          ApplicationUsageTrackingProvider: (props) => null,
        },
        reportUiCounter: jest.fn(),
      },
      kibanaVersion: '8.8.0',
    });
    unmount();

    expect(mockSearchSessionClear).toBeCalled();
  });
});

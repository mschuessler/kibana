/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { StartServicesAccessor, Logger } from '@kbn/core/server';
import type { IRuleDataClient, RuleDataPluginService } from '@kbn/rule-registry-plugin/server';

import type { SecuritySolutionPluginRouter } from '../types';

import { registerFleetIntegrationsRoutes } from '../lib/detection_engine/fleet_integrations';
import { registerPrebuiltRulesRoutes } from '../lib/detection_engine/prebuilt_rules';
// eslint-disable-next-line no-restricted-imports
import { registerLegacyRuleActionsRoutes } from '../lib/detection_engine/rule_actions_legacy';
import { registerRuleExceptionsRoutes } from '../lib/detection_engine/rule_exceptions';
import { registerRuleManagementRoutes } from '../lib/detection_engine/rule_management';
import { registerRuleMonitoringRoutes } from '../lib/detection_engine/rule_monitoring';
import { registerRulePreviewRoutes } from '../lib/detection_engine/rule_preview';

import { createIndexRoute } from '../lib/detection_engine/routes/index/create_index_route';
import { readIndexRoute } from '../lib/detection_engine/routes/index/read_index_route';
import { createSignalsMigrationRoute } from '../lib/detection_engine/routes/signals/create_signals_migration_route';
import { deleteSignalsMigrationRoute } from '../lib/detection_engine/routes/signals/delete_signals_migration_route';
import { finalizeSignalsMigrationRoute } from '../lib/detection_engine/routes/signals/finalize_signals_migration_route';
import { getSignalsMigrationStatusRoute } from '../lib/detection_engine/routes/signals/get_signals_migration_status_route';
import { querySignalsRoute } from '../lib/detection_engine/routes/signals/query_signals_route';
import { setSignalsStatusRoute } from '../lib/detection_engine/routes/signals/open_close_signals_route';
import { deleteIndexRoute } from '../lib/detection_engine/routes/index/delete_index_route';
import { readPrivilegesRoute } from '../lib/detection_engine/routes/privileges/read_privileges_route';

import type { SetupPlugins, StartPlugins } from '../plugin';
import type { ConfigType } from '../config';
import type { ITelemetryEventsSender } from '../lib/telemetry/sender';
import type {
  CreateRuleOptions,
  CreateSecurityRuleTypeWrapperProps,
} from '../lib/detection_engine/rule_types/types';
import type { ITelemetryReceiver } from '../lib/telemetry/receiver';
import { telemetryDetectionRulesPreviewRoute } from '../lib/detection_engine/routes/telemetry/telemetry_detection_rules_preview_route';
import { readAlertsIndexExistsRoute } from '../lib/detection_engine/routes/index/read_alerts_index_exists_route';
import { registerResolverRoutes } from '../endpoint/routes/resolver';
import {
  createEsIndexRoute,
  createPrebuiltSavedObjectsRoute,
  createStoredScriptRoute,
  deleteEsIndicesRoute,
  deletePrebuiltSavedObjectsRoute,
  deleteStoredScriptRoute,
  getRiskScoreIndexStatusRoute,
  installRiskScoresRoute,
  readPrebuiltDevToolContentRoute,
} from '../lib/risk_score/routes';
import { registerManageExceptionsRoutes } from '../lib/exceptions/api/register_routes';
import { registerDashboardsRoutes } from '../lib/dashboards/routes';
import { registerTagsRoutes } from '../lib/tags/routes';
import { setAlertTagsRoute } from '../lib/detection_engine/routes/signals/set_alert_tags_route';
import { setAlertAssigneesRoute } from '../lib/detection_engine/routes/signals/set_alert_assignees_route';
import { suggestUserProfilesRoute } from '../lib/detection_engine/routes/users/suggest_user_profiles_route';
import {
  riskEngineDisableRoute,
  riskEngineInitRoute,
  riskEngineEnableRoute,
  riskEngineStatusRoute,
  riskEnginePrivilegesRoute,
} from '../lib/entity_analytics/risk_engine/routes';
import { registerTimelineRoutes } from '../lib/timeline/routes';
import { riskScoreCalculationRoute } from '../lib/entity_analytics/risk_score/routes/calculation';
import { riskScorePreviewRoute } from '../lib/entity_analytics/risk_score/routes/preview';
import {
  assetCriticalityStatusRoute,
  assetCriticalityUpsertRoute,
  assetCriticalityGetRoute,
  assetCriticalityDeleteRoute,
} from '../lib/entity_analytics/asset_criticality/routes';

export const initRoutes = (
  router: SecuritySolutionPluginRouter,
  config: ConfigType,
  hasEncryptionKey: boolean,
  security: SetupPlugins['security'],
  telemetrySender: ITelemetryEventsSender,
  ml: SetupPlugins['ml'],
  ruleDataService: RuleDataPluginService,
  logger: Logger,
  ruleDataClient: IRuleDataClient | null,
  ruleOptions: CreateRuleOptions,
  getStartServices: StartServicesAccessor<StartPlugins>,
  securityRuleTypeOptions: CreateSecurityRuleTypeWrapperProps,
  previewRuleDataClient: IRuleDataClient,
  previewTelemetryReceiver: ITelemetryReceiver
) => {
  registerFleetIntegrationsRoutes(router, logger);
  registerLegacyRuleActionsRoutes(router, logger);
  registerPrebuiltRulesRoutes(router, security);
  registerRuleExceptionsRoutes(router);
  registerManageExceptionsRoutes(router);
  registerRuleManagementRoutes(router, config, ml, logger);
  registerRuleMonitoringRoutes(router);
  registerRulePreviewRoutes(
    router,
    config,
    ml,
    security,
    ruleOptions,
    securityRuleTypeOptions,
    previewRuleDataClient,
    getStartServices,
    logger
  );

  registerResolverRoutes(router, getStartServices, config);

  registerTimelineRoutes(router, config, security);

  // Detection Engine Signals routes that have the REST endpoints of /api/detection_engine/signals
  // POST /api/detection_engine/signals/status
  // Example usage can be found in security_solution/server/lib/detection_engine/scripts/signals
  setSignalsStatusRoute(router, logger, telemetrySender, getStartServices);
  setAlertTagsRoute(router);
  setAlertAssigneesRoute(router);
  querySignalsRoute(router, ruleDataClient);
  getSignalsMigrationStatusRoute(router);
  createSignalsMigrationRoute(router, security);
  finalizeSignalsMigrationRoute(router, ruleDataService, security);
  deleteSignalsMigrationRoute(router, security);
  suggestUserProfilesRoute(router, getStartServices);

  // Detection Engine index routes that have the REST endpoints of /api/detection_engine/index
  // All REST index creation, policy management for spaces
  createIndexRoute(router);
  readIndexRoute(router, ruleDataService);
  readAlertsIndexExistsRoute(router);
  deleteIndexRoute(router);

  // Privileges API to get the generic user privileges
  readPrivilegesRoute(router, hasEncryptionKey);

  // risky score module
  createEsIndexRoute(router, logger);
  deleteEsIndicesRoute(router);
  createStoredScriptRoute(router, logger);
  deleteStoredScriptRoute(router);
  readPrebuiltDevToolContentRoute(router);
  createPrebuiltSavedObjectsRoute(router, logger, security);
  deletePrebuiltSavedObjectsRoute(router, security);
  getRiskScoreIndexStatusRoute(router);
  installRiskScoresRoute(router, logger, security);

  // Dashboards
  registerDashboardsRoutes(router, logger, security);
  registerTagsRoutes(router, logger, security);
  const { previewTelemetryUrlEnabled } = config.experimentalFeatures;
  if (previewTelemetryUrlEnabled) {
    // telemetry preview endpoint for e2e integration tests only at the moment.
    telemetryDetectionRulesPreviewRoute(router, logger, previewTelemetryReceiver, telemetrySender);
  }

  if (config.experimentalFeatures.riskScoringRoutesEnabled) {
    riskScorePreviewRoute(router, logger);
    riskScoreCalculationRoute(router, logger);
    riskEngineStatusRoute(router);
    riskEngineInitRoute(router, getStartServices);
    riskEngineEnableRoute(router, getStartServices);
    riskEngineDisableRoute(router, getStartServices);
    if (config.experimentalFeatures.riskEnginePrivilegesRouteEnabled) {
      riskEnginePrivilegesRoute(router, getStartServices);
    }
  }
  if (config.experimentalFeatures.entityAnalyticsAssetCriticalityEnabled) {
    assetCriticalityStatusRoute(router, logger);
    assetCriticalityUpsertRoute(router, logger);
    assetCriticalityGetRoute(router, logger);
    assetCriticalityDeleteRoute(router, logger);
  }
};

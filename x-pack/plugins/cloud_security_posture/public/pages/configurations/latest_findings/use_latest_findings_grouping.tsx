/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { getGroupingQuery } from '@kbn/securitysolution-grouping';
import {
  GroupingAggregation,
  GroupPanelRenderer,
  GroupStatsRenderer,
  isNoneGroup,
  NamedAggregation,
  parseGroupingQuery,
} from '@kbn/securitysolution-grouping/src';
import { useMemo } from 'react';
import { DataView } from '@kbn/data-views-plugin/common';
import { Evaluation } from '../../../../common/types';
import { LATEST_FINDINGS_RETENTION_POLICY } from '../../../../common/constants';
import {
  FindingsGroupingAggregation,
  FindingsRootGroupingAggregation,
  useGroupedFindings,
} from './use_grouped_findings';
import {
  FINDINGS_UNIT,
  groupingTitle,
  defaultGroupingOptions,
  getDefaultQuery,
  GROUPING_OPTIONS,
} from './constants';
import { useCloudSecurityGrouping } from '../../../components/cloud_security_grouping';
import { getFilters } from '../utils/get_filters';

const getTermAggregation = (key: keyof FindingsGroupingAggregation, field: string) => ({
  [key]: {
    terms: { field, size: 1 },
  },
});

const getAggregationsByGroupField = (field: string): NamedAggregation[] => {
  if (isNoneGroup([field])) {
    return [];
  }
  const aggMetrics: NamedAggregation[] = [
    {
      groupByField: {
        cardinality: {
          field,
        },
      },
      failedFindings: {
        filter: {
          term: {
            'result.evaluation': { value: 'failed' },
          },
        },
      },
      passedFindings: {
        filter: {
          term: {
            'result.evaluation': { value: 'passed' },
          },
        },
      },
      complianceScore: {
        bucket_script: {
          buckets_path: {
            passed: 'passedFindings>_count',
            failed: 'failedFindings>_count',
          },
          script: 'params.passed / (params.passed + params.failed)',
        },
      },
    },
  ];

  switch (field) {
    case GROUPING_OPTIONS.RESOURCE_NAME:
      return [
        ...aggMetrics,
        getTermAggregation('resourceName', 'resource.id'),
        getTermAggregation('resourceSubType', 'resource.sub_type'),
        getTermAggregation('resourceType', 'resource.type'),
      ];
    case GROUPING_OPTIONS.RULE_NAME:
      return [
        ...aggMetrics,
        getTermAggregation('benchmarkName', 'rule.benchmark.name'),
        getTermAggregation('benchmarkVersion', 'rule.benchmark.version'),
      ];
    case GROUPING_OPTIONS.CLOUD_ACCOUNT_NAME:
      return [
        ...aggMetrics,
        getTermAggregation('benchmarkName', 'rule.benchmark.name'),
        getTermAggregation('benchmarkId', 'rule.benchmark.id'),
      ];
    case GROUPING_OPTIONS.ORCHESTRATOR_CLUSTER_NAME:
      return [
        ...aggMetrics,
        getTermAggregation('benchmarkName', 'rule.benchmark.name'),
        getTermAggregation('benchmarkId', 'rule.benchmark.id'),
      ];
  }
  return aggMetrics;
};

/**
 * Type Guard for checking if the given source is a FindingsRootGroupingAggregation
 */
export const isFindingsRootGroupingAggregation = (
  groupData: Record<string, any> | undefined
): groupData is FindingsRootGroupingAggregation => {
  return (
    groupData?.passedFindings?.doc_count !== undefined &&
    groupData?.failedFindings?.doc_count !== undefined
  );
};

/**
 * Utility hook to get the latest findings grouping data
 * for the findings page
 */
export const useLatestFindingsGrouping = ({
  dataView,
  groupPanelRenderer,
  groupStatsRenderer,
}: {
  dataView: DataView;
  groupPanelRenderer?: GroupPanelRenderer<FindingsGroupingAggregation>;
  groupStatsRenderer?: GroupStatsRenderer<FindingsGroupingAggregation>;
}) => {
  const {
    activePageIndex,
    grouping,
    pageSize,
    query,
    selectedGroup,
    onChangeGroupsItemsPerPage,
    onChangeGroupsPage,
    setUrlQuery,
    uniqueValue,
    isNoneSelected,
    onResetFilters,
    error,
    filters,
  } = useCloudSecurityGrouping({
    dataView,
    groupingTitle,
    defaultGroupingOptions,
    getDefaultQuery,
    unit: FINDINGS_UNIT,
    groupPanelRenderer,
    groupStatsRenderer,
  });

  const groupingQuery = getGroupingQuery({
    additionalFilters: query ? [query] : [],
    groupByField: selectedGroup,
    uniqueValue,
    from: `now-${LATEST_FINDINGS_RETENTION_POLICY}`,
    to: 'now',
    pageNumber: activePageIndex * pageSize,
    size: pageSize,
    sort: [{ groupByField: { order: 'desc' } }, { complianceScore: { order: 'asc' } }],
    statsAggregations: getAggregationsByGroupField(selectedGroup),
    rootAggregations: [
      {
        failedFindings: {
          filter: {
            term: {
              'result.evaluation': { value: 'failed' },
            },
          },
        },
        passedFindings: {
          filter: {
            term: {
              'result.evaluation': { value: 'passed' },
            },
          },
        },
      },
    ],
  });

  const { data, isFetching } = useGroupedFindings({
    query: groupingQuery,
    enabled: !isNoneSelected,
  });

  const groupData = useMemo(
    () =>
      parseGroupingQuery(
        selectedGroup,
        uniqueValue,
        data as GroupingAggregation<FindingsGroupingAggregation>
      ),
    [data, selectedGroup, uniqueValue]
  );

  const totalPassedFindings = isFindingsRootGroupingAggregation(groupData)
    ? groupData?.passedFindings?.doc_count || 0
    : 0;
  const totalFailedFindings = isFindingsRootGroupingAggregation(groupData)
    ? groupData?.failedFindings?.doc_count || 0
    : 0;

  const onDistributionBarClick = (evaluation: Evaluation) => {
    setUrlQuery({
      filters: getFilters({
        filters,
        dataView,
        field: 'result.evaluation',
        value: evaluation,
        negate: false,
      }),
    });
  };

  const isEmptyResults =
    !isFetching && isFindingsRootGroupingAggregation(groupData) && !groupData.unitsCount?.value;

  return {
    groupData,
    grouping,
    isFetching,
    activePageIndex,
    pageSize,
    selectedGroup,
    onChangeGroupsItemsPerPage,
    onChangeGroupsPage,
    setUrlQuery,
    isGroupSelected: !isNoneSelected,
    isGroupLoading: !data,
    onResetFilters,
    filters,
    error,
    onDistributionBarClick,
    totalPassedFindings,
    totalFailedFindings,
    isEmptyResults,
  };
};

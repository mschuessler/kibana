/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../../../../ftr_provider_context';

export default function ({ loadTestFile, getPageObject }: FtrProviderContext) {
  const svlCommonPage = getPageObject('svlCommonPage');

  describe('discover', function () {
    before(async function () {
      // TODO: Serverless tests require login first
      await svlCommonPage.login();
    });

    loadTestFile(require.resolve('./reporting'));
    loadTestFile(require.resolve('./visualize_field'));
  });
}

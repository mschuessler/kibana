/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { unzip } from 'zlib';
import { promisify } from 'util';
import expect from '@kbn/expect';
import { IndexedHostsAndAlertsResponse } from '@kbn/security-solution-plugin/common/endpoint/index_data';
import { EXCEPTION_LIST_ITEM_URL } from '@kbn/securitysolution-list-constants';
import { ArtifactElasticsearchProperties } from '@kbn/fleet-plugin/server/services';
import { FoundExceptionListItemSchema } from '@kbn/securitysolution-io-ts-list-types';
import { WebElementWrapper } from '../../../../../test/functional/services/lib/web_element_wrapper';
import { FtrProviderContext } from '../../ftr_provider_context';
import { targetTags } from '../../target_tags';

export default ({ getPageObjects, getService }: FtrProviderContext) => {
  const pageObjects = getPageObjects(['common', 'header']);
  const queryBar = getService('queryBar');
  const testSubjects = getService('testSubjects');
  const endpointTestResources = getService('endpointTestResources');
  const endpointArtifactTestResources = getService('endpointArtifactTestResources');
  const retry = getService('retry');
  const esClient = getService('es');
  const supertest = getService('supertest');
  const find = getService('find');
  const unzipPromisify = promisify(unzip);

  describe('Endpoint Exceptions', function () {
    targetTags(this, ['@ess', '@serverless']);

    this.timeout(10 * 60_000);

    const clearPrefilledEntries = async () => {
      const entriesContainer = await testSubjects.find('exceptionEntriesContainer');

      let deleteButtons: WebElementWrapper[];
      do {
        deleteButtons = await testSubjects.findAllDescendant(
          'builderItemEntryDeleteButton',
          entriesContainer
        );

        await deleteButtons[0].click();
      } while (deleteButtons.length > 1);
    };

    const openNewEndpointExceptionFlyout = async () => {
      await testSubjects.click('timeline-context-menu-button');
      await testSubjects.click('add-endpoint-exception-menu-item');
      await testSubjects.existOrFail('addExceptionFlyout');

      await retry.waitFor('entries should be loaded', () =>
        testSubjects.exists('exceptionItemEntryContainer')
      );
    };

    const setLastFieldsValue = async ({
      testSubj,
      value,
      optionSelector = `button[title="${value}"]`,
    }: {
      testSubj: string;
      value: string;
      optionSelector?: string;
    }) => {
      const fields = await find.allByCssSelector(`[data-test-subj="${testSubj}"]`);

      const lastField = fields[fields.length - 1];
      await lastField.click();

      const inputField = await lastField.findByTagName('input');
      await inputField.type(value);

      const dropdownOptionSelector = `[data-test-subj="comboBoxOptionsList ${testSubj}-optionsList"] ${optionSelector}`;
      await find.clickByCssSelector(dropdownOptionSelector);
    };

    const setLastEntry = async ({
      field,
      operator,
      value,
    }: {
      field: string;
      operator: 'matches' | 'is';
      value: string;
    }) => {
      await setLastFieldsValue({ testSubj: 'fieldAutocompleteComboBox', value: field });
      await setLastFieldsValue({ testSubj: 'operatorAutocompleteComboBox', value: operator });
      await setLastFieldsValue({
        testSubj: operator === 'matches' ? 'valuesAutocompleteWildcard' : 'valuesAutocompleteMatch',
        value,
        optionSelector: 'p',
      });
    };

    const checkArtifact = (expectedArtifact: object) => {
      return retry.tryForTime(120_000, async () => {
        const artifacts = await endpointArtifactTestResources.getArtifacts();

        const manifestArtifact = artifacts.find((artifact) =>
          artifact.artifactId.startsWith('endpoint-exceptionlist-macos-v1')
        );

        expect(manifestArtifact).to.not.be(undefined);

        // Get fleet artifact
        const artifactResult = await esClient.get({
          index: '.fleet-artifacts-7',
          id: `endpoint:${manifestArtifact!.artifactId}`,
        });

        const artifact = artifactResult._source as ArtifactElasticsearchProperties;

        const zippedBody = Buffer.from(artifact.body, 'base64');
        const artifactBody = await unzipPromisify(zippedBody);

        expect(JSON.parse(artifactBody.toString())).to.eql(expectedArtifact);
      });
    };

    let indexedData: IndexedHostsAndAlertsResponse;
    before(async () => {
      indexedData = await endpointTestResources.loadEndpointData();

      const waitForAlertsToAppear = async () => {
        await pageObjects.common.navigateToUrlWithBrowserHistory('security', `/alerts`);
        await pageObjects.header.waitUntilLoadingHasFinished();
        await retry.waitForWithTimeout('alerts to appear', 10 * 60_000, async () => {
          await queryBar.clickQuerySubmitButton();
          return testSubjects.exists('timeline-context-menu-button');
        });
      };

      await waitForAlertsToAppear();
    });

    after(async () => {
      await endpointTestResources.unloadEndpointData(indexedData);
    });

    beforeEach(async () => {
      const deleteEndpointExceptions = async () => {
        const { body } = await supertest
          .get(`${EXCEPTION_LIST_ITEM_URL}/_find?list_id=endpoint_list&namespace_type=agnostic`)
          .set('kbn-xsrf', 'true');

        for (const exceptionListItem of (body as FoundExceptionListItemSchema).data) {
          await supertest
            .delete(`${EXCEPTION_LIST_ITEM_URL}?id=${exceptionListItem.id}&namespace_type=agnostic`)
            .set('kbn-xsrf', 'true');
        }
      };

      await deleteEndpointExceptions();
    });

    it('should add `event.module=endpoint` to entry if only wildcard operator is present', async () => {
      await pageObjects.common.navigateToUrlWithBrowserHistory('security', `/alerts`);

      await openNewEndpointExceptionFlyout();
      await clearPrefilledEntries();

      await testSubjects.setValue('exceptionFlyoutNameInput', 'test exception');
      await setLastEntry({ field: 'file.path', operator: 'matches', value: '*/cheese/*' });
      await testSubjects.click('exceptionsAndButton');
      await setLastEntry({ field: 'process.executable', operator: 'matches', value: 'ex*' });

      await testSubjects.click('addExceptionConfirmButton');
      await pageObjects.common.closeToast();

      await checkArtifact({
        entries: [
          {
            type: 'simple',
            entries: [
              {
                field: 'file.path',
                operator: 'included',
                type: 'wildcard_cased',
                value: '*/cheese/*',
              },
              {
                field: 'process.executable',
                operator: 'included',
                type: 'wildcard_cased',
                value: 'ex*',
              },
              {
                // this additional entry should be added
                field: 'event.module',
                operator: 'included',
                type: 'exact_cased',
                value: 'endpoint',
              },
            ],
          },
        ],
      });
    });

    it('should NOT add `event.module=endpoint` to entry if there is another operator', async () => {
      await pageObjects.common.navigateToUrlWithBrowserHistory('security', `/alerts`);

      await openNewEndpointExceptionFlyout();
      await clearPrefilledEntries();

      await testSubjects.setValue('exceptionFlyoutNameInput', 'test exception');
      await setLastEntry({ field: 'file.path', operator: 'matches', value: '*/cheese/*' });
      await testSubjects.click('exceptionsAndButton');
      await setLastEntry({ field: 'process.executable', operator: 'is', value: 'something' });

      await testSubjects.click('addExceptionConfirmButton');
      await pageObjects.common.closeToast();

      await checkArtifact({
        entries: [
          {
            type: 'simple',
            entries: [
              {
                field: 'file.path',
                operator: 'included',
                type: 'wildcard_cased',
                value: '*/cheese/*',
              },
              {
                field: 'process.executable',
                operator: 'included',
                type: 'exact_cased',
                value: 'something',
              },
            ],
          },
        ],
      });
    });
  });
};

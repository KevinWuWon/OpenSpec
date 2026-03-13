import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  type SkillTemplate,
  getApplyChangeSkillTemplate,
  getArchiveChangeSkillTemplate,
  getBulkArchiveChangeSkillTemplate,
  getContinueChangeSkillTemplate,
  getExploreSkillTemplate,
  getFeedbackSkillTemplate,
  getFfChangeSkillTemplate,
  getNewChangeSkillTemplate,
  getOnboardSkillTemplate,
  getOpsxApplyCommandTemplate,
  getOpsxArchiveCommandTemplate,
  getOpsxBulkArchiveCommandTemplate,
  getOpsxContinueCommandTemplate,
  getOpsxExploreCommandTemplate,
  getOpsxFfCommandTemplate,
  getOpsxNewCommandTemplate,
  getOpsxOnboardCommandTemplate,
  getOpsxSyncCommandTemplate,
  getOpsxProposeCommandTemplate,
  getOpsxProposeSkillTemplate,
  getOpsxVerifyCommandTemplate,
  getSyncSpecsSkillTemplate,
  getVerifyChangeSkillTemplate,
} from '../../../src/core/templates/skill-templates.js';
import { generateSkillContent } from '../../../src/core/shared/skill-generation.js';

// To regenerate: run the test, copy "Received" hashes from the diff output.
const EXPECTED_FUNCTION_HASHES: Record<string, string> = {
  getExploreSkillTemplate: '00b5c69d33ad16d81997b8293810f1977ce5f395ed29550feddf07536c4a2121',
  getNewChangeSkillTemplate: '5989672758eccf54e3bb554ab97f2c129a192b12bbb7688cc1ffcf6bccb1ae9d',
  getContinueChangeSkillTemplate: '5a7e22a83b1f421b239052b56f14ae4a470b887acf9d04c9e4a376ebf6c76d72',
  getApplyChangeSkillTemplate: 'd7afaf236c3d253dd5fb86818999b19242c16c83ba969189f6880d6ac0ab9fa2',
  getFfChangeSkillTemplate: 'a7332fb14c8dc3f9dec71f5d332790b4a8488191e7db4ab6132ccbefecf9ded9',
  getSyncSpecsSkillTemplate: 'dc8e7204566e6c52fe574ad1f042e355b78209a14d34f30b6391455696269e16',
  getOnboardSkillTemplate: '0f83961571f0fcc7e592b63d34a3dbb5c48c4eef7022eea7a5b9280a4f7e6fcb',
  getOpsxExploreCommandTemplate: '2ee5c7092bea8318dee2d25f6b3754e1665515af598ad68cf9b925d76bf3c236',
  getOpsxNewCommandTemplate: '62eee32d6d81a376e7be845d0891e28e6262ad07482f9bfe6af12a9f0366c364',
  getOpsxContinueCommandTemplate: '19cb6f8a3a1c0341897bcd5574e53e23b57733509bb7ecd6cdbb5ff1a72a1e0d',
  getOpsxApplyCommandTemplate: 'd1c067a8745d7139a567b7371586e2810fe4773edf20884f57b3efa05ffa002f',
  getOpsxFfCommandTemplate: 'cdebe872cc8e0fcc25c8864b98ffd66a93484c0657db94bd1285b8113092702a',
  getArchiveChangeSkillTemplate: '0d60c4e0559003bb9f3c0a3ea5e158a0b72a7aa0ab246bc8352c276d58ddd569',
  getBulkArchiveChangeSkillTemplate: 'd5530d1267c790915719143a827c2dbf46077777091bed6b7c8cf67b8392125d',
  getOpsxSyncCommandTemplate: '036304b06c8c95dc1ef829496c02fb56df06454b683400be0444a6b79637db66',
  getVerifyChangeSkillTemplate: 'bbcc1036c33384dfffadbd4199ed510323f297ecf7f5b5970c01a1a3832b2534',
  getOpsxArchiveCommandTemplate: 'fda4221dc48eee4787a57b0b7e969b9e204faab11569dd6fc45161c1ffe1dbd5',
  getOpsxOnboardCommandTemplate: '5e973caf4a50be0f059c14a443d29f608892938b0f477e0799628b5e0e45def9',
  getOpsxBulkArchiveCommandTemplate: 'fb8e1d4bee37dfd9452524651005adf53a795ea8aab21aa08546a0cac8365649',
  getOpsxVerifyCommandTemplate: '8829f3d91215ae930ba5982e1dbdb831964756f002fec2797d8c2b3c073edb40',
  getOpsxProposeSkillTemplate: 'e151439fcc026749be9e777454f504c0563f9e471dead7bbaea75ad243e1347b',
  getOpsxProposeCommandTemplate: 'a9a2447af9f92468472ae16152c1949d6a27a54980ab7a21a3ca0874bd2e113b',
  getFeedbackSkillTemplate: 'd7d83c5f7fc2b92fe8f4588a5bf2d9cb315e4c73ec19bcd5ef28270906319a0d',
};

const EXPECTED_GENERATED_SKILL_CONTENT_HASHES: Record<string, string> = {
  'openspec-explore': '013c9bfe2b4560a94f7632915dd69b371b6d7e4080a45e0f2d24fb02898c7e42',
  'openspec-new-change': 'c324a7ace1f244aa3f534ac8e3370a2c11190d6d1b85a315f26a211398310f0f',
  'openspec-continue-change': '02f0738b837fd1359366a2b645aebcfde487bfb9a4f0c5fe1accdfdcbf719b0c',
  'openspec-apply-change': 'd1aa65589a0dd3004e58486f4167eabcf67733b6c0ac38d6cb0ef53c8ae1aa91',
  'openspec-ff-change': '672c3a5b8df152d959b15bd7ae2be7a75ab7b8eaa2ec1e0daa15c02479b27937',
  'openspec-sync-specs': '01f4f3fa213f6767a94554a5bd8af4940f8fe4d04c40615edbd9b1dc71ce1df2',
  'openspec-archive-change': '7fa39bee0874b8694fa0f399c183b531aa93190d4c07119da535d7a3273e579c',
  'openspec-bulk-archive-change': '08033347df774d25786f71f1390f44dad5d1b5ce8ea04080f42c883c155b1acb',
  'openspec-verify-change': '9e59db933a0f8aadae81419864e99d7e2afa081db9fd1e1d0a219df8ddf10667',
  'openspec-onboard': '1050b5277face61d3c8969615b46ad92a49d6eb02ed2e4d9991c69b22dcf25b8',
  'openspec-propose': '72aed2730a47f54243edf0c71388fa69b21c9d3d192909b4ee5752ddf16d7fa8',
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('skill templates split parity', () => {
  it('preserves all template function payloads exactly', () => {
    const functionFactories: Record<string, () => unknown> = {
      getExploreSkillTemplate,
      getNewChangeSkillTemplate,
      getContinueChangeSkillTemplate,
      getApplyChangeSkillTemplate,
      getFfChangeSkillTemplate,
      getSyncSpecsSkillTemplate,
      getOnboardSkillTemplate,
      getOpsxExploreCommandTemplate,
      getOpsxNewCommandTemplate,
      getOpsxContinueCommandTemplate,
      getOpsxApplyCommandTemplate,
      getOpsxFfCommandTemplate,
      getArchiveChangeSkillTemplate,
      getBulkArchiveChangeSkillTemplate,
      getOpsxSyncCommandTemplate,
      getVerifyChangeSkillTemplate,
      getOpsxArchiveCommandTemplate,
      getOpsxOnboardCommandTemplate,
      getOpsxBulkArchiveCommandTemplate,
      getOpsxVerifyCommandTemplate,
      getOpsxProposeSkillTemplate,
      getOpsxProposeCommandTemplate,
      getFeedbackSkillTemplate,
    };

    const actualHashes = Object.fromEntries(
      Object.entries(functionFactories).map(([name, fn]) => [name, hash(stableStringify(fn()))])
    );

    expect(actualHashes).toEqual(EXPECTED_FUNCTION_HASHES);
  });

  it('preserves generated skill file content exactly', () => {
    // Intentionally excludes getFeedbackSkillTemplate: skillFactories only models templates
    // deployed via generateSkillContent, while feedback is covered in function payload parity.
    const skillFactories: Array<[string, () => SkillTemplate]> = [
      ['openspec-explore', getExploreSkillTemplate],
      ['openspec-new-change', getNewChangeSkillTemplate],
      ['openspec-continue-change', getContinueChangeSkillTemplate],
      ['openspec-apply-change', getApplyChangeSkillTemplate],
      ['openspec-ff-change', getFfChangeSkillTemplate],
      ['openspec-sync-specs', getSyncSpecsSkillTemplate],
      ['openspec-archive-change', getArchiveChangeSkillTemplate],
      ['openspec-bulk-archive-change', getBulkArchiveChangeSkillTemplate],
      ['openspec-verify-change', getVerifyChangeSkillTemplate],
      ['openspec-onboard', getOnboardSkillTemplate],
      ['openspec-propose', getOpsxProposeSkillTemplate],
    ];

    const actualHashes = Object.fromEntries(
      skillFactories.map(([dirName, createTemplate]) => [
        dirName,
        hash(generateSkillContent(createTemplate(), 'PARITY-BASELINE')),
      ])
    );

    expect(actualHashes).toEqual(EXPECTED_GENERATED_SKILL_CONTENT_HASHES);
  });
});

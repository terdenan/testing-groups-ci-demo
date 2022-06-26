import fetch from 'node-fetch';

const API_HOST = 'https://api.vk.com/method/';
const API_VERSION = '5.131';

const SERVICE_TOKEN = process.env.MINI_APPS_ACCESS_TOKEN;

const MIN_TESTING_GROUP_ID = 11;
const MAX_TESTING_GROUP_Id = 25;
const TESTING_GROUPS_COUNT = MAX_TESTING_GROUP_Id - MIN_TESTING_GROUP_ID + 1;

async function api(method, params = {}) {
  params['v'] = API_VERSION;
  params['access_token'] = SERVICE_TOKEN;

  const queryParams = Object.keys(params).map((k) => { return k + "=" + encodeURIComponent(params[k]) }).join('&');
  const query = await fetch(API_HOST + method + '?' + queryParams);
  const res = await query.json();
  
  return res.response;
}

function getTargetTestingGroupId(pullRequestNumber) {
  return MIN_TESTING_GROUP_ID + (pullRequestNumber - 1) % TESTING_GROUPS_COUNT;
}

function getTestingGroupName(pullRequestNumber, headCommitSha) {
  return `Pull Request #${pullRequestNumber}: ${headCommitSha.slice(0, 8)}`;
}

function extractWebviewUrl(rawOutput) {
  const [, webviewUrl] = rawOutput.split(/[\s\t]+/);
  return webviewUrl;
}

async function loadTestingGroup(groupId) {
  const testingGroups = await api('apps.getTestingGroups');
  const existingTestingGroup = testingGroups.find((group) => group.group_id === groupId);

  return existingTestingGroup || null;
}

export async function run({ context }) {
  const targerTestingGroupId = getTargetTestingGroupId(context.payload.number);
  
  let testingGroupMeta = await loadTestingGroup(targerTestingGroupId);
  if (testingGroupMeta === null) {
    testingGroupMeta = {
      'user_ids': [],
      'group_id': targerTestingGroupId,
      'platform': 0b11111,
    };
  }

  testingGroupMeta['webview'] = extractWebviewUrl(process.env.VK_MINIAPPS_DEPLOY_OUTPUT);
  testingGroupMeta['name'] = getTestingGroupName(context.payload.number, context.payload.pull_request.head.sha);

  console.log('Saving testing group info with following meta:');
  console.log(testingGroupMeta);

  await api('apps.updateMetaForTestingGroup', testingGroupMeta);
}

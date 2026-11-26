// โมดูลที่ 1: แยกตรรกะตัวตนระหว่าง "บอทพี่" กับ "บอทน้อง" (ใช้ข้อมูลร่วมได้ แต่แยกตรรกะการตัดสินใจ)
const BOT_PROFILES = {
  brother: {
    id: 'BOT_BROTHER_15001',
    name: 'บอทพี่',
    env: 'android_termux',
    canPushGit: true,
    canRunLiveVpsTest: false,
    responsibilities: ['verify_sha', 'enforce_rules', 'manage_snapshots', 'git_push']
  },
  nong: {
    id: 'BOT_NONG_DEBIAN_ROOT',
    name: 'บอทน้อง',
    env: 'debian_root_vps',
    canPushGit: false,
    canRunLiveVpsTest: true,
    responsibilities: ['run_port_tests', 'report_status', 'return_tested_files']
  }
};

function resolveBotProfile(role) {
  const key = String(role || '').toLowerCase();
  if (BOT_PROFILES[key]) return BOT_PROFILES[key];
  return process.geteuid && process.geteuid() === 0
    ? BOT_PROFILES.nong
    : BOT_PROFILES.brother;
}

function canBotPerform(role, action) {
  const profile = resolveBotProfile(role);
  if (action === 'git_push') return Boolean(profile.canPushGit);
  if (action === 'run_live_vps_test') return Boolean(profile.canRunLiveVpsTest);
  return profile.responsibilities.includes(action);
}

function buildBotLogicSummary(role, sharedState = {}) {
  const profile = resolveBotProfile(role);
  return {
    botId: profile.id,
    botName: profile.name,
    env: profile.env,
    canPushGit: profile.canPushGit,
    canRunLiveVpsTest: profile.canRunLiveVpsTest,
    sharedKeysCount: Array.isArray(sharedState.keys) ? sharedState.keys.length : 0,
    sharedPort: sharedState.port || null
  };
}

module.exports = {
  BOT_PROFILES,
  resolveBotProfile,
  canBotPerform,
  buildBotLogicSummary
};

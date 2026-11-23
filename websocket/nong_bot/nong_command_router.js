// โมดูลแยกคำสั่งเฉพาะของตัวบอทในเซสชันใหม่ (ไม่แตะพอร์ต 18080/18081 ไม่ลบ ไม่ Push)
const { createNongBotCore } = require('./nong_bot_core.js');

function createNongCommandRouter(options = {}) {
  const core = createNongBotCore(options);

  function dispatchCommand(rawCmd = '', payload = {}) {
    const cmd = String(rawCmd || '').trim().toLowerCase();
    core.logger.recordPulse('command_received', { cmd, payload });

    if (cmd === 'status' || cmd === 'ping') {
      return {
        ok: true,
        command: cmd,
        data: core.status(payload)
      };
    }

    if (cmd === 'enqueue' || cmd === 'add_task') {
      const title = payload.title || 'งานสั่งตรงถึงตัวบอท';
      const task = core.addTask(title, payload.meta || {});
      return {
        ok: true,
        command: cmd,
        task
      };
    }

    if (cmd === 'complete_task' || cmd === 'done') {
      if (!payload.taskId) {
        return { ok: false, command: cmd, error: 'missing taskId' };
      }
      const task = core.finishTask(payload.taskId, payload.note || 'completed via router');
      return {
        ok: Boolean(task),
        command: cmd,
        task
      };
    }

    if (cmd === 'pulses') {
      return {
        ok: true,
        command: cmd,
        pulses: core.logger.readRecent(payload.limit || 5)
      };
    }

    return {
      ok: false,
      command: cmd,
      error: 'unsupported_command',
      supported: ['status', 'ping', 'enqueue', 'add_task', 'complete_task', 'done', 'pulses']
    };
  }

  return { dispatchCommand, core };
}

module.exports = { createNongCommandRouter };

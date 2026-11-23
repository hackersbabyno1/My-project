// โมดูลรวมแกนกลางของตัวบอทน้องในเซสชันใหม่ (ไม่แตะพอร์ต 18080/18081 ไม่ลบ ไม่ Push)
const { NONG_CONFIG, validateNongTarget, buildNongReport } = require('./nong_runner_module.js');
const { createNongTaskQueue } = require('./nong_task_queue.js');
const { createNongPulseLogger } = require('./nong_pulse_logger.js');

function createNongBotCore(options = {}) {
  const botId = options.botId || NONG_CONFIG.botId;
  const queue = createNongTaskQueue(botId);
  const logger = createNongPulseLogger(options.logFile, botId);

  function addTask(title, meta = {}) {
    const task = queue.enqueue(title, meta);
    logger.recordPulse('task_enqueued', { taskId: task.id, title: task.title });
    return task;
  }

  function finishTask(taskId, note = 'completed') {
    const updated = queue.complete(taskId, note);
    if (updated) {
      logger.recordPulse('task_completed', { taskId: updated.id, note });
    }
    return updated;
  }

  function status(extra = {}) {
    return {
      botId,
      report: buildNongReport(extra),
      queue: queue.snapshot(),
      recentPulses: logger.readRecent(3)
    };
  }

  return { addTask, finishTask, status, queue, logger };
}

module.exports = { createNongBotCore };

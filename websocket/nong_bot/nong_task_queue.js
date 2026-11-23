// โมดูลคิวงานและบันทึกการทำงานของบอทน้อง (แยกอิสระในเซสชันบอท ไม่แตะพอร์ต 18080/18081)
function createNongTaskQueue(ownerBot = 'BOT_NONG_DEBIAN_ROOT') {
  const tasks = [];
  let seq = 0;

  function enqueue(title, meta = {}) {
    seq += 1;
    const item = {
      id: `NONG-TASK-${seq}`,
      ownerBot,
      title: String(title || '').trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      meta
    };
    tasks.push(item);
    return item;
  }

  function complete(taskId, resultNote = 'done') {
    const found = tasks.find(t => t.id === taskId);
    if (!found) return null;
    found.status = 'completed';
    found.completedAt = new Date().toISOString();
    found.resultNote = resultNote;
    return found;
  }

  function snapshot() {
    return {
      ownerBot,
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      tasks
    };
  }

  return { enqueue, complete, snapshot };
}

module.exports = { createNongTaskQueue };

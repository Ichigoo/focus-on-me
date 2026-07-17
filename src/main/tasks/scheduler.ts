import { settings } from '../db/repos'
import { tasksRepo } from '../db/tasks'
import { localDayString } from '../db/stats'
import { broadcast, showToast } from '../windows'

let timers: NodeJS.Timeout[] = []

function clearAll(): void {
  timers.forEach(clearTimeout)
  timers = []
}

function fireTask(id: number, day: string): void {
  const task = tasksRepo.listForDay(day).find((t) => t.id === id)
  if (!task || task.status !== 'pending') return
  showToast({ title: 'Task reminder', body: task.name, kind: 'task' })
  if (settings.getAll().soundTaskReminder) broadcast('sound:play', 'task-reminder')
}

/** Recomputes today's pending timed tasks from current data/settings and (re)arms notification timers. */
export function rescheduleTasks(): void {
  clearAll()
  const prefs = settings.getAll()
  const now = Date.now()
  const today = localDayString(Math.floor(now / 1000))

  if (prefs.taskRemindersEnabled) {
    for (const task of tasksRepo.listForDay(today)) {
      if (task.status !== 'pending' || !task.time_hhmm) continue
      const [h, m] = task.time_hhmm.split(':').map(Number)
      const at = new Date()
      at.setHours(h, m, 0, 0)
      const delay = at.getTime() - now
      if (delay <= 0) continue
      timers.push(setTimeout(() => fireTask(task.id, today), delay))
    }
  }

  // recompute for the next day shortly after local midnight; also nudges Home to roll over
  const midnight = new Date()
  midnight.setHours(24, 0, 5, 0)
  timers.push(
    setTimeout(() => {
      tasksRepo.resetRecurringSubtasks()
      broadcast('tasks:changed')
      rescheduleTasks()
    }, midnight.getTime() - now)
  )
}

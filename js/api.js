import { firebaseConfig } from './config.js';

// Инициализация подключения
if (!window.firebase.apps.length) { 
  window.firebase.initializeApp(firebaseConfig); 
}
const db = window.firebase.database();

/**
 * Получение расписания и количества игроков на указанный месяц
 * @param {string|number} monthIdx Индекс месяца
 */
export function fetchMonthData(monthIdx) {
  return db.ref('tennis_v3/' + monthIdx).once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      const schedule = data.schedule || {};
      // Нормализация формата: старый объект -> новый массив
      Object.keys(schedule).forEach(day => {
        if (!Array.isArray(schedule[day])) { 
          schedule[day] = [schedule[day]]; 
        }
      });
      return {
        schedule: schedule,
        players: data.players || 2
      };
    }
    return { schedule: {}, players: 2 };
  });
}

/**
 * Сохранение данных месяца в Firebase
 * @param {string|number} monthIdx Индекс месяца
 * @param {Object} schedule Расписание
 * @param {number} playerCount Количество игроков
 */
export function saveMonthData(monthIdx, schedule, playerCount) {
  return db.ref('tennis_v3/' + monthIdx).set({
    schedule: schedule,
    players: playerCount
  });
}
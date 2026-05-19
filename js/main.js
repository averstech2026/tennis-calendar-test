import { locationPrices } from './config.js';
import { fetchMonthData, saveMonthData } from './api.js';
import { renderCalendar, renderEditor, toggleBatchPreview, showSchedule, exportToPDF } from './ui.js';

// Единый стейт приложения
const state = {
  selectedDayNum: null,
  activeEntryIndex: -1, 
  schedule: {}, 
  lastUsedByWeekday: {}
};

// Функция развыбора активных ячеек / закрытия редактора
function deselect() {
  state.selectedDayNum = null; 
  state.activeEntryIndex = -1;
  document.getElementById('editorPanel').style.display = 'none';
  document.querySelectorAll('.date-cell').forEach(c => c.classList.remove('batch-preview'));
  renderCalendar(state, selectDay);
}

function selectDay(day) {
  state.selectedDayNum = day;
  const dayData = state.schedule[day] || [];
  state.activeEntryIndex = dayData.length > 0 ? 0 : -1;
  renderEditor(state, onTabSelect);
  renderCalendar(state, selectDay);
}

function onTabSelect(idx) {
  state.activeEntryIndex = idx;
  renderEditor(state, onTabSelect);
}

function loadData() {
  const monthIdx = document.getElementById('monthSelect').value;
  fetchMonthData(monthIdx).then((data) => {
    state.schedule = data.schedule;
    document.getElementById('playerCount').value = data.players;
    renderCalendar(state, selectDay);
  }).catch(() => renderCalendar(state, selectDay));
}

function saveDataToStorage() {
  const monthIdx = document.getElementById('monthSelect').value;
  const playerCount = document.getElementById('playerCount').value;
  saveMonthData(monthIdx, state.schedule, playerCount);
}

// Изменение числовых инпутов в степперах
function changeVal(id, step) {
  const el = document.getElementById(id); 
  let val = parseFloat(el.value) + step;
  if (id === 'playerCount') { 
    el.value = Math.max(1, val); 
    renderCalendar(state, selectDay); 
    saveDataToStorage(); 
  }
  else if (id === 'guestInput') el.value = Math.max(0, val);
  else el.value = (id === 'hoursInput') ? Math.max(0.5, val) : Math.max(0, val);
}

function changeTime(step) {
  const input = document.getElementById('timeInput');
  let [h, m] = input.value.split(':').map(Number);
  let total = h * 60 + m + step;
  if (total < 0) total += 1440; 
  if (total >= 1440) total -= 1440;
  input.value = `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function updateDefaultPrice() {
  const loc = document.getElementById('locationSelect').value;
  const customInput = document.getElementById('customLocation');
  if (loc === "другое") { 
    customInput.style.display = 'block'; 
  } else { 
    customInput.style.display = 'none'; 
    if (locationPrices[loc]) document.getElementById('priceInput').value = locationPrices[loc]; 
  }
}

// Внутри js/main.js

function saveData() {
  const price = parseFloat(document.getElementById('priceInput').value);
  const hours = parseFloat(document.getElementById('hoursInput').value);
  const time = document.getElementById('timeInput').value;
  const locSel = document.getElementById('locationSelect').value;
  const location = locSel === 'другое' ? (document.getElementById('customLocation').value || 'другое') : locSel;
  const guests = parseInt(document.getElementById('guestInput').value) || 0;
  
  const monthIdx = parseInt(document.getElementById('monthSelect').value);
  const [h, m] = time.split(':').map(Number);
  
  // === 1. ГОТОВИМ TIMESTAMP ДЛЯ ТЕКУЩЕГО ВЫБРАННОГО ДНЯ ===
  const eventDate = new Date(2026, monthIdx, state.selectedDayNum, h, m);
  const timestamp = eventDate.getTime();

  // Формируем объект тренировки (уже с таймстампом)
  const entry = { price, hours, location, time, guests, timestamp };
  
  const targetWeekday = eventDate.getDay();
  state.lastUsedByWeekday[targetWeekday] = { price, hours, location, time };

  if (!state.schedule[state.selectedDayNum]) {
    state.schedule[state.selectedDayNum] = [];
  }

  // === 2. ОБНОВЛЯЕМ СОХРАНЕНИЕ В ОБЪЕКТ state.schedule ===
  if (document.getElementById('batchCheck').checked) {
    // ПАКЕТНОЕ СОХРАНЕНИЕ (на весь месяц по дням недели)
    const daysInMonth = new Date(2026, monthIdx + 1, 0).getDate();
    
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(2026, monthIdx, d).getDay() === targetWeekday) {
        if (!state.schedule[d]) state.schedule[d] = [];
        
        // Для каждого дня в серии генерируем свой уникальный timestamp
        const dDate = new Date(2026, monthIdx, d, h, m);
        const batchTimestamp = dDate.getTime();

        // Проверяем, есть ли уже тренировка в этот день на то же самое время
        const existsIdx = state.schedule[d].findIndex(e => e.time === time);
        
        if (existsIdx > -1) {
          // Если тренировка на это время уже есть — обновляем её (сохраняя гостей, если это не текущий день)
          state.schedule[d][existsIdx] = { 
            ...entry, 
            timestamp: batchTimestamp,
            guests: (d === state.selectedDayNum ? guests : state.schedule[d][existsIdx].guests) 
          };
        } else {
          // Корректировка логики из леджера исправлений:
          // Пакетное заполнение заполняет только ПУСТЫЕ дни недели, не перезаписывая дни, где уже есть другие тренировки
          if (state.schedule[d].length === 0 || d === state.selectedDayNum) {
            state.schedule[d].push({ 
              ...entry, 
              timestamp: batchTimestamp,
              guests: (d === state.selectedDayNum ? guests : 0) 
            });
          }
        }
        // Сортируем тренировки внутри дня по времени
        state.schedule[d].sort((a, b) => a.time.localeCompare(b.time));
      }
    }
  } else {
    // ОБЫЧНОЕ СОХРАНЕНИЕ ОДНОГО ДНЯ
    if (state.activeEntryIndex === -1) {
      // Создание новой тренировки в текущем дне
      state.schedule[state.selectedDayNum].push(entry);
    } else {
      // Обновление существующей тренировки в текущем дне
      state.schedule[state.selectedDayNum][state.activeEntryIndex] = entry;
    }
    // Сортируем тренировки внутри дня по времени
    state.schedule[state.selectedDayNum].sort((a, b) => a.time.localeCompare(b.time));
  }
  
  // === 3. ОТПРАВКА ДАННЫХ В СЕТЬ И ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ===
  saveDataToStorage(); 
  deselect();
}

function deleteEntry() {
  if (confirm("Удалить тренировку?")) {
    state.schedule[state.selectedDayNum].splice(state.activeEntryIndex, 1);
    if (state.schedule[state.selectedDayNum].length === 0) delete state.schedule[state.selectedDayNum];
    saveDataToStorage(); 
    deselect();
  }
}

function fullReset() {
  if (confirm("Очистить весь месяц?")) {
    state.schedule = {};
    saveDataToStorage();
    renderCalendar(state, selectDay);
  }
}

function closeSchedule() { 
  document.getElementById('scheduleModal').style.display = 'none'; 
}

// Назначение слушателей событий (Event Listeners) после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  // Закрытие при клике по фону
  document.body.addEventListener('click', deselect);
  document.getElementById('appContainer').addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('scheduleModal').addEventListener('click', closeSchedule);

  // Селекторы и Хедер
  document.getElementById('monthSelect').addEventListener('change', () => { deselect(); loadData(); });
  document.getElementById('viewScheduleBtn').addEventListener('click', () => showSchedule(state));
  document.getElementById('resetTopBtn').addEventListener('click', fullReset);
  document.getElementById('locationSelect').addEventListener('change', updateDefaultPrice);

  // Кнопки шагов (Steppers)
  document.getElementById('priceMinus').addEventListener('click', () => changeVal('priceInput', -100));
  document.getElementById('pricePlus').addEventListener('click', () => changeVal('priceInput', 100));
  document.getElementById('hoursMinus').addEventListener('click', () => changeVal('hoursInput', -0.5));
  document.getElementById('hoursPlus').addEventListener('click', () => changeVal('hoursInput', 0.5));
  document.getElementById('timeMinus').addEventListener('click', () => changeTime(-30));
  document.getElementById('timePlus').addEventListener('click', () => changeTime(30));
  document.getElementById('guestMinus').addEventListener('click', () => changeVal('guestInput', -1));
  document.getElementById('guestPlus').addEventListener('click', () => changeVal('guestInput', 1));
  document.getElementById('playerMinus').addEventListener('click', () => changeVal('playerCount', -1));
  document.getElementById('playerPlus').addEventListener('click', () => changeVal('playerCount', 1));

  // Управляющие кнопки панели
  document.getElementById('hideEditorBtn').addEventListener('click', deselect);
  document.getElementById('saveBtn').addEventListener('click', saveData);
  document.getElementById('deleteBtn').addEventListener('click', deleteEntry);
  
  document.getElementById('batchCheck').addEventListener('change', () => {
    document.getElementById('batchWrap').classList.toggle('active');
    toggleBatchPreview(state);
  });

  // Модалка графика
  document.getElementById('closeModalBtn').addEventListener('click', closeSchedule);
  document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);

  // Первичный запуск системы
  loadData();
});

// js/ui.js
import { monthNamesGenitive, monthNamesSchedule, locationPrices } from './config.js';

// Хелпер сокращения названий локаций
export function getShortLoc(full) {
  if (!full) return ''; 
  const l = full.toLowerCase();
  if (l.includes('дутик грунт')) return 'дг'; 
  if (l.includes('центр')) return 'тц';
  if (l.includes('улица')) return 'уг'; 
  if (l.includes('хард')) return 'дх'; 
  return full.substring(0, 3);
}

/**
 * Отрисовка сетки календаря
 */
export function renderCalendar(state, onSelectDay) {
  const cal = document.getElementById('calendar'); 
  cal.innerHTML = '';
  
  ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d => {
    cal.innerHTML += `<div class="day-name">${d}</div>`;
  });
  
  const monthIdx = parseInt(document.getElementById('monthSelect').value);
  const firstDay = new Date(2026, monthIdx, 1).getDay();
  let offset = (firstDay === 0) ? 6 : firstDay - 1;
  
  for (let i = 0; i < offset; i++) cal.innerHTML += '<div></div>';
  
  const daysInMonth = new Date(2026, monthIdx + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    let classes = ['date-cell']; 
    let details = ''; 
    let hasGuest = false;
    
    if (state.schedule[d] && state.schedule[d].length > 0) {
      classes.push('saved');
      const dayData = [...state.schedule[d]].sort((a, b) => a.time.localeCompare(b.time));
      const first = dayData[0];
      const totalCost = dayData.reduce((sum, item) => sum + (item.price * item.hours), 0);
      hasGuest = dayData.some(item => item.guests > 0);
      if (hasGuest) classes.push('has-guest');
      
      let loc = getShortLoc(first.location);
      let plusTag = dayData.length > 1 ? `<div class="plus-tag">+${dayData.length - 1}</div>` : '';
      details = `${plusTag}<div class="cell-info-row"><span class="cell-time-tag">${first.time}</span><span class="cell-loc-tag">${loc}</span></div><div class="cell-price">${Math.round(totalCost)}</div>`;
    }
    
    if (d === state.selectedDayNum) classes.push('active');
    
    const cell = document.createElement('div');
    cell.className = classes.join(' ');
    cell.innerHTML = `<span class="cell-day-num">${d}</span>${details}`;
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelectDay(d);
    });
    cal.appendChild(cell);
  }
  updateTotal(state);
}

/**
 * Пересчет финансовых итогов и вывод информации об экономии
 */
export function updateTotal(state) {
  let myTotal = 0, fullTotal = 0, totalGuestIncome = 0, totalSessions = 0;
  const basePlayers = parseInt(document.getElementById('playerCount').value) || 1;
  
  Object.values(state.schedule).forEach(dayArray => {
    dayArray.forEach(item => {
      totalSessions++;
      const cost = item.price * item.hours; 
      fullTotal += cost;
      const share = cost / (basePlayers + (item.guests || 0)); 
      myTotal += share;
      if (item.guests > 0) totalGuestIncome += (share * item.guests);
    });
  });

  const monthIdx = parseInt(document.getElementById('monthSelect').value);
  document.getElementById('mainTotalLabel').innerText = `В ${monthNamesGenitive[monthIdx]} за ${totalSessions} тр.`;
  document.getElementById('grandTotal').innerText = Math.round(fullTotal).toLocaleString() + ' ₽';
  document.getElementById('perPlayerTotal').innerText = Math.round(myTotal).toLocaleString() + ' ₽';
  
  const guestBox = document.getElementById('mainGuestSummary');
  let dailyInfo = '';

  if (state.selectedDayNum && state.schedule[state.selectedDayNum]) {
    let dailySaving = 0;
    state.schedule[state.selectedDayNum].forEach(item => {
      if (item.guests > 0) {
        const dShare = (item.price * item.hours) / (basePlayers + item.guests);
        dailySaving += (dShare * item.guests) / basePlayers;
      }
    });
    if (dailySaving > 0) {
      dailyInfo = `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed #ffecb3; color:#b45309; text-align:center;">✨ Экономия за сегодня: <b>+${Math.round(dailySaving).toLocaleString()} ₽</b></div>`;
    }
  }

  if (totalGuestIncome > 0 || dailyInfo !== '') {
    guestBox.style.display = 'block';
    let monthlyInfo = totalGuestIncome > 0 ? 
      `<div style="text-align:center;">💰 <b>Гости принесли (мес): ${Math.round(totalGuestIncome).toLocaleString()} ₽</b><br><span style="color:#64748b; font-size:11px;">Экономия каждого: по ${Math.round(totalGuestIncome / basePlayers).toLocaleString()} ₽</span></div>` : '';
    guestBox.innerHTML = monthlyInfo + dailyInfo;
  } else { 
    guestBox.style.display = 'none'; 
  }
}

/**
 * Управление подсветкой пакетного превью (Все Сб / Все Вс и т.д.)
 */
export function toggleBatchPreview(state) {
  const isChecked = document.getElementById('batchCheck').checked;
  document.querySelectorAll('.date-cell').forEach(c => c.classList.remove('batch-preview'));
  
  if (isChecked && state.selectedDayNum) {
    const monthIdx = parseInt(document.getElementById('monthSelect').value);
    const targetWeekday = new Date(2026, monthIdx, state.selectedDayNum).getDay();
    document.querySelectorAll('.date-cell').forEach(cell => {
      const dayNumEl = cell.querySelector('.cell-day-num');
      if (dayNumEl) {
        const d = parseInt(dayNumEl.innerText);
        if (new Date(2026, monthIdx, d).getDay() === targetWeekday && d !== state.selectedDayNum) {
          cell.classList.add('batch-preview');
        }
      }
    });
  }
}

/**
 * Отрисовка панели детального редактирования тренировки
 */
export function renderEditor(state, onTabSelect) {
  const monthIdx = parseInt(document.getElementById('monthSelect').value);
  const dateObj = new Date(2026, monthIdx, state.selectedDayNum);
  const weekday = dateObj.getDay();
  const dayShort = dateObj.toLocaleDateString('ru-RU', { weekday: 'short' });

  document.getElementById('editorPanel').style.display = 'block';
  document.getElementById('batchLabel').innerText = `+ Все ${dayShort}`;
  document.getElementById('batchCheck').checked = false;
  document.getElementById('batchWrap').classList.remove('active');

  const tabs = document.getElementById('tabsRow');
  tabs.innerHTML = '';
  const dayData = state.schedule[state.selectedDayNum] || [];
  
  dayData.forEach((entry, idx) => {
    const btn = document.createElement('div');
    btn.className = `tab-btn ${idx === state.activeEntryIndex ? 'active' : ''}`;
    btn.innerText = entry.time;
    btn.onclick = (e) => { 
      e.stopPropagation(); 
      onTabSelect(idx);
    };
    tabs.appendChild(btn);
  });

  const addBtn = document.createElement('div');
  addBtn.className = `tab-btn add-new ${state.activeEntryIndex === -1 ? 'active' : ''}`;
  addBtn.innerText = '+ Еще';
  addBtn.onclick = (e) => { 
    e.stopPropagation(); 
    onTabSelect(-1);
  };
  tabs.appendChild(addBtn);

  const saveBtn = document.getElementById('saveBtn');
  const delBtn = document.getElementById('deleteBtn');

  if (state.activeEntryIndex !== -1) {
    const e = dayData[state.activeEntryIndex];
    document.getElementById('priceInput').value = e.price;
    document.getElementById('hoursInput').value = e.hours;
    document.getElementById('timeInput').value = e.time;
    document.getElementById('guestInput').value = e.guests || 0;
    
    if (locationPrices[e.location]) { 
      document.getElementById('locationSelect').value = e.location; 
      document.getElementById('customLocation').style.display = 'none'; 
    } else { 
      document.getElementById('locationSelect').value = 'другое'; 
      document.getElementById('customLocation').value = e.location; 
      document.getElementById('customLocation').style.display = 'block'; 
    }
    saveBtn.innerText = "Обновить"; 
    saveBtn.classList.add('update-mode');
    document.getElementById('batchWrap').style.display = 'none';
    delBtn.style.display = 'flex';
  } else {
    saveBtn.innerText = "Сохранить"; 
    saveBtn.classList.remove('update-mode');
    document.getElementById('batchWrap').style.display = 'flex';
    delBtn.style.display = 'none';
    
    if (state.lastUsedByWeekday[weekday]) {
      const last = state.lastUsedByWeekday[weekday];
      document.getElementById('priceInput').value = last.price;
      document.getElementById('hoursInput').value = last.hours;
      document.getElementById('timeInput').value = last.time;
      document.getElementById('locationSelect').value = locationPrices[last.location] ? last.location : 'другое';
    } else {
      document.getElementById('timeInput').value = "19:00";
      document.getElementById('guestInput').value = 0;
    }
  }
}

/**
 * Показ модального окна "График" со списком всех записей
 * Адаптировано под массивы тренировок (несколько событий в день)
 */
export function showSchedule(state) {
  const list = document.getElementById('scheduleList'); 
  list.innerHTML = '';
  
  const monthIdx = parseInt(document.getElementById('monthSelect').value);
  const basePlayers = parseInt(document.getElementById('playerCount').value) || 1;
  const sortedDays = Object.keys(state.schedule).sort((a, b) => a - b);
  
  document.getElementById('modalTitle').innerText = `График тренировок в ${monthNamesGenitive[monthIdx]}`;
  
  let myTotal = 0, fullCost = 0, totalSessions = 0;
  
  // 1. Сначала считаем общее количество тренировок для правильного расчета индекса последнего элемента
  sortedDays.forEach(d => totalSessions += state.schedule[d].length);

  let currentSessionIdx = 0;

  // 2. Перебираем дни, а внутри них — каждую тренировку
  sortedDays.forEach(d => {
    state.schedule[d].forEach(item => {
      const date = new Date(2026, monthIdx, d);
      const dayName = date.toLocaleDateString('ru-RU', { weekday: 'long' });
      const cost = item.hours * item.price; 
      const share = cost / (basePlayers + item.guests);
      
      myTotal += share; 
      fullCost += cost;

      // Красивое скрытие нижней границы у самого последнего элемента списка
      const isLast = currentSessionIdx === totalSessions - 1;
      const borderStyle = isLast ? 'border-bottom: none;' : 'border-bottom: 1px solid #f1f5f9;';
      currentSessionIdx++;

      let gInfo = item.guests > 0 ? `
        <div class="sch-guest-money">👤 Гости: +${item.guests} (С гостя: ${Math.round(share)} ₽)</div>
        <div class="sch-saving">экономия напарникам: по ${Math.round((share * item.guests) / basePlayers)} ₽</div>` : '';
      
      list.innerHTML += `
        <div class="schedule-item" style="${borderStyle} padding: 12px 0; line-height: 1.3;">
          <div class="sch-date">${d} ${monthNamesSchedule[monthIdx]}, ${dayName} — ${item.time}</div>
          <div class="sch-loc">
            <span class="sch-cost-detail">${Math.round(cost).toLocaleString()} ₽</span>
            ${item.location} • ${item.price}₽/ч • ${item.hours}ч
          </div>
          ${gInfo}
        </div>`;
    });
  });
  
  document.getElementById('summaryBlock').innerHTML = `
    <div style="margin-top: 15px; border-top: 2px solid #f1f5f9; padding-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
      <div style="display: flex; flex-direction: column; align-items: center;">
        <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; text-align: center;">В ${monthNamesGenitive[monthIdx]} за ${totalSessions} тр.</span>
        <span style="font-size: 20px; font-weight: 800; color: #1e293b;">${Math.round(fullCost).toLocaleString()} ₽</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center;">
        <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; text-align: center;">Моя доля</span>
        <span style="font-size: 20px; font-weight: 800; color: #f59e0b;">${Math.round(myTotal).toLocaleString()} ₽</span>
      </div>
    </div>`;
    
  document.getElementById('scheduleModal').style.display = 'flex';
}

/**
 * Экспорт сформированного графика в формат PDF
 * Адаптировано под мобильные устройства и десктоп
 */
/**
 * Экспорт сформированного графика в формат PDF
 * Исправлена проблема белого листа на десктопе за счет нормализации контейнера перед снимком
 */
/**
 * Экспорт сформированного графика в формат PDF
 * Исправлена проблема белого листа и огромных полей на десктопе за счет динамического расчета размера страницы под контент
 */
export function exportToPDF() {
  const modal = document.getElementById('scheduleModal');
  const modalContent = document.getElementById('pdfContent');
  const monthIdx = document.getElementById('monthSelect').value;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Элементы управления, которые нужно скрыть при генерации
  const footer = modalContent.querySelector('.modal-footer-sticky');
  const body = modalContent.querySelector('.modal-body');
  const hideElements = modalContent.querySelectorAll('.close-modal, .btn-pdf');
  
  // Прячем кнопки управления на время снимка
  hideElements.forEach(el => el.style.opacity = '0');

  // Сохраняем исходные стили UI для последующего восстановления
  const originalModalStyle = modalContent.getAttribute('style') || '';
  const originalFooterStyle = footer ? footer.getAttribute('style') || '' : '';
  const originalBodyStyle = body ? body.getAttribute('style') || '' : '';
  const originalModalDisplay = modal.style.backdropFilter;

  // Подготовка DOM: убираем ограничения скроллов и фиксируем ширину блока
  modal.style.backdropFilter = 'none';
  modalContent.style.width = '450px'; 
  modalContent.style.height = 'auto';
  modalContent.style.maxHeight = 'none';
  modalContent.style.display = 'block';
  modalContent.style.overflow = 'visible';
  modalContent.style.boxShadow = 'none';

  if (body) {
    body.style.overflow = 'visible';
    body.style.height = 'auto';
    body.style.maxHeight = 'none';
  }

  if (footer) {
    footer.style.position = 'relative'; 
    footer.style.marginTop = '20px';
  }

  // Общие параметры для html2canvas (одинаковые для всех устройств)
  const canvasOpts = {
    scale: 2, 
    useCORS: true, 
    logging: false, 
    width: 450, 
    windowWidth: 450,
    scrollY: -window.scrollY,
    onclone: (clonedDoc) => {
      const clonedBtn = clonedDoc.querySelector('.btn-pdf');
      if (clonedBtn) clonedBtn.style.display = 'none';
    }
  };

  if (isMobile) {
    // Специфичные настройки для смартфонов
    const opt = {
      margin: [15, 0, 15, 0],
      filename: `Tennis_Schedule_${monthNamesGenitive[monthIdx]}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: canvasOpts,
      jsPDF: { unit: 'px', format: [450, modalContent.offsetHeight + 80], hotfixes: ['px_scaling'] }
    };

    window.html2pdf().set(opt).from(modalContent).save().then(() => {
      restoreUI();
    });

  } else {
    // Исправленный экспорт для Десктопа: страница создается точно под размер контента (поля минимальны)
    const opt = {
      margin: [10, 15, 15, 15], // небольшие аккуратные отступы в пикселях [верх, право, низ, лево]
      filename: `Tennis_Schedule_${monthNamesGenitive[monthIdx]}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: canvasOpts,
      // Вместо 'letter' жестко задаем ширину 480px (450 контент + 30 поля) и авто-высоту
      jsPDF: { unit: 'px', format: [480, modalContent.offsetHeight + 60], hotfixes: ['px_scaling'] }
    };

    window.html2pdf().set(opt).from(modalContent).save().then(() => {
      restoreUI();
    });
  }

  // Возврат интерфейса приложения в исходное состояние
  function restoreUI() {
    hideElements.forEach(el => el.style.opacity = '1');
    modalContent.setAttribute('style', originalModalStyle);
    if (footer) footer.setAttribute('style', originalFooterStyle);
    if (body) body.setAttribute('style', originalBodyStyle);
    modal.style.backdropFilter = originalModalDisplay;
  }
}

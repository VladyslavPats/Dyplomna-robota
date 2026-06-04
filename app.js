// Базова URL-адреса нашого бекенду
const API_BASE_URL = 'http://127.0.0.1:8000';

// Глобальні змінні стану
let globalTasks = [];
let favoriteIds = JSON.parse(localStorage.getItem('userFavorites')) || [];
let totalAnswers = 0; 
let correctAnswers = 0; 
let examTimer;
let progressChart; 

const interfaceTexts = {
    uk: {
        appTitle: "Вивчення англійської", registerButton: "Реєстрація", loginButton: "Вхід", guestButton: "Гість",
        logoutButton: "Вийти", progressTitle: "Прогрес", topicLabel: "Тема:", modeLabel: "Режим:", generateButton: "Старт",
        checkButton: "Перевірити", topicFood: "Їжа", topicTravel: "Подорожі", topicTechnology: "IT", topicSport: "Спорт", topicNature: "Природа",
        processingText: "Обробка...", dictionaryTitle: "Словник", filterAll: "Всі", filterFavorites: "Улюблені",
        modePractice: "Практика", modeExam: "Іспит", modeAI: "AI Генерація", resultTitle: "Результат: [SCORE]/[TOTAL]",
        regUsernamePlaceholder: "Ім'я", regEmailPlaceholder: "Email", regPasswordPlaceholder: "Пароль",
        loginEmailPlaceholder: "Email", loginPasswordPlaceholder: "Пароль", settingsTitle: "Налаштування",
        welcomeBotTitle: "🎉 Реєстрація успішна!",
        welcomeBotText: "Щоб не пропустити важливі тести та тренування, підключіть нашого Telegram-бота. Він надсилатиме вам щоденні нагадування!",
        welcomeBotHint: "💡 Підказка: Посилання на бота завжди доступне у верхньому меню (бургер-меню).",
        goToBotButton: "Перейти до бота",
        goToAppButton: "Перейти до сервісу",
        tgBotMenu: "Telegram Бот"
    },
    en: {
        appTitle: "Learn English", registerButton: "Sign Up", loginButton: "Login", guestButton: "Guest",
        logoutButton: "Logout", progressTitle: "Progress", topicLabel: "Topic:", modeLabel: "Mode:", generateButton: "Start",
        checkButton: "Check", topicFood: "Food", topicTravel: "Travel", topicTechnology: "IT", topicSport: "Sport", topicNature: "Nature",
        processingText: "Processing...", dictionaryTitle: "Vocabulary", filterAll: "All", filterFavorites: "Favorites",
        modePractice: "Practice", modeExam: "Exam", modeAI: "AI Generation", resultTitle: "Result: [SCORE]/[TOTAL]",
        regUsernamePlaceholder: "Name", regEmailPlaceholder: "Email", regPasswordPlaceholder: "Password",
        loginEmailPlaceholder: "Email", loginPasswordPlaceholder: "Password", settingsTitle: "Settings",
        welcomeBotTitle: "🎉 Registration Successful!",
        welcomeBotText: "To make sure you don't miss important tests, connect our Telegram bot. It will send you daily reminders!",
        welcomeBotHint: "💡 Hint: The link to the bot is always available in the top menu (burger menu).",
        goToBotButton: "Go to Bot",
        goToAppButton: "Go to Service",
        tgBotMenu: "Telegram Bot"
    }
};

let currentLang = localStorage.getItem('userLang') || 'uk';

function updateProgressBar() {
    const fill = document.getElementById('progress-bar-fill');
    const text = document.getElementById('progress-text');
    let percent = totalAnswers === 0 ? 0 : Math.round((correctAnswers / totalAnswers) * 100);
    if(fill) fill.style.width = `${percent}%`;
    if(text) text.textContent = `${percent}%`;

    const incorrectAnswers = totalAnswers - correctAnswers;
    const ctx = document.getElementById('statsChart');
    
    if (ctx) {
        if (progressChart) {
            progressChart.data.datasets[0].data = [correctAnswers, incorrectAnswers];
            progressChart.update();
        } else {
            progressChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Правильно', 'Помилки'],
                    datasets: [{
                        data: [correctAnswers, incorrectAnswers],
                        backgroundColor: ['#10b981', '#ef4444'], 
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: { legend: { display: false } }
                }
            });
        }
    }
}

async function navigateTo(id) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';
    
    if (id === 'app-screen') {
        const currentUser = localStorage.getItem('currentUser');
        
        if (currentUser && currentUser !== 'Guest') {
            try {
                const res = await fetch(`${API_BASE_URL}/api/progress/${currentUser}`);
                if (res.ok) {
                    const data = await res.json();
                    correctAnswers = data.correct_answers;
                    totalAnswers = data.total_answers;
                }
            } catch (e) { console.error("Помилка завантаження прогресу", e); }
        } else {
            correctAnswers = 0;
            totalAnswers = 0;
        }

        await loadData();
        updateProgressBar();
    }
}

function updateUI() {
    const texts = interfaceTexts[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if(texts[key]) el.textContent = texts[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if(texts[key]) el.placeholder = texts[key];
    });
}

async function loadData() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/words`);
        if (res.ok) {
            globalTasks = await res.json();
            renderCards(globalTasks);
        }
    } catch (e) {
        console.error("Помилка завантаження слів", e);
        const container = document.getElementById('dictionary-container');
        if(container) container.innerHTML = '<p style="color:red">Помилка завантаження словника.</p>';
    }
}

function renderCards(data) {
    const container = document.getElementById('dictionary-container');
    if(!container) return;
    container.innerHTML = '';
    data.forEach(item => {
        const isFav = favoriteIds.includes(item.id);
        container.insertAdjacentHTML('beforeend', `
            <div class="word-card" data-category="${item.topic}">
                <div class="word-info">
                    <strong>${item.q} <i class="fas fa-volume-up speak-btn" data-word="${item.q}" title="Listen"></i></strong><br>
                    <small>${item.a}</small>
                </div>
                <button class="favorite-btn ${isFav ? 'is-active' : ''}" onclick="toggleFav(${item.id}, this)">
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
            </div>
        `);
    });
    
    document.querySelectorAll('.speak-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const ut = new SpeechSynthesisUtterance(btn.dataset.word);
            ut.lang = 'en-US';
            window.speechSynthesis.speak(ut);
        };
    });
}

function toggleFav(id, btn) {
    if (favoriteIds.includes(id)) {
        favoriteIds = favoriteIds.filter(f => f !== id);
        btn.querySelector('i').className = 'fa-regular fa-heart';
    } else {
        favoriteIds.push(id);
        btn.querySelector('i').className = 'fa-solid fa-heart';
    }
    btn.classList.toggle('is-active');
    localStorage.setItem('userFavorites', JSON.stringify(favoriteIds));
}

async function generateTasks() {
    const topic = document.getElementById('topic').value;
    const mode = document.getElementById('mode').value;
    const container = document.getElementById('task-container');
    const timerDisplay = document.getElementById('exam-timer');
    const currentUser = localStorage.getItem('currentUser');
    
    clearInterval(examTimer);
    container.innerHTML = '';
    timerDisplay.style.display = 'none';

    let tasksToUse = [];
    if (currentUser && currentUser !== 'Guest') {
        try {
            const res = await fetch(`${API_BASE_URL}/api/smart-words/${currentUser}/${topic}`);
            if (res.ok) {
                tasksToUse = await res.json();
            }
        } catch (e) { console.error("Помилка smart-words", e); }
    }
    
    if (tasksToUse.length === 0) {
        tasksToUse = globalTasks.filter(t => t.topic === topic).sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    if (mode === 'ai') {
        const selectedForAI = tasksToUse.map(t => t.q);
        container.innerHTML = `<div class="loader"><i class="fas fa-spinner fa-spin"></i> ${interfaceTexts[currentLang].processingText}</div>`;
        try {
            const res = await fetch(`${API_BASE_URL}/api/generate-task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, words: selectedForAI })
            });
            const data = await res.json();
            container.innerHTML = '';

            const div = document.createElement('div');
            div.className = 'task screen';
            div.innerHTML = `<p style="line-height: 1.8;">${data.text.replace(/___/g, '<span style="display:inline-block; width:60px; border-bottom:2px solid var(--primary-color);"></span>')}</p>`;

            const btn = document.createElement('button');
            btn.className = 'auth-btn primary-btn';
            btn.textContent = interfaceTexts[currentLang].checkButton;

            data.answers.forEach((ans, i) => {
                const input = document.createElement('input');
                input.type = 'text';
                input.id = `ai-ans-${i}`;
                input.placeholder = `...`;
                input.style.marginTop = '10px';
                input.addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); btn.click(); }});
                div.appendChild(input); 
            });

            container.appendChild(div);

            btn.onclick = async () => {
                btn.disabled = true;
                await checkAI(data.answers);
            };
            container.appendChild(btn);

        } catch (e) {
            container.innerHTML = `<div class="error-text">Помилка генерації AI. Перевірте з'єднання.</div>`;
        }
    } else {
        if (mode === 'exam') {
            timerDisplay.style.display = 'block';
            let time = 60;
            examTimer = setInterval(() => {
                time--; timerDisplay.textContent = time;
                if(time <= 0) { clearInterval(examTimer); checkSimple(tasksToUse); }
            }, 1000);
        }

        tasksToUse.forEach((t, i) => {
            container.insertAdjacentHTML('beforeend', `<div class="task screen"><p>${t.q}</p><input type="text" id="ans-${i}" data-q="${t.q}" placeholder="..."></div>`);
        });

        const btn = document.createElement('button');
        btn.className = 'auth-btn primary-btn';
        btn.textContent = interfaceTexts[currentLang].checkButton;
        
        container.querySelectorAll('input').forEach(inp => {
            inp.onkeypress = (e) => { if(e.key === 'Enter') btn.click(); };
        });

        btn.onclick = () => checkSimple(tasksToUse);
        container.appendChild(btn);
    }
}

async function reportWordResult(word, isCorrect) {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser && currentUser !== 'Guest') {
        try {
            await fetch(`${API_BASE_URL}/api/word-result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser, word_q: word, is_correct: isCorrect })
            });
        } catch (e) { console.error("Помилка алгоритму", e); }
    }
}

async function checkAI(correctList) {
    let score = 0;
    for (let i = 0; i < correctList.length; i++) {
        const inp = document.getElementById(`ai-ans-${i}`);
        const userWord = inp.value.trim();
        const correctWord = correctList[i];
        if(!userWord) continue;

        const res = await fetch(`${API_BASE_URL}/api/check-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_word: userWord, correct_word: correctWord })
        });
        const data = await res.json();
        
        if (data.is_correct) {
            inp.style.borderColor = 'var(--success-color)';
            score++; correctAnswers++;
            await reportWordResult(correctWord, true);
        } else {
            inp.style.borderColor = 'var(--fail-color)';
            await reportWordResult(correctWord, false);
        }
        totalAnswers++;
    }
    await saveAndAlert(score, correctList.length, correctList);
}

function checkSimple(tasks) {
    clearInterval(examTimer);
    let score = 0;
    tasks.forEach((t, i) => {
        const inp = document.getElementById(`ans-${i}`);
        if(!inp) return;
        const isCorrect = inp.value.toLowerCase().trim() === t.a.toLowerCase();
        
        if(isCorrect) {
            inp.style.borderColor = 'var(--success-color)';
            score++; correctAnswers++;
        } else {
            inp.style.borderColor = 'var(--fail-color)';
        }
        
        reportWordResult(t.q, isCorrect);
        totalAnswers++;
    });
    saveAndAlert(score, tasks.length);
}

async function saveAndAlert(score, total, answers = null) {
    const currentUser = localStorage.getItem('currentUser');
    updateProgressBar();
    
    if (currentUser && currentUser !== 'Guest') {
        try {
            await fetch(`${API_BASE_URL}/api/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser,
                    correct_answers: correctAnswers,
                    total_answers: totalAnswers
                })
            });
        } catch (e) { console.error("Не вдалося зберегти прогрес у БД", e); }
    }

    const msg = `${interfaceTexts[currentLang].resultTitle.replace('[SCORE]', score).replace('[TOTAL]', total)}${answers ? '\nCorrect: ' + answers.join(', ') : ''}`;
    alert(msg);
}

// === БЕЗПЕЧНА ПРИВ'ЯЗКА ПОДІЙ (Захист від помилок Кешу) ===
const safeBind = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el[event] = handler;
};

safeBind('show-registration-btn', 'onclick', () => navigateTo('registration-screen'));
safeBind('show-login-btn', 'onclick', () => navigateTo('login-screen'));
safeBind('back-to-auth-reg-btn', 'onclick', () => navigateTo('auth-screen'));
safeBind('back-to-auth-login-btn', 'onclick', () => navigateTo('auth-screen'));
safeBind('skip-bot-btn', 'onclick', () => navigateTo('app-screen'));
safeBind('generate', 'onclick', generateTasks);

safeBind('guest-btn', 'onclick', () => {
    localStorage.setItem('currentUser', 'Guest');
    const dpName = document.getElementById('user-display-name');
    if (dpName) dpName.textContent = 'Guest';
    navigateTo('app-screen');
});

safeBind('logout-btn', 'onclick', () => {
    localStorage.removeItem('currentUser');
    location.reload();
});

const regForm = document.getElementById('registration-form');
if (regForm) {
    regForm.onsubmit = async (e) => {
        e.preventDefault(); 
        
        const username = document.getElementById('reg-username-input').value.trim();
        const email = document.getElementById('reg-email-input').value.trim();
        const password = document.getElementById('reg-password-input').value;
        const msgBox = document.getElementById('reg-message');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('currentUser', data.username);
                const dpName = document.getElementById('user-display-name');
                if (dpName) dpName.textContent = data.username;
                
                navigateTo('welcome-bot-screen');
                if(msgBox) msgBox.textContent = ''; 
            } else {
                if(msgBox) msgBox.textContent = data.detail || 'Помилка реєстрації';
            }
        } catch (error) {
            if(msgBox) msgBox.textContent = 'Помилка з\'єднання з сервером';
        }
    };
}

safeBind('login-btn', 'onclick', async () => {
    const email = document.getElementById('login-email-input').value.trim();
    const password = document.getElementById('login-password-input').value;
    const msgBox = document.getElementById('login-message');
    
    if (!email || !password) {
        if(msgBox) msgBox.textContent = 'Введіть email та пароль';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('currentUser', data.username);
            const dpName = document.getElementById('user-display-name');
            if (dpName) dpName.textContent = data.username;
            navigateTo('app-screen');
            if(msgBox) msgBox.textContent = '';
        } else {
            if(msgBox) msgBox.textContent = data.detail || 'Невірний email або пароль';
        }
    } catch (error) {
        if(msgBox) msgBox.textContent = 'Помилка з\'єднання з сервером';
    }
});

// ЛОГІКА НАЛАШТУВАНЬ ТА БУРГЕР-МЕНЮ
const mobileMenu = document.getElementById('mobile-menu');
const burgerBtn = document.getElementById('burger-btn');
const closeMenuBtn = document.getElementById('close-menu-btn');

if (burgerBtn && mobileMenu) burgerBtn.onclick = () => mobileMenu.classList.add('is-open');
if (closeMenuBtn && mobileMenu) closeMenuBtn.onclick = () => mobileMenu.classList.remove('is-open');

safeBind('settings-btn', 'onclick', () => {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'flex';
    if (mobileMenu) mobileMenu.classList.remove('is-open');
});

safeBind('close-settings-btn', 'onclick', () => {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
});

safeBind('theme-select', 'onchange', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    localStorage.setItem('userTheme', e.target.value);
});

safeBind('lang-select', 'onchange', (e) => {
    currentLang = e.target.value;
    localStorage.setItem('userLang', currentLang);
    updateUI();
});

// ЛОГІКА ФІЛЬТРІВ СЛОВНИКА
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.word-card').forEach(card => {
            const isFav = card.querySelector('.favorite-btn').classList.contains('is-active');
            if(filter === 'all' || card.dataset.category === filter || (filter === 'favorites' && isFav)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    };
});

// ІНІЦІАЛІЗАЦІЯ ПРИ ЗАВАНТАЖЕННІ
const savedUser = localStorage.getItem('currentUser');
if(savedUser) {
    const dpName = document.getElementById('user-display-name');
    if (dpName) dpName.textContent = savedUser;
    navigateTo('app-screen');
} else {
    navigateTo('auth-screen');
}

const savedTheme = localStorage.getItem('userTheme');
if(savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

updateUI();
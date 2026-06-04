# English Learning AI Service 🚀

**English Learning AI Service** — це інтелектуальна веб-платформа для вивчення англійської мови, що базується на сучасних моделях генеративного штучного інтелекту. Проєкт демонструє поєднання класичних веб-технологій з інженерією промптів (Prompt Engineering) для створення персоналізованого навчального досвіду.

## 🌟 Основна ідея (Elevator Pitch)
На відміну від традиційних сервісів, які пропонують статичні тести, цей проєкт використовує ШІ як динамічного репетитора. Система генерує унікальні контекстні вправи на основі реальної бази слів (`data.json`) та застосовує семантичний аналіз для "розумної" перевірки відповідей користувача, враховуючи синоніми та контекст.

## 🎯 Цільова аудиторія
- **Студенти програмної інженерії:** як приклад інтеграції LLM (Large Language Models) у веб-застосунки.
- **Особи, що вивчають мову:** для відпрацювання лексики в реальних реченнях, а не окремими словами.
- **Викладачі:** для автоматизації створення унікальних завдань.

## 🛠 Технологічний стек
- **Backend:** Python 3.13, FastAPI (High performance framework).
- **AI Core:** Google Gemini 2.0 Flash Lite API.
- **Frontend:** Vanilla JavaScript, HTML5, CSS3.
- **Data Management:** JSON, LocalStorage, Python-dotenv.

## ✨ Реалізовані ШІ-патерни
1. **Contextual Task Generation:** ШІ отримує набір слів із локальної бази та генерує зв'язний текст, зберігаючи структуру для інтерактивної вправи.
2. **Smart Semantic Validation:** Замість жорсткого порівняння рядків, бекенд звертається до LLM для підтвердження правильності синонімів.
3. **Fail-Safe Architecture:** Реалізовано обробку помилок API та безпечне керування секретами через змінні середовища.

## ⚙️ Швидкий старт

### 1. Клонування та налаштування
```bash
# Клонуйте репозиторій
git clone https://github.com/VladyslavPats/Osnovy-shtuchnoho-intelektu.git
cd Osnovy-shtuchnoho-intelektu

# Встановіть залежності
pip install fastapi uvicorn python-dotenv google-genai sqlalchemy "passlib[bcrypt]" aiogram apscheduler

#Запуск серверу бекенду
pe -m uvicorn backend:app --reload

#Запуск бота
py bot.py

#Запустити index.html через live server

import asyncio
import os
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Імпортуємо моделі з бекенду
from backend import SessionLocal, UserDB, ProgressDB

load_dotenv()

bot = Bot(token=os.getenv("TG_BOT_TOKEN"))
dp = Dispatcher()

# Клавіатура (тільки статистика)
main_kb = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="📊 Мій прогрес")]],
    resize_keyboard=True
)

@dp.message(CommandStart())
async def command_start_handler(message: Message) -> None:
    db: Session = SessionLocal()
    try:
        db_user = db.query(UserDB).filter(UserDB.telegram_id == str(message.from_user.id)).first()
        if db_user:
            await message.answer(
                f"👋 Привіт знову, {db_user.username}!\nТвій акаунт прив'язано. Я буду нагадувати тобі про заняття!",
                reply_markup=main_kb
            )
        else:
            await message.answer(
                f"👋 Привіт!\n\nЯ бот-компаньйон сервісу для вивчення англійської.\n"
                f"Щоб я міг надсилати тобі нагадування та статистику, надішли свій **email** від сайту."
            )
    finally:
        db.close()

# --- ЛОГІКА НАГАДУВАНЬ (Фонова задача) ---
async def send_reminders():
    db: Session = SessionLocal()
    try:
        # Шукаємо всіх користувачів, у яких прив'язаний Telegram
        users = db.query(UserDB).filter(UserDB.telegram_id.isnot(None)).all()
        for user in users:
            try:
                await bot.send_message(
                    chat_id=user.telegram_id,
                    text=f"🔔 Привіт, {user.username}! Час попрактикувати англійську.\n\n"
                         f"Заходь на сайт та пройди кілька нових завдань, щоб не втрачати прогрес! 🚀",
                    reply_markup=main_kb
                )
            except Exception as e:
                print(f"Не вдалося відправити нагадування юзеру {user.username}: {e}")
    finally:
        db.close()

# Секретна команда для демонстрації на захисті диплома
@dp.message(F.text == "/test_reminder")
async def test_reminder_cmd(message: Message):
    await send_reminders()
    await message.answer("✅ (Тест) Нагадування розіслані всім прив'язаним користувачам!")

# --- ЛОГІКА ПРОГРЕСУ ТА ПРИВ'ЯЗКИ ---
@dp.message(F.text == "📊 Мій прогрес")
async def show_progress(message: Message) -> None:
    db: Session = SessionLocal()
    try:
        db_user = db.query(UserDB).filter(UserDB.telegram_id == str(message.from_user.id)).first()
        if not db_user:
            await message.answer("Спочатку прив'яжи акаунт! Надішли мені свій email.")
            return

        prog = db.query(ProgressDB).filter(ProgressDB.username == db_user.username).first()
        correct = prog.correct_answers if prog else 0
        total = prog.total_answers if prog else 0
        
        await message.answer(
            f"📈 **Статистика ({db_user.username}):**\n\n"
            f"✅ Правильних відповідей: {correct}\n"
            f"📝 Всього завдань: {total}\n",
            reply_markup=main_kb
        )
    finally:
        db.close()

@dp.message(F.text.contains("@"))
async def handle_email(message: Message) -> None:
    user_email = message.text.strip()
    db: Session = SessionLocal()
    try:
        existing_tg = db.query(UserDB).filter(UserDB.telegram_id == str(message.from_user.id)).first()
        if existing_tg:
            await message.answer("Твій Telegram вже прив'язаний до акаунта!", reply_markup=main_kb)
            return

        db_user = db.query(UserDB).filter(UserDB.email == user_email).first()
        if db_user:
            db_user.telegram_id = str(message.from_user.id)
            db.commit()
            await message.answer(
                f"✅ Успіх! Я запам'ятав тебе як **{db_user.username}**.\n"
                f"Тепер я буду щодня нагадувати тобі про навчання.",
                reply_markup=main_kb
            )
        else:
            await message.answer("❌ Користувача з таким email не знайдено на сайті.")
    finally:
        db.close()

@dp.message()
async def handle_other(message: Message) -> None:
    await message.answer("Скористайся меню внизу або надішли email для прив'язки акаунта.")

async def main() -> None:
    print("🤖 Бот запущений!")
    
    # Ініціалізація планувальника завдань
    scheduler = AsyncIOScheduler()
    
    # Налаштовуємо відправку нагадувань щодня о 10:00 ранку
    scheduler.add_job(send_reminders, 'cron', hour=10, minute=0)
    
    scheduler.start()
    
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
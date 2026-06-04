import os
import json
import random
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv

from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from passlib.context import CryptContext

SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    telegram_id = Column(String, unique=True, nullable=True)

class WordDB(Base):
    __tablename__ = "words"
    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, index=True)
    q = Column(String)  
    a = Column(String)  

class ProgressDB(Base):
    __tablename__ = "progress"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True) 
    total_answers = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)

# НОВА ТАБЛИЦЯ: Трекінг помилок для алгоритму повторення
class WordMistakesDB(Base):
    __tablename__ = "word_mistakes"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    word_q = Column(String, index=True)
    mistake_count = Column(Integer, default=0)

Base.metadata.create_all(bind=engine)

def populate_dictionary():
    db = SessionLocal()
    try:
        if db.query(WordDB).count() == 0:
            if os.path.exists("data.json"):
                with open("data.json", "r", encoding="utf-8") as f:
                    words_list = json.load(f)
                    for w in words_list:
                        db.add(WordDB(topic=w["topic"], q=w["q"], a=w["a"]))
                    db.commit()
    except Exception as e:
        print(f"Помилка імпорту: {e}")
    finally:
        db.close()

populate_dictionary()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class ProgressUpdate(BaseModel):
    username: str
    correct_answers: int
    total_answers: int

class WordResult(BaseModel):
    username: str
    word_q: str
    is_correct: bool

@app.post("/api/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserDB).filter(UserDB.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email вже зареєстровано")
    
    hashed_pwd = pwd_context.hash(user.password)
    new_user = UserDB(username=user.username, email=user.email, hashed_password=hashed_pwd)
    db.add(new_user)
    db.add(ProgressDB(username=user.username, total_answers=0, correct_answers=0))
    db.commit()
    return {"message": "Успіх", "username": new_user.username}

@app.post("/api/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(UserDB).filter(UserDB.email == user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Невірний email або пароль")
    return {"message": "Успіх", "username": db_user.username}

@app.get("/api/words")
def get_words(db: Session = Depends(get_db)):
    words = db.query(WordDB).all()
    return [{"id": w.id, "topic": w.topic, "q": w.q, "a": w.a} for w in words]

@app.get("/api/progress/{username}")
def get_progress(username: str, db: Session = Depends(get_db)):
    prog = db.query(ProgressDB).filter(ProgressDB.username == username).first()
    if not prog:
        return {"correct_answers": 0, "total_answers": 0}
    return {"correct_answers": prog.correct_answers, "total_answers": prog.total_answers}

@app.post("/api/progress")
def update_progress(req: ProgressUpdate, db: Session = Depends(get_db)):
    prog = db.query(ProgressDB).filter(ProgressDB.username == req.username).first()
    if not prog:
        prog = ProgressDB(username=req.username)
        db.add(prog)
    prog.correct_answers = req.correct_answers
    prog.total_answers = req.total_answers
    db.commit()
    return {"status": "success"}

# --- РОЗУМНИЙ АЛГОРИТМ ПОВТОРЕННЯ ---
@app.post("/api/word-result")
def update_word_result(req: WordResult, db: Session = Depends(get_db)):
    mistake_entry = db.query(WordMistakesDB).filter(
        WordMistakesDB.username == req.username,
        WordMistakesDB.word_q == req.word_q
    ).first()

    if not mistake_entry:
        mistake_entry = WordMistakesDB(username=req.username, word_q=req.word_q, mistake_count=0)
        db.add(mistake_entry)

    if not req.is_correct:
        mistake_entry.mistake_count += 1
    else:
        if mistake_entry.mistake_count > 0:
            mistake_entry.mistake_count -= 1

    db.commit()
    return {"status": "ok"}

@app.get("/api/smart-words/{username}/{topic}")
def get_smart_words(username: str, topic: str, db: Session = Depends(get_db)):
    all_topic_words = db.query(WordDB).filter(WordDB.topic == topic).all()
    user_mistakes = db.query(WordMistakesDB).filter(WordMistakesDB.username == username).all()
    
    mistake_map = {m.word_q: m.mistake_count for m in user_mistakes}
    
    random.shuffle(all_topic_words)
    # Сортуємо так, щоб проблемні слова завжди були першими
    sorted_words = sorted(all_topic_words, key=lambda w: mistake_map.get(w.q, 0), reverse=True)
    
    top_3 = sorted_words[:3]
    return [{"id": w.id, "topic": w.topic, "q": w.q, "a": w.a} for w in top_3]

class TaskRequest(BaseModel):
    topic: str
    words: list[str]

@app.post("/api/generate-task")
async def generate_task(req: TaskRequest):
    words_list = ", ".join(req.words)
    prompt = f"""
    You are an English teacher. Write a short paragraph (2 sentences) about '{req.topic}'.
    CRITICAL RULE: You MUST strictly include these exact 3 words in the text: {words_list}.
    Do not change their form. Replace exactly these 3 words with '___' in the text.
    The "answers" array MUST be exactly this list in correct order: {json.dumps(req.words)}.
    Return ONLY a JSON object: {{"text": "...", "answers": [...]}}
    """
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`").replace("json\n", "", 1).strip()
        return json.loads(raw_text)
    except Exception as e:
        return {"text": "Server error.", "answers": []}

@app.post("/api/check-answer")
async def check_answer(req: dict):
    prompt = f"Check if the word '{req.get('user_word', '')}' is a valid synonym or exactly matches '{req.get('correct_word', '')}' in English context. Return ONLY a JSON object: {{\"is_correct\": true or false}}"
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        raw_text = response.text.strip().strip("`").replace("json\n", "", 1).strip()
        return json.loads(raw_text)
    except Exception as e:
        return {"is_correct": False}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
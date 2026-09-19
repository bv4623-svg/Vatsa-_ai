from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Vatsa AI chal raha hai"}

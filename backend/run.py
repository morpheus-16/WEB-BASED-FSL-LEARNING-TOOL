"""
Start FSL Learn API.
Requires Laragon MySQL running (127.0.0.1:3306, root, empty password).
"""
import uvicorn

if __name__ == "__main__":
    print("=" * 50)
    print(" FSL Learn — starting")
    print(" DB: Laragon MySQL  127.0.0.1:3306 / fsl_learn")
    print(" URL: http://127.0.0.1:8000")
    print("=" * 50)
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )

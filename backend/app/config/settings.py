import os


APP_NAME = os.getenv("APP_NAME", "FlowInsight AI")
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
#!/bin/bash
cd /home/kavia/workspace/code-generation/online-chess-platform-202192-202201/chess_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi


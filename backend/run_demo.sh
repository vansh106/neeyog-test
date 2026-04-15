#!/bin/bash
echo "======================================"
echo "  Starting Quotation System Demo..."
echo "======================================"
echo ""
echo "Ensure API is running on port 8000:"
echo "  uvicorn api.main:app --reload --port 8000"
echo ""
python demo_runner.py

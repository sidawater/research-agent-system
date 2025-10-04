# Makefile for Research Agent System

# Variables
PYTHON = python
PIP = pip
PROJECT_DIR = research

# Default target
.PHONY: help
help:
	@echo "Research Agent System Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make install           Install dependencies"
	@echo "  make run               Run the application"
	@echo "  make dev               Run the application in development mode"
	@echo "  make test              Run tests"
	@echo "  make clean             Clean up temporary files"
	@echo "  make format            Format code with black"
	@echo "  help                   Show this help message"

# Install dependencies
.PHONY: install
install:
	$(PIP) install -r $(PROJECT_DIR)/requirements.txt

# Run the application
.PHONY: run
run:
	$(PYTHON) $(PROJECT_DIR)/run.py

# Run the mock core for testing
.PHONY: dev
dev:
	$(PYTHON) $(PROJECT_DIR)/run_mock_core.py

# Run tests
.PHONY: test
test:
	$(PYTHON) -m pytest tests/

# Clean temporary files
.PHONY: clean
clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	rm -rf var/

# Format code
.PHONY: format
format:
	$(PYTHON) -m black $(PROJECT_DIR)/

# Check code style
.PHONY: lint
lint:
	$(PYTHON) -m flake8 $(PROJECT_DIR)/
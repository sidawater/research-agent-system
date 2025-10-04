# Research Agent System

An intelligent research agent system for academic research.

## Features

- Academic paper search and retrieval
- Automated research report generation
- Reference management and PDF downloading
- Export functionality for reports

## Installation

```bash
pip install -r requirements.txt
```

## Usage

To run the research agent system:

```bash
python research/run.py
```

For testing purposes, you can also run:

```bash
python research/run_mock_core.py
```

## Project Structure

```
research/
├── app/              # FastAPI application
├── config/           # Configuration management
├── core/             # Core functionality
│   ├── agents/       # AI agents for various tasks
│   ├── common/       # Common utilities and schemas
│   └── workflow/     # Workflow management
├── db/               # Database connectors
├── store/            # Data storage interfaces
├── requirements.txt  # Python dependencies
├── pyproject.toml    # Project metadata and build configuration
└── run.py            # Main application entry point
```

## Dependencies

All dependencies are listed in `requirements.txt` and defined in `pyproject.toml`.
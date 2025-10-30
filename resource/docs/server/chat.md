# Chat Handler API Documentation

## Overview

This document describes the conversation-related interfaces provided by the `research/app/handler/chat.py` module. These handlers manage conversation history, session data, and reference file downloads.

---

## Core Interfaces

### 1. Update Conversation History

**Function:** `update_conversation_history`

Updates the entire conversation history document for a given session.

#### Signature
```python
async def update_conversation_history(session_id: str, document: Dict) -> Optional[Dict]
```

#### Parameters
- `session_id` (str): The unique session identifier
- `document` (Dict): Complete document content to be stored/updated

#### Returns
- `Optional[Dict]`: Update result from MongoDB operation, or `None` if error occurs

#### Behavior
- Uses MongoDB's `upsert` operation (creates new document if session doesn't exist)
- Stores data in the `sessions` collection
- Replaces entire document content with provided data

#### Example Usage
```python
result = await update_conversation_history(
    session_id="abc123",
    document={
        "session_id": "abc123",
        "messages": [...],
        "research_state": {...},
        "updated_at": "2025-10-30T12:00:00Z"
    }
)
```

---

### 2. Get Conversation

**Function:** `get_conversation`

Retrieves the conversation history document for a specific session.

#### Signature
```python
async def get_conversation(session_id: str) -> Optional[Dict]
```

#### Parameters
- `session_id` (str): The unique session identifier

#### Returns
- `Optional[Dict]`: Complete conversation document, or empty dict `{}` if not found or error occurs

#### Behavior
- Queries the `sessions` collection by `session_id`
- Returns entire session document including all fields
- Returns empty dict instead of `None` when session doesn't exist

#### Example Usage
```python
conversation = await get_conversation("abc123")
if conversation:
    messages = conversation.get("messages", [])
    research_state = conversation.get("research_state", {})
```

---

### 3. Get All Conversations

**Function:** `get_conversations`

Retrieves a list of all conversation sessions (limited to 50 most recent).

#### Signature
```python
async def get_conversations() -> Optional[List[Dict]]
```

#### Parameters
None

#### Returns
- `Optional[List[Dict]]`: List of session documents (max 50), or empty list `[]` if error occurs

#### Behavior
- Queries all documents from `sessions` collection
- Automatically limits results to 50 sessions
- Returns empty list on error or when no sessions exist

#### Example Usage
```python
all_sessions = await get_conversations()
for session in all_sessions:
    session_id = session.get("session_id")
    title = session.get("title", "Untitled")
    print(f"{session_id}: {title}")
```

---

### 4. Get Conversation Messages

**Function:** `get_conversation_messages`

Retrieves paginated message history for a specific conversation session.

#### Signature
```python
async def get_conversation_messages(
    session_id: str, 
    limit: int = 100, 
    skip: int = 0
) -> Dict
```

#### Parameters
- `session_id` (str): The unique session identifier
- `limit` (int, optional): Maximum number of messages to return. Default: 100
- `skip` (int, optional): Number of messages to skip (for pagination). Default: 0

#### Returns
- `Dict`: Response object containing:
  ```python
  {
      "session_id": str,        # Session identifier
      "total_count": int,       # Total message count in session
      "limit": int,             # Applied limit
      "skip": int,              # Applied skip offset
      "messages": List[Dict]    # List of message objects
  }
  ```

#### Exceptions
- `HTTPException(500)`: Raised when database query fails

#### Behavior
- Uses `conversation_manager` to retrieve messages
- Supports pagination through `limit` and `skip` parameters
- Returns total count for client-side pagination UI
- Logs retrieval operations

#### Example Usage
```python
# Get first 50 messages
response = await get_conversation_messages(
    session_id="abc123",
    limit=50,
    skip=0
)

print(f"Showing {len(response['messages'])} of {response['total_count']} messages")

# Get next page
next_page = await get_conversation_messages(
    session_id="abc123",
    limit=50,
    skip=50
)
```

---

### 5. Download References

**Function:** `download_references_handler`

Packages and downloads all reference PDF files for a session as a ZIP archive.

#### Signature
```python
async def download_references_handler(session_id: str) -> StreamingResponse
```

#### Parameters
- `session_id` (str): The unique session identifier

#### Returns
- `StreamingResponse`: ZIP file stream with appropriate headers for download

#### Exceptions
- `HTTPException(404)`: 
  - Session not found
  - No references found in session
  - No valid reference files accessible
- `HTTPException(500)`: Internal server error during ZIP creation

#### Behavior
1. Queries session document from MongoDB
2. Extracts reference file paths from `research_state.academic_search_result.results`
3. Validates each file path:
   - Checks file exists
   - Prevents path traversal attacks
   - Sanitizes filenames
4. Creates in-memory ZIP archive with all valid PDFs
5. Returns ZIP as streaming response with timestamped filename

#### File Naming Convention
- Uses paper title from metadata (sanitized, max 200 chars)
- Fallback to `paper_{index}.pdf` if title unavailable
- Ensures `.pdf` extension

#### ZIP Filename Format
```
references_{session_id}_{timestamp}.zip
```
Example: `references_abc123_20251030_143052.zip`

#### Example Usage
```python
# In router endpoint
@router.get("/references/{session_id}/download")
async def download_references(session_id: str):
    return await download_references_handler(session_id)
```

#### Response Headers
```
Content-Disposition: attachment; filename=references_{session_id}_{timestamp}.zip
Content-Type: application/zip
```

---

## Data Models

### Session Document Structure
```python
{
    "session_id": str,           # Unique session identifier
    "title": str,                # Conversation title
    "messages": List[Dict],      # Message history
    "research_state": {          # Research workflow state
        "academic_search_result": {
            "results": [         # Reference papers
                {
                    "title": str,
                    "filepath": str,  # Local PDF path
                    "doi": str,
                    # ... other metadata
                }
            ]
        }
    },
    "created_at": str,          # ISO timestamp
    "updated_at": str           # ISO timestamp
}
```

### Message Object Structure
```python
{
    "role": str,                # "user" | "assistant" | "system"
    "content": str,             # Message content
    "timestamp": str,           # ISO timestamp
    # ... additional metadata
}
```

---

## Database Dependencies

### MongoDB Collections
- **sessions**: Stores conversation documents and research state

### External Dependencies
- `db.mongo.mongodb`: MongoDB connection singleton
- `store.mongo.conversation.conversation_manager`: Manages conversation messages
- `core.common.get_logger`: Logging utility

---

## Error Handling

All handlers implement defensive error handling:

1. **Database Errors**: Caught and logged, return safe defaults (empty dict/list)
2. **File I/O Errors**: Logged and skipped (for reference downloads)
3. **HTTP Exceptions**: Properly raised with status codes and descriptive messages
4. **Validation Errors**: Path traversal prevention, file existence checks

---

## Logging

All operations log key events:
- Info: Successful retrievals, file additions to ZIP
- Warning: Missing sessions, invalid file paths
- Error: Database failures, unexpected exceptions

Logger name: `app.handler.chat`

---

## Security Considerations

### Path Traversal Prevention
The `download_references_handler` validates all file paths:
- Checks `os.path.exists()` and `os.path.isfile()`
- Only processes files from database-stored paths
- Sanitizes filenames before adding to ZIP archive

### Filename Sanitization
- Removes invalid characters (keeps alphanumeric, space, `-`, `_`, `.`, `,`)
- Limits filename length to 200 characters
- Prevents directory traversal in archive paths

---

## Performance Notes

- **Conversation List**: Limited to 50 sessions to prevent memory issues
- **Message Pagination**: Supports `limit`/`skip` for efficient large conversation handling
- **ZIP Creation**: Uses in-memory buffer (`io.BytesIO`) for optimal performance
- **File Streaming**: `StreamingResponse` enables efficient large file downloads

---

## Future Enhancements

Potential improvements:
1. Add date range filtering for conversation queries
2. Implement full-text search across messages
3. Support partial ZIP downloads (selected references only)
4. Add compression level configuration for ZIP archives
5. Implement conversation export in multiple formats (JSON, Markdown)

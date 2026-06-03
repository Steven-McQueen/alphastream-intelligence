# AlphaStream Local Jupyter Setup

The in-app **Notebook** page connects to a **Jupyter Server you run on your machine**. Your Python environment, API keys, and data stay local.

## Quick start

### 1. Start the Jupyter server

#### Anaconda (recommended on Windows)

**Do not double-click** `start-notebook-server.ps1` — Windows often opens it in an editor instead of running it.

**Option A — Anaconda Prompt (simplest)**

1. Open **Anaconda Prompt** (or your env’s terminal).
2. Activate your environment, e.g. `conda activate your_env_name`.
3. Run:

```bat
cd alphastream-notebooks
start-notebook-server.bat
```

Or double-click **`start-notebook-server.bat`** after opening Anaconda Prompt once so `python` is on PATH.

**Option B — auto-activate conda env**

1. Edit the first line in `start-notebook-server-conda.bat`: set `CONDA_ENV=your_env_name`.
2. Double-click **`start-notebook-server-conda.bat`** — a console window stays open with URL + token.

**Option C — PowerShell with active conda**

```powershell
conda activate your_env_name
cd alphastream-notebooks
.\start-notebook-server.ps1 -UseConda
```

Install packages once in that env:

```bat
pip install -r requirements.txt
```

#### Windows (standalone Python / venv)

```powershell
cd alphastream-notebooks
.\start-notebook-server.ps1
```

Or double-click **`start-notebook-server.bat`** from a terminal where `python` works.

#### macOS / Linux

```bash
cd alphastream-notebooks
chmod +x start-notebook-server.sh
./start-notebook-server.sh
```

The script creates `~/alphastream-notebooks` (or `%USERPROFILE%\alphastream-notebooks` on Windows) and prints:

- **URL** — usually `http://localhost:8888`
- **Token** — copy this into the app

### 2. Install frontend dependencies (first time only)

From the repo root:

```bash
cd alphastream-intelligence-frontend
npm install
```

If you see `Failed to resolve import "@monaco-editor/react"`, run `npm install` again and **restart** the Vite dev server (`Ctrl+C`, then `npm run dev`).

### 3. Connect AlphaStream

1. Start the frontend: `npm run dev` (port **8080**).
2. Open **Notebook** in the app.
3. Click the **kernel / connection** pill in the toolbar.
4. Enter the URL and token, then **Test connection** → **Save**.
5. Create or open a `.ipynb` from the sidebar.

### 4. Use VS Code (optional)

Notebooks are real files under your root folder (default `~/alphastream-notebooks`). Open any `.ipynb` in VS Code with the Jupyter extension and select the same Python environment as `alphastream-notebooks/.venv`.

## Custom root folder

```powershell
.\start-notebook-server.ps1 -RootDir "D:\Research\notebooks"
```

```bash
./start-notebook-server.sh /path/to/notebooks
```

Match this path in the app connection settings **Notebooks folder** field if you list files from a subdirectory.

## Using your data (FMP, database)

Cells run in **your** environment. Add your own keys to a `.env` or environment variables, then in a notebook:

```python
import os
import requests

# Example: call AlphaStream backend (user must run backend locally)
r = requests.get(
    "http://localhost:8000/api/health",
    headers={"Authorization": f"Bearer {os.environ.get('SUPABASE_JWT', '')}"},
)
print(r.json())
```

Or use `yfinance`, `fredapi`, and packages from `requirements.txt` directly.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `.ps1` opens in editor / new window | Use `.bat` files or run from **Anaconda Prompt**; see above. |
| `python not found` | Open Anaconda Prompt, `conda activate` your env, then run `.bat` again. |
| CORS / connection failed | Ensure `allow_origin` includes your app URL; restart the server script. |
| Unauthorized | Copy the token from the **current** server startup log. |
| Empty notebook list | Confirm Jupyter `root_dir` matches where `.ipynb` files live; click **Refresh list**. |
| Kernel busy forever | Use **Interrupt** or **Restart** in the toolbar. |
| `isActive` / kernel errors | Restart frontend after pull; ensure Jupyter server is running; register kernel: `conda activate your_env` then `python -m ipykernel install --user --name python3` |
| Stuck on **Connecting…** | Install `ipykernel` in your conda env; restart Jupyter server; click **Restart** in toolbar. |

## Packages

Edit `requirements.txt` and reinstall:

```bash
.venv/bin/pip install -r requirements.txt   # Unix
.venv\Scripts\pip install -r requirements.txt   # Windows
```

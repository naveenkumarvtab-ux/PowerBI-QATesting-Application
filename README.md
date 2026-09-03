# PBI QA Suite

PBI QA Suite is a full-stack automated quality assurance testing application for Power BI reports. It validates naming compliance, expression complexity, bookmark page rendering, visual error tiles, and report data exports in two independent modes:

1. **Method 1 — Local PBIX Analysis:** Statically extracts and parses offline `.pbix` templates. Runs naming checks against Power Query (M) steps, DAX measures, and calculated columns.
2. **Method 2 — Power BI Service Analysis:** Runs a live validation suite against a published report. Uses Azure AD OAuth tokens to pull dataset schemas via REST DMV endpoints, then spins up a Playwright headless browser to interact with visuals, bookmarks, and slicers, validating Excel/PDF exports.

---

## Workspace Directory Structure

```
Power BI Testing Application/
  ├── backend/               # Flask Application
  │   ├── app.py             # Entrypoint & DB initialization
  │   ├── config.py          # App settings & env loading
  │   ├── rules_config.json  # Configurable naming & complexity standards
  │   ├── requirements.txt   # Python packages list
  │   ├── Dockerfile         # Playwright-baked Docker container configuration
  │   ├── api/               # API Blueprints
  │   │   ├── routes_pbix.py
  │   │   ├── routes_service.py
  │   │   └── routes_jobs.py
  │   └── core/              # Main parsing & test runners
  │       ├── pbix_parser.py
  │       ├── naming_rules.py
  │       ├── dax_analyzer.py
  │       ├── mquery_analyzer.py
  │       ├── powerbi_auth.py
  │       ├── powerbi_api_client.py
  │       ├── functional_tests.py
  │       ├── export_tests.py
  │       └── report_builder.py
  ├── frontend/              # React Application (Vite + Tailwind CSS)
  │   ├── package.json
  │   ├── tailwind.config.js
  │   ├── src/
  │   │   ├── main.jsx
  │   │   ├── App.jsx
  │   │   ├── pages/         # Home, Upload, Service, Status, Report, History
  │   │   └── components/    # Navbar
  │   └── index.html
  ├── docker-compose.yml     # Local orchestration
  ├── render.yaml            # Render deployment blueprint
  └── README.md
```

---

## Local Development Setup

### 1. Backend Setup (Python 3.11+)

Navigate to the `backend/` folder:
```bash
cd backend
```

Create a virtual environment and activate it:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

Install requirements:
```bash
pip install -r requirements.txt
```

Launch the Flask development server on port 5000:
```bash
python app.py
```

### 2. Frontend Setup (Node.js 18+)

Navigate to the `frontend/` folder:
```bash
cd ../frontend
```

Install dependencies:
```bash
npm install
```

Launch the Vite React dev server on port 5173:
```bash
npm run dev
```

Visit the app in your browser at `http://localhost:5173`. Any requests to `/api/*` will automatically be proxied to Flask on port 5000.

### Supabase login and database

The application uses Supabase Auth for email/password accounts and PostgreSQL for persistent job history. Configure these backend variables in `backend/.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres.project-ref:password@session-pooler-host:5432/postgres
```

Configure these frontend variables in `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never expose the database password or a Supabase service-role key in frontend variables. In Supabase Authentication URL Configuration, add `http://localhost:5173/login` and `http://localhost:5173/reset-password` for local development, plus the equivalent production URLs. A custom SMTP provider such as Brevo is recommended for confirmation and password-recovery delivery.

---

## Azure AD (Entra ID) App Registration

To run live reports from the Power BI Service (Method 2) in production, you must set up an App Registration in your Azure Active Directory tenant:

1. **Create App:** Navigate to Azure Portal &rarr; **App Registrations** &rarr; **New Registration**.
2. **Redirect URI:** Set the Redirect URI type to *Single-page application (SPA)* or *Web* and add your OAuth callback address, for example: `http://localhost:5173/test-service`.
3. **API Permissions:** Under **API Permissions**, select **Add a permission** &rarr; **Power BI Service**:
   * Add Delegated permissions: `Report.Read.All`, `Dataset.Read.All`, `Workspace.Read.All`.
   * Add Application permissions (if using Service Principal): `Tenant.Read.All`, `Report.Read.All`, `Dataset.Read.All`, `Workspace.Read.All`.
4. **Client Secret:** Under **Certificates & Secrets**, generate a new client secret and copy its value.
5. **Admin Consent:** Grant admin consent for your tenant permissions.

---

## Power BI Tenant Admin Settings

To authorize API tokens and enable automation:

1. Log into **Power BI Admin Portal**.
2. Navigate to **Tenant Settings**.
3. Under **Developer settings**:
   * Enable **Allow service principals to use Power BI APIs**.
   * Enable **Allow service principals to use read-only Admin APIs**.
4. Under **Integration settings** (for live DMV schema checks):
   * Enable **XMLA Read-Write** (Premium capacity workspace setting) to allow Analysis Services connection query parameters.

### Mock Fallback Mode
If Azure AD credentials or Power BI workspaces are unavailable, the application runs in **Mock Fallback Mode** (`MOCK_SERVICE=true` inside `.env` or `config.py`). This allows full testing of the UI, background job status, page routing, and report generation using local mock datasets and simulated test passes/fails.

---

## Deploying to Render

You can deploy the complete suite to Render using the preconfigured `render.yaml` blueprint:

1. Connect your repository to **Render.com**.
2. Create a new **Blueprint** project.
3. Render will parse `render.yaml` and configure:
   * **pbi-qa-backend:** Web service running the Docker container.
   * **pbi-qa-frontend:** Static site serving the React bundle.
4. Set your Environment Variables (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`) in the Render Dashboard to switch from mock checks to live validation.

For authentication and persistent storage, also configure `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` on the backend service, and `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY` on the frontend static site. Frontend variables are embedded at build time, so redeploy the frontend after changing them.

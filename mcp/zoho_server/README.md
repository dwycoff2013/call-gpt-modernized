# Zoho CRM MCP Server

This server provides a **curated Zoho CRM MCP backend** for `call-gpt-modernized`.

## Exposed tools

Only the following MCP tools are exposed:

- `findLeadByEmail`
- `createLead`
- `createEvent`
- `getEventsByTimeRange`

The curated OpenAPI definition is in `specs/zoho-crm-curated.json`.

## Environment variables

Required:

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`

Optional:

- `ZOHO_ACCOUNTS_URL` (default: `https://accounts.zoho.com`)
- `ZOHO_API_DOMAIN` (default: `https://www.zohoapis.com`)

## Run locally

```bash
cd mcp/zoho_server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

The server runs over stdio for MCP clients.
